import { createAsyncThunk } from '@reduxjs/toolkit';
import Decimal from 'decimal.js';
import { providers, constants, Contract, utils, BigNumber } from 'ethers';
import { isNil, snakeCase, sum } from 'lodash';

import { BondingCalcContract } from 'abi';
import { BONDS } from 'config/bonds';
import { getAddresses } from 'constants/addresses';
import { messages } from 'constants/messages';
import { WEB3State } from 'contexts/web3/web3.types';
import { metamaskErrorWrap } from 'helpers/networks/metamask-error-wrap';
import { createBond, getBondContractsAddresses } from 'lib/bonds/bonds.helper';
import { addNotification } from 'store/modules/messages/messages.slice';
import { IReduxState } from 'store/slices/state.interface';
import { RootState } from 'store/store';

import { getBlockchainData } from '../app/app.thunks';
import { addPendingTransaction, clearPendingTransaction } from '../transactions/transactions.slice';
import { TransactionTypeEnum } from '../transactions/transactions.type';
import { getLPBondQuote, getLPPurchasedBonds, getTokenBondQuote, getTokenPurchaseBonds } from './bonds.utils';

export const initializeBonds = createAsyncThunk('app/bonds', async (provider: WEB3State['provider'] | WEB3State['signer']) => {
    if (!provider) throw new Error('Bond initialization error');

    const signer = provider.getSigner('0xAd28CB10AC6FC37F0fA46c520962ef667756d166');
    const chainID = await signer.getChainId();

    // init bond calculator
    const { BASH_BONDING_CALC_ADDRESS } = getAddresses(chainID);

    const bondCalculator = new Contract(BASH_BONDING_CALC_ADDRESS, BondingCalcContract, signer);

    const bondstoOutput = BONDS.reduce(
        (acc, bondConfig) => {
            const bondInstance = createBond({ ...bondConfig, networkID: chainID });

            const contracts = getBondContractsAddresses(bondConfig, chainID);

            bondInstance.initializeContracts(contracts, signer);

            const bondName = snakeCase(bondConfig.name);

            return {
                bondInstances: {
                    ...acc.bondInstances,
                    [bondName]: bondInstance,
                },
                bondMetrics: {
                    ...acc.bondMetrics,
                    [bondName]: {
                        treasuryBalance: null,
                        bondDiscount: null,
                        bondQuote: null,
                        purchased: null,
                        vestingTerm: null,
                        maxBondPrice: null,
                        bondPrice: null,
                        marketPrice: null,
                        maxBondPriceToken: null,
                        allowance: null,
                        balance: null,
                        loading: false,
                    },
                },
            };
        },
        {
            bondInstances: {},
            bondMetrics: {},
        },
    );

    return {
        ...bondstoOutput,
        bondCalculator,
    };
});

