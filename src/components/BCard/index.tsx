import { Box, Typography, Zoom } from '@mui/material';

import { theme } from 'constants/theme';

export const BCard = ({ title, children, zoom, className }: { title: string; children: React.ReactNode; zoom: boolean; className?: string }) => {
    const card = (
        <Box
            className={className}
            sx={{
                padding: theme.spacing(4),
                [theme.breakpoints.up('xs')]: {
                    margin: '.5rem',
                },
                [theme.breakpoints.down('xs')]: {
                    margin: '1rem',
                },
                '@supports (-webkit-backdrop-filter: none) or (backdrop-filter: none)': {
                    background: theme.palette.cardBackground.main,
                    backdropFilter: 'blur(100px)',
                },

                '@supports not ((-webkit-backdrop-filter: none) or (backdrop-filter: none))': {
                    background: theme.palette.cardBackground.dark,
                    backdropFilter: 'blur(100px)',
                },
            }}
        >
            <Box sx={{ color: theme.palette.primary.main }}>
                <Typography variant="h4" sx={{ textTransform: 'uppercase' }}>
                    {title}
                </Typography>
            </Box>
            {children}
        </Box>
    );

    return zoom ? (
        <>
            <Zoom in={false}>
                <>{card}</>
            </Zoom>
        </>
    ) : (
        card
    );
};
