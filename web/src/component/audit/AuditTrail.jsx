import { useState } from 'react';
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
import { dateTime, money } from '../../utils/format';
import { FieldValue, Heading, Pager, Panel, State, Title } from '../common/Ui';
const AuditTrail = () => {
    const { session } = useSession();
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [range, setRange] = useState({});
    const [page, setPage] = useState(1);
    const [validation, setValidation] = useState('');
    const resource = useApi(API.audit, { ...range, page, page_size: 10 }, !!session.patient);
    const apply = (event) => {
        event.preventDefault();
        if (from && to && from > to) {
            setValidation('The From date must not be after the To date.');
            return;
        }
        setValidation('');
        setRange({ start_date: from, end_date: to });
        setPage(1);
    };
    const clear = () => {
        setFrom('');
        setTo('');
        setRange({});
        setPage(1);
        setValidation('');
    };
    const data = resource.data;
    return (
        <>
            <Heading
                title='Your HSA audit trail'
                subtitle='Read-only activity and the running balance after every entry.'
            />
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
                    Clear dates
                </Button>
            </Stack>
            {!session.patient ? (
                <Panel>
                    <Typography>No patient is associated with this session.</Typography>
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
                            Oldest first · saved running balances · this ledger cannot be edited
                            here.
                        </Typography>
                        <State
                            resource={resource}
                            empty={data?.items.length === 0}
                            emptyMessage='No audit entries in this date range.'
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
