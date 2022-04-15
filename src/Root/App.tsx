import { useCallback, useEffect } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { useWeb3Context } from "hooks/web3";
import { IReduxState } from "store/slices/state.interface";
import ViewBase from "layout/ViewBase";
import { Dashboard, CritialError, NotFound, Stake, Wrap, Bond, ChooseBond } from "../views";
import Loading from "components/Loader";

import "./style.scss";
import { getBlockchainData, getCoreMetrics, getStakingMetrics, initializeProviderContracts } from "store/modules/app/app.thunks";
import { MainSliceState } from "store/modules/app/app.types";
import { Route, Switch } from "react-router-dom";
import { getMarketPrices } from "store/modules/markets/markets.thunks";
import { Contract } from "ethers";
import { DEFAULT_NETWORK } from "constants/blockchain";
import { initializeBonds } from "store/modules/bonds/bonds.thunks";
import BondList from "views/BondList/BondList";

function App() {
    const dispatch = useDispatch();
    const { provider, chainID, connected, checkWrongNetwork, providerChainID } = useWeb3Context();

    const { errorEncountered, loading, contracts, contractsLoaded } = useSelector<IReduxState, MainSliceState>(state => state.main, shallowEqual);
    const stakingAddressReady = useSelector<IReduxState, Contract | null>(state => state.main.contracts.STAKING_ADDRESS);
    const marketsLoading = useSelector<IReduxState, boolean>(state => state.markets.loading);

    useEffect(() => {
        if (connected && !contractsLoaded) {
            dispatch(initializeProviderContracts({ networkID: chainID, provider }));
        }
    }, [connected]);

    useEffect(() => {
        if (connected && contractsLoaded) {
            dispatch(getBlockchainData(provider));
            dispatch(getCoreMetrics());
            dispatch(getMarketPrices());
            dispatch(initializeBonds(provider));
        }
    }, [connected, contractsLoaded]);

    useEffect(() => {
        if (contracts.STAKING_ADDRESS) {
            dispatch(getStakingMetrics());
        }
    }, [contracts]);

    if (errorEncountered)
        return (
            <ViewBase>
                <CritialError />
            </ViewBase>
        );

    if (loading || marketsLoading)
        return (
            <ViewBase>
                <Loading />
            </ViewBase>
        );

    return (
        <ViewBase>
            <Switch>
                <Route exact path="/">
                    <Dashboard />
                </Route>

                {connected && (
                    <>
                        <Route path="/stake">
                            <Stake />
                        </Route>

                        <Route path="/bond">
                            <Bond />
                        </Route>

                        <Route path="/bonds">
                            <BondList />
                        </Route>

                        {/* <Route path="/wrap">
                            <Wrap />
                        </Route> */}
                    </>
                )}
                <Route component={NotFound} />
            </Switch>
        </ViewBase>
    );
}

export default App;