export const getBondMetrics = createAsyncThunk('bonds/bonds-metrics', async ({ networkID }: { networkID: number }, { getState }) => {
    const {
        bonds: { bondMetrics, bondCalculator, bondInstances },
        main: {
            contracts: { BASH_CONTRACT },
            metrics: { totalSupply, rawCircSupply, circSupply, reserves },
            staking: { epoch },
        },
        markets: {
            markets: { dai },
        },
    } = getState() as IReduxState;
    const { DAO_ADDRESS, PRESALE_REDEMPTION_ADDRESS } = getAddresses(networkID);

    if (isNil(rawCircSupply) || !circSupply || !totalSupply || !reserves || !dai || !epoch || !BASH_CONTRACT || !bondCalculator)
        throw new Error('Missing metrics to compute bond metrics');

    const bondsBashAmounts = await Promise.all([...Object.values(bondInstances).map(bond => bond.getSbAmount(BASH_CONTRACT.address))]);

    const balances = Object.entries(bondMetrics).reduce(
        (acc, [bondID, { treasuryBalance }]) => {
            const isLPBond = bondInstances[bondID].isLP();

            if (isLPBond) {
                acc.lpBonds += treasuryBalance || 0;
            } else {
                acc.bashBonds += treasuryBalance || 0;
            }

            return acc;
        },
        { lpBonds: 0, bashBonds: 0 },
    );

    const daoBash = await BASH_CONTRACT.balanceOf(DAO_ADDRESS);
    const daoBashAmount = Number(utils.formatUnits(daoBash, 'gwei'));
    const redeemableBash = (await BASH_CONTRACT.balanceOf(PRESALE_REDEMPTION_ADDRESS)) / Math.pow(10, 9);

    const rfvTreasury = balances.lpBonds / 2 + balances.bashBonds;
    const bashAmounts = sum(bondsBashAmounts);

    const bashSupply = totalSupply - bashAmounts - daoBashAmount - redeemableBash;

    const rfv = rfvTreasury / bashSupply;
    const stakingRebase = new Decimal(epoch.distribute.toString()).div(rawCircSupply.toString()).toNumber();
    const treasuryForRunway = rfvTreasury / circSupply;
    const runway = Math.log(treasuryForRunway) / Math.log(1 + stakingRebase) / 3;

    const marketPrice = reserves.div(10 ** 9).toNumber() * dai;
    const deltaMarketPriceRfv = ((rfv - marketPrice) / rfv) * 100;

    return {
        stakingRebase,
        rfv,
        deltaMarketPriceRfv,
        rfvTreasury,
        runway,
    };
});

export const getTreasuryBalance = createAsyncThunk('bonds/bonds-treasury', async ({ networkID }: { networkID: number }, { getState }) => {
    const {
        bonds: { bondInstances, bondCalculator },
    } = getState() as IReduxState;

    const { TREASURY_ADDRESS } = getAddresses(networkID);

    if (!bondCalculator) throw new Error('Unable to get bondCalculator');

    const balances = await Promise.all([...Object.values(bondInstances).map(bond => bond.getTreasuryBalance(bondCalculator, TREASURY_ADDRESS))]);

    const keys = Object.keys(bondInstances);

    return balances.reduce((acc, val, i) => {
        return {
            ...acc,
            [keys[i]]: val,
        };
    }, {});
});

export const calcBondDetails = createAsyncThunk(
    'bonds/calcBondDetails',
    async ({ bondID, value, networkID }: { bondID: string; value: number; networkID: number }, { getState, dispatch }) => {
        const { bonds, main, markets } = getState() as RootState;
        const { TREASURY_ADDRESS } = getAddresses(networkID);

        const bondInstance = bonds.bondInstances[bondID];
        const bondMetrics = bonds.bondMetrics[bondID];

        if (!bondInstance || !bondMetrics || !bondInstance.getBondContract()) throw new Error('Unable to get bondInfos');

        const reserves = main.metrics.reserves;
        const { bondCalculator } = bonds;
        const daiPrice = markets.markets.dai;

        if (!reserves || !daiPrice || !bondCalculator) throw new Error('State is not setup for bonds');

        const terms = await bondInstance.getBondContract().terms();
        const maxBondPrice = await bondInstance.getBondContract().maxPayout();
        const bondAmountInWei = utils.parseEther(value.toString());

        const marketPrice = reserves.div(10 ** 9).toNumber() * daiPrice;
        const baseBondPrice = (await bondInstance.getBondContract().bondPriceInUSD()) as BigNumber;

        const bondPrice = bondInstance.isCustomBond() ? baseBondPrice.mul(daiPrice) : baseBondPrice;

        const bondDiscount = new Decimal(reserves.toString())
            .mul(10 ** 9)
            .sub(bondPrice.toString())
            .div(bondPrice.toString());

        const { bondQuote, maxBondPriceToken } = bondInstance.isLP()
            ? await getLPBondQuote(bondInstance, bondAmountInWei, bondCalculator, maxBondPrice)
            : await getTokenBondQuote(bondInstance, bondAmountInWei, maxBondPrice);

        if (!!value && bondQuote > maxBondPrice) {
            dispatch(addNotification({ severity: 'error', description: messages.try_mint_more(maxBondPrice.toFixed(2).toString()) }));
        }

        const initialPurchased = await bondInstance.getReserveContract().balanceOf(TREASURY_ADDRESS);

        const { purchased } = bondInstance.isLP()
            ? await getLPPurchasedBonds(bondInstance, bondCalculator, initialPurchased, daiPrice)
            : await getTokenPurchaseBonds(bondInstance, bondCalculator, initialPurchased, daiPrice);

        return {
            bondID: bondID,
            bondDiscount,
            bondQuote,
            purchased,
            vestingTerm: Number(terms.vestingTerm), // Number(terms.vestingTerm),
            maxBondPrice: maxBondPrice / 10 ** 9,
            bondPrice, // bondPrice / Math.pow(10, 18),
            marketPrice,
            maxBondPriceToken,
        };
    },
);

