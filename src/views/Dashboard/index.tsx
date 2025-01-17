import { lazy, Suspense, useEffect } from 'react';

import { Box, Grow } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Loading from 'components/Loader';
import { theme } from 'constants/theme';
import { useWeb3Context } from 'contexts/web3/web3.context';
import { formatAPY, formatUSDFromDecimal } from 'helpers/price-units';
import { selectAppLoading, selectFormattedReservePrice } from 'store/modules/app/app.selectors';
import { selectFormattedBondCoreMetrics, selectFormattedTreasuryBalance, selectTreasuryReady } from 'store/modules/bonds/bonds.selector';
import { getBondMetrics, getTreasuryBalance } from 'store/modules/bonds/bonds.thunks';
import { selectMarketsLoading } from 'store/modules/markets/markets.selectors';
import { selectFormattedMarketCap, selectStakingRewards, selectTVL, selectWSBASHPrice } from 'store/modules/metrics/metrics.selectors';
import { selectFormattedIndex } from 'store/modules/stake/stake.selectors';

import './dashboard.scss';

const MenuMetric = lazy(() => import('components/Metrics/MenuMetric'));

function Dashboard() {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const {
        state: { networkID },
    } = useWeb3Context();

    const marketsLoading = useSelector(selectMarketsLoading);
    const bashPrice = useSelector(selectFormattedReservePrice);
    const wsPrice = useSelector(selectWSBASHPrice);
    const marketCap = useSelector(selectFormattedMarketCap);
    const stakingRewards = useSelector(selectStakingRewards);
    const TVL = useSelector(selectTVL);
    const currentIndex = useSelector(selectFormattedIndex);
    const treasuryBalance = useSelector(selectFormattedTreasuryBalance);
    const appIsLoading = useSelector(selectAppLoading);
    const bondTreasuryReady = useSelector(selectTreasuryReady);
    const { rfv, rfvBASH, runway } = useSelector(selectFormattedBondCoreMetrics);

    useEffect(() => {
        if (!appIsLoading && networkID) dispatch(getTreasuryBalance({ networkID }));
    }, [networkID, appIsLoading]);

    useEffect(() => {
        if (bondTreasuryReady && networkID) dispatch(getBondMetrics({ networkID }));
    }, [networkID, bondTreasuryReady]);

    if (appIsLoading) return <Loading />;

    const APYMetrics = stakingRewards
        ? [
              { name: 'APY', value: stakingRewards ? formatAPY(stakingRewards.stakingAPY.toString()) : null },
              { name: 'CurrentIndex', value: currentIndex },
              { name: 'wsBASHPrice', value: wsPrice },
          ]
        : [];

    const DashboardItems = [
        { name: 'BashPrice', value: bashPrice },
        { name: 'MarketCap', value: marketCap },
        { name: 'TVL', value: TVL ? formatUSDFromDecimal(TVL, 2) : 0 },
        { name: 'TreasuryBalance', value: treasuryBalance },

        ...APYMetrics,
        { name: 'RiskFreeValue', value: rfv },
        { name: 'RiskFreeValuewsBASH', value: rfvBASH },
        { name: 'Runway', value: t('common:day', { count: Number(runway) }) },
    ];

    return (
        <Box>
            <Grid container spacing={6} sx={{ p: 2 }} justifyContent="space-around">
                {DashboardItems.map(metric => (
                    <Grow in={!marketsLoading} {...(!marketsLoading ? { timeout: 1000 } : {})} key={`dashboard-item-${metric.name}`}>
                        <Grid item lg={6} md={6} sm={6} xs={12}>
                            <Box
                                className="Dashboard__box__item"
                                sx={{
                                    backgroundColor: theme.palette.cardBackground.main,
                                    backdropFilter: 'blur(100px)',
                                    borderRadius: '.5rem',
                                    color: theme.palette.primary.main,
                                    px: theme.spacing(2),
                                    py: theme.spacing(4),
                                    textAlign: 'center',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    display: 'flex',
                                    flex: '1 1 auto',
                                    overflow: 'auto',
                                    flexDirection: 'column',
                                    height: '100%',
                                }}
                            >
                                <Suspense fallback={<Loading />}>
                                    <MenuMetric metricKey={t(metric.name)} value={metric.value} />
                                </Suspense>
                            </Box>
                        </Grid>
                    </Grow>
                ))}
            </Grid>
        </Box>
    );
}

export default Dashboard;
