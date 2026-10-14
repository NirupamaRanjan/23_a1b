import { Component, lazy, Suspense } from 'react';
import {
    Alert,
    Button,
    CircularProgress,
    CssBaseline,
    GlobalStyles,
    ThemeProvider,
    createTheme,
    alpha,
} from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import { COLORS } from './colors';
import DataProvider from './context/DataProvider';
import Shell from './component/header/Shell';
const Browse = lazy(() => import('./component/browse/Browse'));
const Transaction = lazy(() => import('./component/transaction/Transaction'));
const AuditTrail = lazy(() => import('./component/audit/AuditTrail'));
const Analytics = lazy(() => import('./component/analytics/Analytics'));
const NurseMap = lazy(() => import('./component/map/NurseMap'));
const Reviews = lazy(() => import('./component/reviews/Reviews'));
const theme = createTheme({
    palette: {
        primary: { main: COLORS.primary },
        success: { main: COLORS.success },
        error: { main: COLORS.error },
        warning: { main: COLORS.warning },
        text: {
            primary: COLORS.text,
            secondary: COLORS.muted,
            disabled: alpha(COLORS.muted, 0.5),
        },
        action: {
            active: COLORS.muted,
            hover: alpha(COLORS.primary, 0.07),
            selected: alpha(COLORS.primary, 0.12),
            disabled: alpha(COLORS.muted, 0.5),
            disabledBackground: alpha(COLORS.primary, 0.06),
            focus: alpha(COLORS.primary, 0.14),
        },
        background: { default: COLORS.background, paper: COLORS.surface },
        divider: COLORS.border,
    },
    typography: {
        fontFamily: 'Arial, sans-serif',
        h1: { fontSize: 'clamp(1.65rem, 2.6vw, 2.15rem)', fontWeight: 700 },
        h2: { fontSize: '1.3rem', fontWeight: 600 },
        h3: { fontSize: '1.1rem', fontWeight: 600 },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 9 },
    components: {
        MuiButton: {
            styleOverrides: {
                root: { minHeight: 44, boxShadow: 'none', paddingInline: 18 },
            },
        },
        MuiTextField: { defaultProps: { size: 'small' } },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderColor: COLORS.border,
                    fontSize: '.9rem',
                    padding: '13px 14px',
                },
                head: {
                    color: COLORS.muted,
                    background: alpha(COLORS.primary, 0.035),
                    fontWeight: 600,
                },
            },
        },
    },
});
class ErrorBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? (
            <Alert
                severity='error'
                action={<Button onClick={() => window.location.reload()}>Reload</Button>}
            >
                This screen could not be displayed.
            </Alert>
        ) : (
            this.props.children
        );
    }
}
const App = () => (
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles
            styles={{
                'html, body, #root': { margin: 0, minHeight: '100%' },
                '*': { boxSizing: 'border-box' },
                'button:focus-visible, a:focus-visible': {
                    outline: `2px solid ${COLORS.primary}`,
                    outlineOffset: 2,
                },
                'input, button, textarea': { font: 'inherit' },
            }}
        />
        <DataProvider>
            <ErrorBoundary>
                <Suspense fallback={<CircularProgress aria-label='Loading screen' sx={{ m: 4 }} />}>
                    <Routes>
                        <Route element={<Shell />}>
                            <Route path='/browse' element={<Browse />} />
                            <Route path='/transaction' element={<Transaction />} />
                            <Route path='/audit' element={<AuditTrail />} />
                            <Route path='/analytics' element={<Analytics />} />
                            <Route path='/map' element={<NurseMap />} />
                            <Route path='/reviews' element={<Reviews />} />
                            <Route path='*' element={<Navigate to='/browse' replace />} />
                        </Route>
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        </DataProvider>
    </ThemeProvider>
);
export default App;
