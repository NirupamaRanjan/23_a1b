import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSession } from '../../context/DataProvider';
import { API } from '../../service/api';
import useApi from '../../hooks/useApi';
import { dateTime, money, number, todayUTC } from '../../utils/format';
import { latestOrToday, last30Days, thirtyDaysEnding, validRange } from '../../utils/dateRange';
import EmptyState from '../common/EmptyState';
import { Heading, Pager, Panel, State, Title } from '../common/Ui';
const RevenueChart = ({ rows }) => {
    const theme = useTheme();
    const maximum = Math.max(1, ...rows.map((row) => number(row.moving_avg_7d)));
    const points = rows.map((row, index) => [
        65 + (index * 680) / Math.max(1, rows.length - 1),
        230 - (number(row.moving_avg_7d) * 180) / maximum,
    ]);
    const line = points.map((point) => point.join(',')).join(' ');
    return (
        <Box>
            <Box
                component='svg'
                viewBox='0 0 790 275'
                role='img'
                aria-label='Seven-day moving average of realized clinic copays. Exact values are available below.'
                sx={{ width: '100%', minHeight: 180, maxHeight: { xs: 350, lg: 440 } }}
            >
                {[0, 0.5, 1].map((scale) => (
                    <g key={scale}>
                        <line
                            x1='65'
                            y1={230 - scale * 180}
                            x2='745'
                            y2={230 - scale * 180}
                            stroke={theme.palette.divider}
                        />
                        <text
                            x='55'
                            y={235 - scale * 180}
                            textAnchor='end'
                            fill={theme.palette.text.secondary}
                            fontSize='13'
                        >
                            {money(scale * maximum)}
                        </text>
                    </g>
                ))}
                {points.length > 0 && (
                    <>
                        <polygon
                            points={`65,230 ${line} ${points.at(-1)[0]},230`}
                            fill={alpha(theme.palette.primary.main, 0.1)}
                        />
                        <polyline
                            points={line}
                            fill='none'
                            stroke={theme.palette.primary.main}
                            strokeWidth='3'
                        />
                        {points.map(([x, y], index) => (
                            <circle
                                key={index}
                                cx={x}
                                cy={y}
                                r='3'
                                fill={theme.palette.primary.main}
                            />
                        ))}
                        <text x='65' y='263' fill={theme.palette.text.secondary} fontSize='13'>
                            {rows[0].transaction_date}
                        </text>
                        <text
                            x='745'
                            y='263'
                            textAnchor='end'
                            fill={theme.palette.text.secondary}
                            fontSize='13'
                        >
                            {rows.at(-1).transaction_date}
                        </text>
                    </>
                )}
            </Box>
            <Box component='details' sx={{ mt: 1 }}>
                <Typography
                    component='summary'
                    color='primary.main'
                    sx={{ cursor: 'pointer', minHeight: 44, py: 1 }}
                >
                    Exact chart values
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Daily revenue</TableCell>
                                <TableCell>7-day average</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.transaction_date}>
                                    <TableCell>{row.transaction_date}</TableCell>
                                    <TableCell>{money(row.daily_total)}</TableCell>
                                    <TableCell>{money(row.moving_avg_7d)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            </Box>
        </Box>
    );
};
const Analytics = () => {
    const { selectedClinic, session } = useSession();
    const [from, setFrom] = useState(() => last30Days().start_date);
    const [to, setTo] = useState(() => last30Days().end_date);
    const [month, setMonth] = useState(todayUTC().slice(0, 7));
    const today = todayUTC();
    // Thirty days is the default view; all stored historical dates remain selectable.
    const [rankDate, setRankDate] = useState(today);
    // Fields the user changed keep their value; the others follow the recorded data.
    const [touched, setTouchedState] = useState({ dates: false, rank: false, month: false });
    // A ref mirrors it so the anchoring effect always sees the newest edits.
    const touchedRef = useRef(touched);
    const setTouched = (update) =>
        setTouchedState((value) => {
            const next = update(value);
            touchedRef.current = next;
            return next;
        });
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [retained, setRetained] = useState(null);
    const clinic = selectedClinic?.id;
    const context = useRef('');
    context.current = `${clinic}:${month}`;
    useEffect(() => {
        setRetained(null);
        setError('');
    }, [clinic, month]);
    // Seeded demo data stays at the dates it was generated, so "the last 30 days" and "today"
    // can be empty on an older database. The coverage call tells us the latest recorded dates.
    const coverage = useApi(API.coverage, { clinic_id: clinic }, true);
    // Queries wait until the dates have been moved to the latest data (or coverage failed).
    const [anchored, setAnchored] = useState(null);
    const ready = !coverage.loading && (!coverage.data || anchored === coverage.data);
    const latest = coverage.data?.latest_date || null;
    const chartEnd = latestOrToday(coverage.data?.clinic_latest_date || latest, today);
    const rankEnd = latestOrToday(latest, today);
    useEffect(() => {
        if (!coverage.data) return;
        const touched = touchedRef.current;
        if (!touched.dates) {
            const range = thirtyDaysEnding(chartEnd);
            setFrom(range.start_date);
            setTo(range.end_date);
        }
        if (!touched.rank) {
            setRankDate(rankEnd);
            setPage(1);
        }
        if (!touched.month) setMonth(chartEnd.slice(0, 7));
        setAnchored(coverage.data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coverage.data, chartEnd, rankEnd]);
    const showLatest = () => {
        const range = thirtyDaysEnding(chartEnd);
        setFrom(range.start_date);
        setTo(range.end_date);
        setTouched((value) => ({ ...value, dates: false }));
    };
    const datesValid = validRange({ start_date: from, end_date: to }) && to <= today;
    const series = useApi(
        API.revenue,
        { clinic_id: clinic, start_date: from, end_date: to },
        !!clinic && datesValid && ready
    );
    const ranking = useApi(
        API.ranking,
        { date: rankDate, page, page_size: 5 },
        !!rankDate && ready
    );
    const monthly = useApi(
        API.monthly,
        { clinic_id: clinic, month: month + '-01' },
        !!clinic && !!month && ready
    );
    const summary = retained || monthly.data;
    // Until the coverage answer arrives the queries wait, so show them as loading.
    const pending = (resource) => (ready ? resource : { ...resource, loading: true });
    const refresh = async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        const previous = summary;
        const current = context.current;
        setRetained(previous);
        try {
            await API.refreshMonthly();
            const latest = await API.monthly({
                clinic_id: clinic,
                month: month + '-01',
            });
            if (current === context.current) setRetained(latest);
        } catch (error) {
            if (current === context.current) {
                setRetained(previous);
                setError(error.message);
            }
        } finally {
            setBusy(false);
        }
    };
    return (
        <>
            <Heading
                title='Clinic analytics'
                subtitle={
                    selectedClinic
                        ? `${selectedClinic.name} · discharged appointments only`
                        : 'Choose a clinic in the header.'
                }
                action={
                    <TextField
                        type='month'
                        label='Month (UTC)'
                        value={month}
                        onChange={(event) => {
                            setMonth(event.target.value);
                            setTouched((value) => ({ ...value, month: true }));
                            setRetained(null);
                            setError('');
                        }}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                }
            />
            {latest && latest < today && (
                <Alert severity='info' sx={{ mb: 3 }} data-testid='analytics-latest-note'>
                    The most recent discharged revenue is on {latest}, so the dates below start from
                    the latest recorded data instead of today. Choose any earlier dates to look
                    further back.
                </Alert>
            )}
            {clinic ? (
                <>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2,1fr)',
                                lg: 'repeat(3,1fr)',
                            },
                            gap: 2,
                            mb: 3,
                        }}
                    >
                        <Panel>
                            <Typography color='text.secondary'>Monthly discharges</Typography>
                            <State
                                resource={pending({
                                    ...monthly,
                                    error: retained ? '' : monthly.error,
                                })}
                            >
                                <Typography sx={{ fontSize: 32, fontWeight: 700, my: 1 }}>
                                    {summary?.total_discharges ?? '—'}
                                </Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {month} · saved summary
                                </Typography>
                            </State>
                        </Panel>
                        <Panel>
                            <Typography color='text.secondary'>
                                Selected-period copay revenue
                            </Typography>
                            <State resource={pending(series)}>
                                <Typography sx={{ fontSize: 32, fontWeight: 700, my: 1 }}>
                                    {money(series.data?.total_copay_revenue)}
                                </Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {from} to {to} · discharged appointments
                                </Typography>
                            </State>
                        </Panel>
                        <Panel
                            sx={(theme) => ({
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                            })}
                        >
                            <Typography color='primary.main'>Last refreshed (UTC)</Typography>
                            <Typography sx={{ fontWeight: 600, my: 1 }}>
                                {dateTime(summary?.last_refreshed_at)}
                            </Typography>
                            <Button
                                variant='contained'
                                startIcon={<RefreshIcon />}
                                onClick={refresh}
                                disabled={busy || session.actor.role !== 'staff'}
                            >
                                {busy ? 'Refreshing…' : 'Refresh summary'}
                            </Button>
                            {session.actor.role !== 'staff' && (
                                <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                                    Switch to clinic staff in the header to refresh.
                                </Typography>
                            )}
                        </Panel>
                    </Box>
                    {error && (
                        <Alert severity='error' sx={{ mb: 2 }}>
                            {error} The previous summary and timestamp remain visible.
                        </Alert>
                    )}
                    <Panel sx={{ mb: 3 }}>
                        <Title>7-day moving average revenue</Title>
                        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, mb: 2 }}>
                            <TextField
                                type='date'
                                label='From (UTC)'
                                value={from}
                                onChange={(event) => {
                                    setFrom(event.target.value);
                                    setTouched((value) => ({ ...value, dates: true }));
                                }}
                                slotProps={{
                                    inputLabel: { shrink: true },
                                    htmlInput: { max: today },
                                }}
                            />
                            <TextField
                                type='date'
                                label='To (UTC)'
                                value={to}
                                onChange={(event) => {
                                    setTo(event.target.value);
                                    setTouched((value) => ({ ...value, dates: true }));
                                }}
                                slotProps={{
                                    inputLabel: { shrink: true },
                                    htmlInput: { max: today },
                                }}
                            />
                        </Stack>
                        {!datesValid ? (
                            <Alert severity='warning'>
                                Choose both dates on or before today, with From on or before To.
                            </Alert>
                        ) : (
                            <State
                                resource={pending(series)}
                                empty={series.data?.items.length === 0}
                                emptyMessage={
                                    latest
                                        ? `No discharged revenue in this period. The latest recorded revenue for this clinic is on ${chartEnd}.`
                                        : 'No discharged appointments are recorded yet. Clinic staff discharge visits in Browse → Appointments.'
                                }
                                emptyTitle='No revenue for these dates'
                                emptyAction={
                                    latest
                                        ? { label: 'Show latest 30 days', onClick: showLatest }
                                        : undefined
                                }
                            >
                                <Typography variant='body2' color='text.secondary'>
                                    Average of recorded revenue days within each seven-day window.
                                </Typography>
                                <RevenueChart rows={series.data?.items || []} />
                            </State>
                        )}
                    </Panel>
                </>
            ) : (
                <Panel sx={{ mb: 3 }}>
                    <EmptyState
                        title='Choose a clinic'
                        message='Select a clinic in the header to see its revenue and monthly summary.'
                    />
                </Panel>
            )}
            <Panel>
                <Title>Clinic ranking</Title>
                <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, mb: 2 }}>
                    <TextField
                        type='date'
                        label='Ranking date (UTC)'
                        value={rankDate}
                        onChange={(event) => {
                            setRankDate(event.target.value);
                            setTouched((value) => ({ ...value, rank: true }));
                            setPage(1);
                        }}
                        slotProps={{
                            inputLabel: { shrink: true },
                            htmlInput: { max: today },
                        }}
                    />
                </Stack>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                    {rankDate} · ranked by seven-day average; equal values share a rank.
                </Typography>
                <State
                    resource={pending(ranking)}
                    empty={!rankDate || ranking.data?.items.length === 0}
                    emptyMessage={
                        latest
                            ? `No discharged revenue on this date, so no clinics are ranked. The latest recorded revenue is on ${rankEnd}.`
                            : 'No discharged revenue is recorded yet, so no clinics are ranked.'
                    }
                    emptyTitle='No clinics to rank'
                    emptyAction={
                        latest && rankDate !== rankEnd
                            ? {
                                  label: 'Use latest recorded date',
                                  onClick: () => {
                                      setRankDate(rankEnd);
                                      setTouched((value) => ({ ...value, rank: false }));
                                      setPage(1);
                                  },
                              }
                            : undefined
                    }
                >
                    <Box sx={{ overflowX: 'auto' }}>
                        <Table aria-label='Clinic ranking'>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Rank</TableCell>
                                    <TableCell>Clinic</TableCell>
                                    <TableCell align='right'>7-day average</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {ranking.data?.items.map((row) => (
                                    <TableRow
                                        key={row.clinic_id}
                                        selected={row.clinic_id === clinic}
                                    >
                                        <TableCell>{row.rank_by_revenue}</TableCell>
                                        <TableCell>
                                            {row.clinic_name} · {row.clinic_id}
                                        </TableCell>
                                        <TableCell align='right'>
                                            {money(row.moving_avg_7d)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Box>
                </State>
                <Pager
                    data={ranking.data}
                    page={page}
                    setPage={setPage}
                    disabled={ranking.loading}
                />
            </Panel>
        </>
    );
};
export default Analytics;
