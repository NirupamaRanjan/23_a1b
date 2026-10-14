import { useEffect, useState } from 'react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    LinearProgress,
    Popover,
    Stack,
    TextField,
    Typography,
    styled,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../context/DataProvider';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import { API } from '../../service/api';
import { Pager, Panel, State } from '../common/Ui';

const Page = styled(Box, { shouldForwardProp: (prop) => prop !== 'fit' })(({ theme, fit }) => ({
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100dvh',
    ...(fit && { height: '100dvh', minHeight: 0, overflow: 'hidden' }),
    background: theme.palette.background.default,
}));
const Header = styled(Box)(({ theme }) => ({
    flexShrink: 0,
    background: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: '20px 36px',
    [theme.breakpoints.down('sm')]: { padding: '10px 16px' },
}));
const Navigation = styled(Box)(({ theme }) => ({
    flexShrink: 0,
    background: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    overflowX: 'auto',
    padding: '0 24px',
    '& a': {
        textDecoration: 'none',
        color: theme.palette.text.secondary,
        padding: '18px 18px 15px',
        minHeight: 48,
        whiteSpace: 'nowrap',
        borderBottom: '3px solid transparent',
    },
    '& a.active': {
        color: theme.palette.primary.main,
        fontWeight: 700,
        borderBottomColor: theme.palette.primary.main,
    },
    '& a:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: -3,
    },
    [theme.breakpoints.down('sm')]: {
        padding: '0 4px',
        '& a': { padding: '12px 12px 9px' },
    },
}));
const Main = styled(Box, { shouldForwardProp: (prop) => prop !== 'fit' })(({ theme, fit }) => ({
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    padding: fit ? '18px 40px 16px' : '36px 64px',
    flex: fit ? '1 1 0' : '1 0 auto',
    minHeight: 0,
    ...(fit && {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    }),
    [theme.breakpoints.down('md')]: {
        padding: fit ? '12px 24px' : '28px 24px',
    },
    [theme.breakpoints.down('sm')]: { padding: fit ? '8px 16px' : '24px 16px' },
}));
const NAVIGATION = [
    ['Browse', '/browse'],
    ['Transaction', '/transaction'],
    ['Audit trail', '/audit'],
    ['Analytics', '/analytics'],
    ['Map', '/map'],
    ['Reviews', '/reviews'],
];
const listClinics = (params, options) => API.browse('clinics', params, options);

