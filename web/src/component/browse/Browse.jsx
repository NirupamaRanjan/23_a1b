import EmptyState from '../common/EmptyState';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    MenuItem,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography,
    alpha,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import { API } from '../../service/api';
import { useSession } from '../../context/DataProvider';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import { dateTime, money } from '../../utils/format';
import { FieldValue, Heading, Pager, Panel, State, Status, Title } from '../common/Ui';
const ENTITIES = ['patients', 'clinics', 'appointments'];
const Browse = () => {
    const { session, setSelectedClinic, refresh } = useSession();
    const [entity, setEntity] = useState('clinics');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const alive = useRef(true);
    const q = useDebounce(search);
    // A patient's Patients tab only ever contains their own record, so it has no search box.
    const showSearch = !(entity === 'patients' && session?.actor?.role === 'patient');
    const showControls = showSearch || entity !== 'patients';
    const navigate = useNavigate();
    const browse = useRef((params, options) =>
        API.browse(params.entity, params.query, options)
    ).current;
    const getDetail = useRef((params, options) =>
        API.detail(params.entity, params.id, options)
    ).current;
    const records = useApi(browse, {
        entity,
        query: {
            q: showSearch ? q : '',
            page,
            page_size: 5,
            ...(entity === 'clinics' && filter !== '' ? { accepting: filter } : {}),
            ...(entity === 'appointments' && filter ? { status: filter } : {}),
        },
    });
    const detail = useApi(getDetail, { entity, id: selectedId }, !!selectedId);
    const record = detail.data;
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const selectEntity = (_, value) => {
        setEntity(value);
        setSearch('');
        setFilter('');
        setPage(1);
        setSelectedId(null);
        setError('');
    };
    const changeStatus = async (status) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await API.status(record.id, { status, expected_status: record.status });
            if (alive.current) {
                detail.retry();
                refresh();
            }
        } catch (error) {
            if (alive.current) {
                setError(error.message);
                if (error.status === 409) detail.retry();
            }
        } finally {
            if (alive.current) setBusy(false);
        }
    };
    const bookHere = () => {
        setSelectedClinic(record);
        navigate('/transaction');
    };
    const options =
        entity === 'clinics'
            ? [
                  ['', 'All clinics'],
                  ['true', 'Accepting patients'],
                  ['false', 'Not accepting'],
              ]
            : [
                  ['', 'All statuses'],
                  ['WAITING', 'Waiting'],
                  ['IN_CONSULTATION', 'In consultation'],
                  ['DISCHARGED', 'Discharged'],
              ];
    return (
        <>
            <Heading
                title='Browse care records'
                subtitle='Find patients, clinics and appointments. Details stay on this screen.'
            />
            <Panel>
                <Tabs
                    value={entity}
                    onChange={selectEntity}
                    aria-label='Entity'
                    variant='scrollable'
                    scrollButtons='auto'
                    sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
                >
                    {ENTITIES.map((value) => (
                        <Tab
                            key={value}
                            value={value}
                            label={value[0].toUpperCase() + value.slice(1)}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                        />
                    ))}
                </Tabs>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' },
                        gap: 3,
                        alignItems: 'start',
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        {showControls && (
                            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, mb: 3 }}>
                                {showSearch && (
                                    <TextField
                                        fullWidth
                                        label={`Search ${entity} by name or ID`}
                                        value={search}
                                        onChange={(event) => {
                                            setSearch(event.target.value);
                                            setPage(1);
                                            setSelectedId(null);
                                        }}
                                        slotProps={{ htmlInput: { maxLength: 120 } }}
                                    />
                                )}
                                {entity !== 'patients' && (
                                    <TextField
                                        select
                                        label='Filter'
                                        value={filter}
                                        onChange={(event) => {
                                            setFilter(event.target.value);
                                            setPage(1);
                                            setSelectedId(null);
                                        }}
                                        sx={{ minWidth: 185 }}
                                    >
                                        {options.map(([value, label]) => (
                                            <MenuItem value={value} key={value}>
                                                {label}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            </Stack>
                        )}
                        <State
                            resource={records}
                            empty={records.data?.items.length === 0}
                            emptyMessage='No records match your search.'
                            emptyAction={{ label: 'Clear filters', onClick: () => { setSearch(''); setFilter(''); setPage(1); setSelectedId(null); } }}
                        >
                            <Box sx={{ overflowX: 'auto' }}>
                                <Table aria-label={`${entity} records`}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>
                                                {entity === 'appointments'
                                                    ? 'Visit / patient'
                                                    : 'Name'}
                                            </TableCell>
                                            <TableCell>ID</TableCell>
                                            <TableCell>
                                                {entity === 'patients'
                                                    ? 'HSA balance'
                                                    : entity === 'clinics'
                                                      ? 'Availability'
                                                      : 'Status'}
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {records.data?.items.map((item) => (
                                            <TableRow
                                                key={item.id}
                                                selected={selectedId === item.id}
                                                sx={(theme) => ({
                                                    '&.Mui-selected': {
                                                        bgcolor: alpha(
                                                            theme.palette.primary.main,
                                                            0.1
                                                        ),
                                                    },
                                                })}
                                            >
                                                <TableCell>
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedId(item.id);
                                                            setError('');
                                                        }}
                                                        aria-label={`View details: ${item.name || item.patient_name}`}
                                                        sx={{
                                                            color: 'text.primary',
                                                            justifyContent: 'flex-start',
                                                            textAlign: 'left',
                                                            px: 0,
                                                        }}
                                                    >
                                                        {item.name || item.patient_name}
                                                    </Button>
                                                    {entity === 'appointments' && (
                                                        <Typography
                                                            variant='body2'
                                                            color='text.secondary'
                                                        >
                                                            {item.clinic_name}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>{item.id}</TableCell>
                                                <TableCell>
                                                    {entity === 'patients' ? (
                                                        money(item.hsa_balance)
                                                    ) : entity === 'clinics' ? (
                                                        <Typography
                                                            color={
                                                                item.is_accepting_patients
                                                                    ? 'primary.main'
                                                                    : 'text.secondary'
                                                            }
                                                        >
                                                            {item.is_accepting_patients
                                                                ? 'Accepting'
                                                                : 'Not accepting'}
                                                        </Typography>
                                                    ) : (
                                                        <Status value={item.status} />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        </State>
                        <Pager
                            data={records.data}
                            page={page}
                            setPage={(value) => {
                                setPage(value);
                                setSelectedId(null);
                            }}
                            disabled={records.loading}
                        />
                    </Box>
                    <Panel sx={{ minHeight: 320 }}>
                        <Title>
                            Selected{' '}
                            {entity === 'clinics'
                                ? 'clinic'
                                : entity === 'patients'
                                  ? 'patient'
                                  : 'appointment'}
                        </Title>
                        {!selectedId ? (
                            <EmptyState title='Your care records, at a glance' message='Select a record from the list to see its details here.' />
                        ) : (
                            <State
                                resource={{
                                    ...detail,
                                    loading:
                                        detail.loading ||
                                        (!detail.error &&
                                            !!selectedId &&
                                            record?.id !== selectedId),
                                }}
                            >
                                <Stack sx={{ gap: 2.5 }}>
                                    <Typography variant='h2'>
                                        {record?.name || `Appointment #${record?.id}`}
                                    </Typography>
                                    <FieldValue label='ID' value={record?.id} />
                                    {entity === 'clinics' ? (
                                        <>
                                            <Status
                                                value={
                                                    record?.is_accepting_patients
                                                        ? 'Accepting patients'
                                                        : 'Not accepting patients'
                                                }
                                            />
                                            <Stack direction='row' sx={{ gap: 3 }}>
                                                <FieldValue
                                                    label='Latitude'
                                                    value={record?.latitude}
                                                />
                                                <FieldValue
                                                    label='Longitude'
                                                    value={record?.longitude}
                                                />
                                            </Stack>
                                            <Button
                                                variant='contained'
                                                disabled={!record?.is_accepting_patients}
                                                endIcon={<ArrowForwardIcon />}
                                                onClick={bookHere}
                                            >
                                                Book at this clinic
                                            </Button>
                                        </>
                                    ) : entity === 'patients' ? (
                                        <>
                                            <FieldValue
                                                label='HSA balance'
                                                value={money(record?.hsa_balance)}
                                            />
                                            <Typography variant='body2' color='text.secondary'>
                                                Audit Trail always follows the patient in your
                                                current session.
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <FieldValue
                                                label='Patient'
                                                value={`${record?.patient_name} · ${record?.patient_id}`}
                                            />
                                            <FieldValue
                                                label='Clinic'
                                                value={`${record?.clinic_name} · ${record?.clinic_id}`}
                                            />
                                            <FieldValue
                                                label='Copay'
                                                value={money(record?.copay_amount)}
                                            />
                                            <FieldValue
                                                label='Booked (UTC)'
                                                value={dateTime(record?.created_at)}
                                            />
                                            <Status value={record?.status} />
                                            {error && <Alert severity='error'>{error}</Alert>}
                                            {session.actor.role === 'staff' &&
                                            record?.status !== 'DISCHARGED' ? (
                                                <Button
                                                    variant='contained'
                                                    disabled={busy || !record?.can_update_status}
                                                    onClick={() =>
                                                        changeStatus(
                                                            record.status === 'WAITING'
                                                                ? 'IN_CONSULTATION'
                                                                : 'DISCHARGED'
                                                        )
                                                    }
                                                >
                                                    {busy
                                                        ? 'Updating…'
                                                        : record?.status === 'WAITING'
                                                          ? 'Start consultation'
                                                          : 'Discharge appointment'}
                                                </Button>
                                            ) : (
                                                <Typography color='text.secondary'>
                                                    {record?.status === 'DISCHARGED'
                                                        ? 'This visit is complete.'
                                                        : 'Clinic staff update this status.'}
                                                </Typography>
                                            )}
                                        </>
                                    )}
                                </Stack>
                            </State>
                        )}
                    </Panel>
                </Box>
            </Panel>
        </>
    );
};
export default Browse;