export const getBondTerms = createAsyncThunk('bonds/terms', async (bondID: string, { getState }) => {
    const {
        bonds: { bondInstances },
    } = getState() as RootState;

    if (bondInstances[bondID] === undefined) throw new Error('Bond not found');

    const terms = await bondInstances[bondID].getBondContract().terms();

    return { terms };
});

export const approveBonds = createAsyncThunk('bonds/approve', async ({ signer, bondID }: { signer: providers.Web3Provider; bondID: string }, { dispatch, getState }) => {
    const {
        bonds: { bondInstances },
    } = getState() as RootState;

    const bond = bondInstances[bondID];

    if (!bond) throw new Error('Bond not found');

    const address = await signer.getSigner().getAddress();
    const gasPrice = await signer.getGasPrice();

    const { bondAddress } = bond.getBondAddresses();
    const approveTx = await bond.getReserveContract().approve(bondAddress, constants.MaxUint256, { gasPrice });
    try {
        dispatch(
            addPendingTransaction({
                hash: approveTx.hash,
                type: TransactionTypeEnum.APPROVE_CONTRACT,
            }),
        );
        await approveTx.wait();

        dispatch(addNotification({ severity: 'success', description: messages.tx_successfully_send }));
    } catch (err) {
        metamaskErrorWrap(err, dispatch);
    } finally {
        if (approveTx) {
            dispatch(clearPendingTransaction(TransactionTypeEnum.APPROVE_CONTRACT));
        }
    }

    const allowance = await bond.getReserveContract().allowance(address, bondAddress);

    return { allowance };
});

export const calculateUserBondDetails = createAsyncThunk(
    'bonds/calculateUserBondDetails',
    async ({ signerAddress, signer, bondID }: { signer: providers.Web3Provider; signerAddress: string; bondID: string }, { getState, dispatch }) => {
        const {
            main: {
                blockchain: { timestamp },
            },
            bonds: { bondInstances },
        } = getState() as IReduxState;

        const bond = bondInstances[bondID];

        if (!bond) throw new Error('Unable to quote');

        dispatch(getBlockchainData(signer)); // needed to result the timestamp

        const bondContract = bond.getBondContract();
        const userAddress = signerAddress;

        const { payout, vesting, lastTime } = await bondContract.bondInfo(userAddress);
        const interestDue = payout / Math.pow(10, 9);
        const bondMaturationBlock = Number(vesting) + Number(lastTime);
        const pendingPayout = await bondContract.pendingPayoutFor(userAddress);

        const pendingPayoutVal = utils.formatUnits(pendingPayout, 'gwei');

        return {
            interestDue,
            bondMaturationBlock,
            bondVesting: bondMaturationBlock - (timestamp ?? 0),
            pendingPayout: Number(pendingPayoutVal),
        };
    },
);

