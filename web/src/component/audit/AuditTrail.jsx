import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
    alpha,
} from '@mui/material';
import { useSession } from '../../context/DataProvider';
import { API } from '../../service/api';
import useApi from '../../hooks/useApi';
import {
    hasSavedAuditRange,
    last30Days,
    loadAuditRange,
    saveAuditRange,
    thirtyDaysEnding,
    validRange,
} from '../../utils/dateRange';
import EmptyState from '../common/EmptyState';
import { dateTime, money } from '../../utils/format';
import { FieldValue, Heading, Pager, Panel, Restricted, State, Title } from '../common/Ui';
const AuditTrail = () => {
    const { session } = useSession();
    const [range, setRange] = useState(() => loadAuditRange(session.patient?.id));
    const [from, setFrom] = useState(range.start_date);
    const [to, setTo] = useState(range.end_date);
    const [page, setPage] = useState(1);
    const [validation, setValidation] = useState('');
    // true once the patient applied dates (now or earlier in this tab); then dates never move by themselves.
    const [chosen, setChosen] = useState(() => hasSavedAuditRange(session.patient?.id));
    const [shiftedTo, setShiftedTo] = useState('');
    const staff = session.actor.role !== 'patient';
    const resource = useApi(
        API.audit,
        { ...range, page, page_size: 10 },
        !!session.patient && !staff
    );
    const latestEntry = resource.data?.latest_entry_date;
    // Older demo data: when the default "last 30 days" is empty, open on the 30 days up to the
    // patient's newest entry instead of an empty ledger.
    useEffect(() => {
        if (chosen || !resource.data || resource.data.total !== 0) return;
        if (!latestEntry || latestEntry >= range.start_date) return;
        const next = thirtyDaysEnding(latestEntry);
        setRange(next);
        setFrom(next.start_date);
        setTo(next.end_date);
        setPage(1);
        setShiftedTo(latestEntry);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resource.data]);
    const apply = (event) => {
        event.preventDefault();
        if (!validRange({ start_date: from, end_date: to })) {
            setValidation('Choose both dates, with From on or before To.');
            return;
        }
        setValidation('');
        const next = { start_date: from, end_date: to };
        setRange(next);
        saveAuditRange(session.patient.id, next);
        setChosen(true);
        setShiftedTo('');
        setPage(1);
    };
    const clear = () => {
        const next = last30Days();
        setFrom(next.start_date);
        setTo(next.end_date);
        setRange(next);
        saveAuditRange(session.patient?.id, next);
        setChosen(true);
        setShiftedTo('');
        setPage(1);
        setValidation('');
    };
    const showLatest = () => {
        const next = thirtyDaysEnding(latestEntry);
        setFrom(next.start_date);
        setTo(next.end_date);
        setRange(next);
        saveAuditRange(session.patient?.id, next);
        setChosen(true);
        setShiftedTo('');
        setPage(1);
        setValidation('');
    };
    const data = resource.data;
    const heading = (
        <Heading
            title='Your HSA audit trail'
            subtitle='Read-only activity and the running balance after every entry.'
        />
    );
    if (staff)
        return (
            <>
                {heading}
                <Restricted
                    title='Clinic staff cannot access the audit trail'
                    message={`A patient's HSA ledger is private to that patient. Switch to a patient under "Acting as" in the header to see their entries.`}
                />
            </>
        );
    return (
        <>
            {heading}
            <Stack
                component='form'
                onSubmit={apply}
                direction={{ xs: 'column', md: 'row' }}
                sx={{ gap: 2, mb: 3, alignItems: { md: 'center' } }}
            >
                <Box sx={{ flex: 1, minWidth: 190 }} data-testid='audit-patient'>
                    <FieldValue
                        label='Patient in this session'
                        value={
                            session.patient
                                ? `${session.patient.name} · ${session.patient.id}`
                                : 'No patient in this session'
                        }
                    />
                </Box>
                <TextField
                    type='date'
                    label='From date (UTC)'
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                    type='date'
                    label='To date (UTC)'
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    error={!!validation}
                    helperText={validation}
                    slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button variant='contained' type='submit'>
                    Apply dates
                </Button>
                <Button variant='outlined' onClick={clear}>
                    Last 30 days
                </Button>
            </Stack>
            {session.patient && (
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                    Applied period (UTC): {range.start_date} to {range.end_date}.
                    {shiftedTo &&
                        ` No entries in the last 30 days, so this shows the 30 days up to the latest entry on ${shiftedTo}.`}
                    {(from !== range.start_date || to !== range.end_date) &&
                        ' Date edits are not applied yet; choose Apply dates to update the results.'}
                </Typography>
            )}
            {!session.patient ? (
                <Panel>
                    <EmptyState
                        title='Choose a patient'
                        message='Select a patient in the header to view their wallet activity.'
                    />
                </Panel>
            ) : (
                <>
                    <State resource={resource}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' },
                                gap: 2.5,
                                mb: 3,
                            }}
                        >
                            {[
                                [
                                    'Opening balance',
                                    money(data?.opening_balance),
                                    'Before the first entry in this period',
                                ],
                                [
                                    'Current HSA balance',
                                    money(data?.current_balance),
                                    'Latest saved patient balance',
                                ],
                                [
                                    'Number of entries',
                                    data?.total ?? 0,
                                    'Entries matching the selected date range',
                                ],
                            ].map(([label, value, caption], index) => (
                                <Panel
                                    key={label}
                                    sx={(theme) => ({
                                        ...(index === 1 && {
                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        }),
                                    })}
                                >
                                    <Typography color='text.secondary' sx={{ fontWeight: 600 }}>
                                        {label}
                                    </Typography>
                                    <Typography
                                        sx={{ fontSize: 32, fontWeight: 700, my: 1 }}
                                        color={index === 1 ? 'primary.main' : 'text.primary'}
                                    >
                                        {value}
                                    </Typography>
                                    <Typography variant='body2' color='text.secondary'>
                                        {caption}
                                    </Typography>
                                </Panel>
                            ))}
                        </Box>
                    </State>
                    <Panel>
                        <Title>Balance history</Title>
                        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                            Newest first · saved running balances · this ledger cannot be edited
                            here.
                        </Typography>
                        <State
                            resource={resource}
                            empty={data?.items.length === 0}
                            emptyMessage='No wallet activity was recorded for this patient during the selected period.'
                            emptyTitle='No activity for these dates'
                            emptyAction={
                                latestEntry && latestEntry < range.start_date
                                    ? { label: 'Show latest entries', onClick: showLatest }
                                    : { label: 'Last 30 days', onClick: clear }
                            }
                        >
                            <Box sx={{ overflowX: 'auto' }}>
                                <Table aria-label='HSA audit entries'>
                                    <TableHead>
                                        <TableRow>
                                            {[
                                                'Audit ID',
                                                'Timestamp (UTC)',
                                                'Action',
                                                'Amount',
                                                'Balance after',
                                            ].map((label) => (
                                                <TableCell key={label}>{label}</TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data?.items.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell>{row.id}</TableCell>
                                                <TableCell>{dateTime(row.timestamp)}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size='small'
                                                        color={
                                                            row.action_type === 'DEBIT'
                                                                ? 'error'
                                                                : 'primary'
                                                        }
                                                        variant='outlined'
                                                        label={row.action_type}
                                                    />
                                                </TableCell>
                                                <TableCell
                                                    sx={{
                                                        color:
                                                            row.action_type === 'DEBIT'
                                                                ? 'error.main'
                                                                : 'primary.main',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {row.action_type === 'DEBIT' ? '−' : '+'}
                                                    {money(row.amount_changed)}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>
                                                    {money(row.balance_after)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        </State>
                        <Pager
                            data={data}
                            page={page}
                            setPage={setPage}
                            disabled={resource.loading}
                        />
                    </Panel>
                </>
            )}
        </>
    );
};
export default AuditTrail;
