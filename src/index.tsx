import './i18n';

import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import { BSnackBar } from 'components/Messages/snackbar';
import { theme } from 'constants/theme';
import { Web3ContextProvider } from 'contexts/web3/web3.context';
import { ErrorBoundary } from 'Root/Error';

import Root from './Root';
import store from './store/store';

ReactDOM.render(
    <>
        <CssBaseline />
        <ThemeProvider theme={theme}>
            <Web3ContextProvider>
                <Provider store={store}>
                    <SnackbarProvider
                        maxSnack={3}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        autoHideDuration={5000}
                        content={() => {
                            return <BSnackBar severity="info" description="test" />;
                        }}
                    >
                        <ErrorBoundary>
                            <Root />
                        </ErrorBoundary>
                    </SnackbarProvider>
                </Provider>
            </Web3ContextProvider>
        </ThemeProvider>
    </>,
    document.getElementById('root'),
);