export const depositBond = createAsyncThunk(
    'bonds/deposit',
    async (
        {
            amount,
            bondID,
            signer,
            signerAddress,
            slippage,
            recipientAddress,
        }: { amount: number; bondID: string; signer: providers.Web3Provider; signerAddress: string; slippage?: number; recipientAddress: string },
        { dispatch, getState },
    ) => {
        const { bonds } = getState() as RootState;

        const bondInstance = bonds.bondInstances[bondID];
        const bondMetrics = bonds.bondMetrics[bondID];

        if (!bondInstance || !bondMetrics) throw new Error('Unable to get bonds');

        const address = recipientAddress.length > 0 ? recipientAddress : signerAddress;
        const acceptedSlippage = (slippage ?? 0.5) / 100 || 0.005;
        const valueInWei = utils.parseUnits(amount.toString(), 'ether');
        const bondContract = bondInstance.getBondContract();

        if (!bondMetrics.bondPrice) throw new Error('Unable to get bondPrice');

        const gasPrice = await signer.getGasPrice();

        let bondTx;

        try {
            const bondPremium = await bondInstance.getBondContract().bondPrice();
            const premium = Math.round(bondPremium.toNumber());
            const maxPremium = Math.round(premium * (1 + acceptedSlippage));

            const gasEstimation = await bondContract.estimateGas.deposit(valueInWei, maxPremium, address);

            bondTx = await bondContract.deposit(valueInWei, premium, address, { gasPrice, gasLimit: gasEstimation });
            dispatch(
                addPendingTransaction({
                    hash: bondTx.hash,
                    type: TransactionTypeEnum.BONDING,
                }),
            );

            await bondTx.wait();
            dispatch(addNotification({ severity: 'success', description: messages.tx_successfully_send }));
            dispatch(addNotification({ severity: 'info', description: messages.your_balance_update_soon }));

            await dispatch(calculateUserBondDetails({ bondID, signer, signerAddress }));

            dispatch(addNotification({ severity: 'info', description: messages.your_balance_updated }));
        } catch (err: unknown) {
            return metamaskErrorWrap(err, dispatch);
        } finally {
            if (bondTx) {
                dispatch(clearPendingTransaction(TransactionTypeEnum.BONDING));
            }
        }
    },
);

export const loadBondBalancesAndAllowances = createAsyncThunk('bonds/balances-and-allowances', async ({ address, bondID }: { address: string; bondID: string }, { getState }) => {
    const {
        bonds: { bondInstances },
    } = getState() as IReduxState;

    const bond = bondInstances[bondID];

    if (!bond) throw new Error('Bond not found');

    const bondContract = bond.getBondContract();
    const reserveContract = bond.getReserveContract();

    const allowance = await reserveContract.allowance(address, bondContract.address);
    const balance = await reserveContract.balanceOf(address);

    return { allowance, balance, ID: bond.ID };
});

export const redeemBond = createAsyncThunk(
    'bonds/redeem',
    async (
        { recipientAddress, signer, bondID, isAutoStake }: { recipientAddress: string; signer: providers.Web3Provider; bondID: string; isAutoStake: boolean },
        { dispatch, getState },
    ) => {
        const {
            bonds: { bondInstances },
        } = getState() as RootState;

        const bondInstance = bondInstances[bondID];
        if (!bondInstance) throw new Error('Unable to get bondID from bondInstances');

        const gasPrice = await signer.getGasPrice();
        const signerAddress = await signer.getSigner().getAddress();

        const redeemTx = await bondInstance.getBondContract().redeem(recipientAddress, isAutoStake, { gasPrice });

        try {
            dispatch(
                addPendingTransaction({
                    hash: redeemTx.hash,
                    type: TransactionTypeEnum.REDEEMING,
                }),
            );

            await redeemTx.wait();

            dispatch(addNotification({ severity: 'success', description: messages.tx_successfully_send }));
            dispatch(addNotification({ severity: 'info', description: messages.your_balance_update_soon }));

            await dispatch(calculateUserBondDetails({ signerAddress, signer, bondID }));
            await dispatch(loadBondBalancesAndAllowances({ address: signerAddress, bondID }));
            dispatch(addNotification({ severity: 'info', description: messages.your_balance_updated }));
        } catch (err: unknown) {
            return metamaskErrorWrap(err, dispatch);
        } finally {
            if (redeemTx) {
                if (isAutoStake) {
                    dispatch(clearPendingTransaction(TransactionTypeEnum.REDEEMING_STAKING));
                } else {
                    dispatch(clearPendingTransaction(TransactionTypeEnum.REDEEMING));
                }
            }
        }
    },
);