const ActorSwitcher = ({ compact = false }) => {
    const { session, loading, switchActor } = useSession();
    const [anchor, setAnchor] = useState(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const q = useDebounce(search);
    const actors = useApi(API.actors, { q, page, page_size: 5 }, !!anchor && !!session?.demo_mode);
    const label = session
        ? `${session.actor.role === 'staff' ? 'Clinic staff' : 'Patient'}: ${session.actor.name}`
        : 'Session unavailable';
    return (
        <Box sx={{ minWidth: compact ? { xs: 0, sm: 240 } : 240, flex: '1 1 240px' }}>
            <Typography
                variant='body2'
                color='text.secondary'
                sx={{
                    mb: compact ? 0.4 : 0.6,
                    fontSize: compact ? 12 : 14,
                    lineHeight: compact ? '18px' : undefined,
                    fontWeight: 600,
                    ...(compact && { display: { xs: 'none', sm: 'block' } }),
                }}
            >
                Acting as{session?.demo_mode ? ' (demo)' : ''}
            </Typography>
            <Button
                aria-label='Choose demo actor'
                variant='outlined'
                endIcon={session?.demo_mode ? <ExpandMoreIcon /> : undefined}
                disabled={!session?.demo_mode || loading}
                onClick={(event) => setAnchor(event.currentTarget)}
                sx={{
                    width: '100%',
                    justifyContent: 'space-between',
                    color: 'text.primary',
                    borderColor: 'divider',
                    minHeight: 48,
                }}
            >
                <Typography
                    component='span'
                    noWrap
                    sx={{
                        minWidth: 0,
                        flex: 1,
                        textAlign: 'left',
                        fontSize: compact ? { xs: 12, sm: 14 } : 14,
                    }}
                >
                    {label}
                </Typography>
            </Button>
            <Popover
                open={!!anchor}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                slotProps={{
                    paper: { sx: { p: 2, width: 370, maxWidth: 'calc(100vw - 32px)' } },
                }}
            >
                <TextField
                    label='Search permitted actors'
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                />
                <State
                    resource={actors}
                    empty={actors.data?.items.length === 0}
                    emptyMessage='No permitted actors match this search.'
                >
                    <Stack sx={{ gap: 1, mt: 2 }}>
                        {actors.data?.items.map((actor) => (
                            <Button
                                key={`${actor.role}:${actor.id}`}
                                variant='outlined'
                                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                                onClick={async () => {
                                    setAnchor(null);
                                    await switchActor(actor);
                                }}
                            >
                                {actor.role === 'staff' ? 'Clinic staff' : 'Patient'}: {actor.name}
                            </Button>
                        ))}
                    </Stack>
                </State>
                <Pager data={actors.data} page={page} setPage={setPage} disabled={actors.loading} />
            </Popover>
        </Box>
    );
};
const ClinicSelector = () => {
    const { selectedClinic, setSelectedClinic, session } = useSession();
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const q = useDebounce(input);
    const resource = useApi(listClinics, { q, page_size: 10, page: 1 }, open);
    const rows = resource.data?.items || [];
    const options =
        selectedClinic && !rows.some((row) => row.id === selectedClinic.id)
            ? [selectedClinic, ...rows]
            : rows;
    return (
        <Box sx={{ minWidth: 260, flex: '1.2 1 260px' }}>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 0.6, fontWeight: 600 }}>
                Selected clinic
            </Typography>
            <Autocomplete
                disabled={!session}
                disableClearable={Boolean(selectedClinic)}
                value={selectedClinic}
                options={options}
                filterOptions={(values) => values}
                loading={resource.loading && open}
                getOptionLabel={(clinic) => `${clinic.name} (${clinic.id})`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                onInputChange={(_, value, reason) => {
                    if (reason === 'input') setInput(value);
                }}
                onChange={(_, clinic) => setSelectedClinic(clinic)}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        aria-label='Selected clinic'
                        placeholder='Choose a clinic'
                    />
                )}
                noOptionsText={
                    resource.error
                        ? 'Could not load clinics. Close and retry.'
                        : 'No matching clinics'
                }
            />
        </Box>
    );
};
const Shell = () => {
    const { actorKey, session, loading, error, loadSession } = useSession();
    const location = useLocation();
    const fit = location.pathname === '/reviews';
    useEffect(() => {
        if (!fit) window.scrollTo(0, 0);
    }, [location.pathname, fit]);
    return (
        <Page fit={fit} data-reviews-layout={fit ? 'true' : undefined}>
            <Header sx={fit ? { py: { xs: 1, sm: 0.75 } } : undefined}>
                <Stack
                    direction='row'
                    sx={{
                        alignItems: 'center',
                        gap: fit ? { xs: 1, sm: 3 } : 3,
                        flexWrap: fit ? { xs: 'nowrap', sm: 'wrap' } : 'wrap',
                    }}
                >
                    <Stack direction='row' sx={{ alignItems: 'center', gap: 1.5, mr: 'auto' }}>
                        <Box
                            sx={{
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                p: 0.75,
                                display: 'flex',
                                borderRadius: 2,
                            }}
                        >
                            <AddIcon sx={{ fontSize: 28 }} />
                        </Box>
                        <Typography
                            sx={{ fontSize: { xs: fit ? 15 : 20, md: 25 }, fontWeight: 700 }}
                        >
                            CareConnect
                        </Typography>
                    </Stack>
                    <Stack
                        direction='row'
                        sx={{
                            gap: 2,
                            minWidth: 0,
                            flex: fit ? '1 1 0' : undefined,
                            width: { xs: fit ? 'auto' : '100%', md: 650 },
                            flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        }}
                    >
                        <ActorSwitcher compact={fit} />
                        <Box
                            sx={{
                                display: fit ? { xs: 'none', sm: 'contents' } : 'contents',
                            }}
                        >
                            <ClinicSelector />
                        </Box>
                    </Stack>
                </Stack>
            </Header>
            <Navigation
                sx={fit ? { '& a': { pt: 1.25, pb: 1.25 } } : undefined}
                component='nav'
                aria-label='Main navigation'
            >
                {NAVIGATION.map(([label, path]) => (
                    <NavLink key={path} to={path}>
                        {label}
                    </NavLink>
                ))}
            </Navigation>
            <Main fit={fit} component='main' key={actorKey || 'session'}>
                {!session && loading ? (
                    <Panel>
                        <LinearProgress />
                        <Typography sx={{ mt: 2 }}>Loading your session…</Typography>
                    </Panel>
                ) : !session ? (
                    <Panel>
                        <Alert severity='error'>{error || 'No session is available.'}</Alert>
                        <Button onClick={loadSession} sx={{ mt: 2 }}>
                            Refresh session
                        </Button>
                    </Panel>
                ) : (
                    <>
                        {loading && <LinearProgress sx={{ mb: 2 }} aria-label='Updating session' />}
                        <Outlet />
                    </>
                )}
            </Main>
            {!fit && (
                <Typography
                    component='footer'
                    variant='body2'
                    color='text.secondary'
                    sx={{ px: { xs: 2, md: 8 }, pb: 3 }}
                >
                    Amounts use HSA account units. Dates and times are shown in UTC.
                </Typography>
            )}
        </Page>
    );
};
export default Shell;
