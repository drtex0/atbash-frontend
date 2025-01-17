import { Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import MemoInlineMetric from 'components/Metrics/InlineMetric';
import { theme } from 'constants/theme';
import { selectFormattedStakeBalance } from 'store/modules/account/account.selectors';
import { selectUserStakingInfos } from 'store/modules/app/app.selectors';

const UserStakeMetrics = () => {
    const { t } = useTranslation();

    const { BASH, SBASH } = useSelector(selectFormattedStakeBalance);
    const userStakingMetrics = useSelector(selectUserStakingInfos);

    const keyMetrics = [
        { key: 'YourBalance', value: BASH },
        { key: 'stake:YourStakedBalance', value: SBASH },
        { key: 'stake:NextRewardAmount', value: userStakingMetrics.nextRewardValue },
        { key: 'stake:NextRewardYield', value: userStakingMetrics.stakingRebasePercentage },
        { key: 'stake:ROIFiveDayRate', value: userStakingMetrics.fiveDayRate },
    ];

    const optionalMetrics = [{ key: 'stake:EffectiveNextRewardAmount', value: userStakingMetrics.effectiveNextRewardValue }];

    const metrics = [...keyMetrics, ...(userStakingMetrics.optionalMetrics ? optionalMetrics : [])].map(({ key: metricKey, value }, i) => (
        <MemoInlineMetric key={`metric-${i}`} {...{ metricKey, value }} />
    ));

    return (
        <Box>
            <Typography variant="h4" sx={{ color: theme.palette.primary.light }}>
                <>{t('stake:StakingMetrics')} </>
            </Typography>

            {metrics}
        </Box>
    );
};

export default UserStakeMetrics;
