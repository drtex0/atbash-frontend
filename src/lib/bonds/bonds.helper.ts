import { Networks } from 'constants/blockchain';

import { BondOptions } from './bond/bond';
import { LPBond } from './bond/lp-bond';
import { StableBond } from './bond/stable-bond';
import { BondAddresses, BondConfig, BondType } from './bonds.types';

export const createBond = (bondConfig: BondOptions): LPBond | StableBond => {
    switch (bondConfig.type) {
        case BondType.LP:
            return new LPBond(bondConfig);
        case BondType.STABLE_ASSET:
            return new StableBond(bondConfig);

        default:
            throw new Error('Undefined bond type');
    }
};

export const getBondContractsAddresses = (bondConfig: BondConfig, networkID: Networks): BondAddresses => {
    const addresses = bondConfig.addresses[networkID];

    if (!addresses || !addresses.bondAddress || !addresses.reserveAddress) throw new Error('Unable to get bond addresses');

    return { bondAddress: addresses.bondAddress, reserveAddress: addresses.reserveAddress };
};
