import EmptyState from '../common/EmptyState';
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography, alpha } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link } from 'react-router-dom';
import { useSession } from '../../context/DataProvider';
import { API } from '../../service/api';
import useApi from '../../hooks/useApi';
import { bookingKey, clearBookingKey } from '../../utils/bookingAttempt';
import { centsOf, dateTime, money, parseCopay } from '../../utils/format';
import { FieldValue, Heading, Panel, State, Title } from '../common/Ui';
const Transaction = () => {
    const { session, selectedClinic, updateBalance, refresh, loadSession } = useSession();
    const [copay, setCopay] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [uncertain, setUncertain] = useState(false);
    const [result, setResult] = useState(null);
    const locked = useRef(false);
    const alive = useRef(true);
    const attempt = useRef(null);
    const attemptDetails = useRef(null);
    const wallet = useApi(API.audit, { page: 1, page_size: 1 }, !!session.patient);
    const displayClinic =
        uncertain && attemptDetails.current
            ? attemptDetails.current.clinic
            : result
              ? {
                    id: result.appointment.clinic_id,
                    name: result.appointment.clinic_name,
                    is_accepting_patients: true,
                }
              : selectedClinic;
    const cents = parseCopay(copay);
    const balance = result?.balance_after ?? wallet.data?.current_balance;
    const insufficient = cents !== null && centsOf(balance) !== null && cents > centsOf(balance);
    const active = wallet.data?.has_active_appointment;
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const submit = async (event) => {
        event.preventDefault();
        if (locked.current) return;
        // Report the specific problem rather than one combined message.
        const problem = session.actor.role !== 'patient' || !session.patient
            ? 'Only patients can book. Switch to a patient in the header first.'
            : !displayClinic
              ? 'Choose a clinic in Browse or in the header before booking.'
              : !displayClinic.is_accepting_patients
                ? 'This clinic is not accepting patients. Choose another clinic in Browse.'
                : cents === null
                  ? 'Enter a positive copay with no more than two decimal places.'
                  : '';
        if (problem) {
            setError(problem);
            return;
        }
        if (insufficient) {
            setError('Your HSA balance is too low for this copay. Enter a lower amount.');
            return;
        }
        locked.current = true;
        setBusy(true);
        setError('');
        try {
            const fingerprint = `${session.patient.id}:${displayClinic.id}:${cents}`;
            attemptDetails.current = { clinic: displayClinic };
            attempt.current = await bookingKey(fingerprint);
            const response = await API.book(
                { clinic_id: displayClinic.id, copay_amount: (cents / 100).toFixed(2) },
                attempt.current.key
            );
            if (!alive.current) return;
            setResult(response);
            setUncertain(false);
            clearBookingKey(attempt.current);
            updateBalance(response.balance_after, session.patient.id);
            refresh();
        } catch (error) {
            if (!alive.current) return;
            setError(error.message);
            setUncertain(error.uncertain);
            if (!error.uncertain && error.code !== 'CSRF_FAILED') clearBookingKey(attempt.current);
        } finally {
            locked.current = false;
            if (alive.current) setBusy(false);
        }
    };
    const disabled =
        busy ||
        !!result ||
        session.actor.role !== 'patient' ||
        !session.patient ||
        !displayClinic?.is_accepting_patients ||
        !!active ||
        wallet.loading ||
        !!wallet.error;
    return (
        <>
            <Heading
                title='Book an appointment'
                subtitle='Confirm your clinic and copay. Your HSA charge and audit entry are saved together.'
            />
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '0.85fr 1.1fr' },
                    gap: 3,
                    alignItems: 'start',
                }}
            >
                <Panel component='form' onSubmit={submit}>
                    <Title>Booking details</Title>
                    {session.actor.role !== 'patient' && (
                        <Alert severity='info' sx={{ mb: 2 }}>
                            Only patients can book. Switch to a patient in the header first.
                        </Alert>
                    )}
                    <Stack sx={{ gap: 3 }}>
                        <TextField
                            label='Patient'
                            value={session.patient?.name || 'No patient in this session'}
                            slotProps={{ input: { readOnly: true } }}
                        />
                        <Box>
                            <Button
                                component={Link}
                                to='/browse'
                                size='small'
                                sx={{ float: 'right', mb: 1 }}
                            >
                                Change in Browse
                            </Button>
                            <TextField
                                fullWidth
                                label='Clinic'
                                value={
                                    displayClinic
                                        ? `${displayClinic.name} · ${displayClinic.id}`
                                        : 'Choose a clinic in Browse'
                                }
                                slotProps={{ input: { readOnly: true } }}
                            />
                        </Box>
                        <State resource={wallet}>
                            <Box
                                sx={(theme) => ({
                                    p: 2.5,
                                    borderRadius: 2,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                })}
                            >
                                <Typography color='primary.main' sx={{ fontWeight: 600 }}>
                                    Current HSA balance
                                </Typography>
                                <Typography
                                    sx={{ fontSize: 34, fontWeight: 700, mt: 1 }}
                                    color='primary.main'
                                >
                                    {money(balance)}
                                </Typography>
                            </Box>
                        </State>
                        <TextField
                            label='Copay amount'
                            value={copay}
                            onChange={(event) => setCopay(event.target.value)}
                            disabled={busy || !!result || uncertain}
                            error={!!copay && (cents === null || insufficient)}
                            helperText={
                                copay && cents === null
                                    ? 'Enter an amount greater than zero with up to two decimal places.'
                                    : insufficient
                                      ? 'This amount is higher than your HSA balance.'
                                      : 'Positive amount, up to two decimal places. Amounts use HSA account units.'
                            }
                            slotProps={{ htmlInput: { inputMode: 'decimal', maxLength: 13 } }}
                        />
                        {active && !result && (
                            <Alert severity='info'>
                                You already have an active visit. Clinic staff must discharge it
                                before another booking.
                            </Alert>
                        )}
                        <Button type='submit' variant='contained' disabled={disabled}>
                            {busy
                                ? 'Booking…'
                                : result || active
                                  ? 'Active visit: booking unavailable'
                                  : uncertain
                                    ? 'Retry the same booking'
                                    : 'Book appointment'}
                        </Button>
                        {uncertain && (
                            <Button component={Link} to='/browse'>
                                Check appointments before another booking
                            </Button>
                        )}
                    </Stack>
                </Panel>
                <Box>
                    <Title>Result</Title>
                    {error && (
                        <Alert
                            severity='error'
                            sx={{ mb: 2 }}
                            action={
                                <Button onClick={loadSession} color='inherit' size='small'>
                                    Refresh session
                                </Button>
                            }
                        >
                            {error}
                        </Alert>
                    )}
                    {result ? (
                        <Panel>
                            <Box
                                sx={(theme) => ({
                                    bgcolor: alpha(theme.palette.success.main, 0.12),
                                    color: theme.palette.success.main,
                                    p: 2,
                                    borderRadius: 2,
                                    mb: 3,
                                })}
                            >
                                <Stack direction='row' sx={{ gap: 1.5, alignItems: 'center' }}>
                                    <CheckCircleIcon />
                                    <Box>
                                        <Typography variant='h2'>Appointment booked</Typography>
                                        <Typography>
                                            {result.appointment.clinic_name} · Waiting
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Box>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' },
                                    gap: 2,
                                    mb: 3,
                                }}
                            >
                                <FieldValue label='Appointment ID' value={result.appointment.id} />
                                <FieldValue
                                    label='Balance before'
                                    value={money(result.balance_before)}
                                />
                                <FieldValue
                                    label='Balance after'
                                    value={money(result.balance_after)}
                                />
                            </Box>
                            <Title>Audit entry created by the trigger</Title>
                            {result.audit_log ? (
                                <Stack sx={{ gap: 1.5 }}>
                                    <FieldValue label='Audit ID' value={result.audit_log.id} />
                                    <Stack direction='row' sx={{ gap: 3, flexWrap: 'wrap' }}>
                                        <FieldValue
                                            label='Action'
                                            value={result.audit_log.action_type}
                                        />
                                        <FieldValue
                                            label='Amount'
                                            value={money(result.audit_log.amount_changed)}
                                        />
                                        <FieldValue
                                            label='Balance after'
                                            value={money(result.audit_log.balance_after)}
                                        />
                                    </Stack>
                                    <FieldValue
                                        label='Timestamp (UTC)'
                                        value={dateTime(result.audit_log.timestamp)}
                                    />
                                </Stack>
                            ) : (
                                <Alert severity='warning'>
                                    The backend did not return the trigger audit row. Check the
                                    transaction API contract.
                                </Alert>
                            )}
                            <Button
                                component={Link}
                                to='/audit'
                                variant='outlined'
                                endIcon={<ArrowForwardIcon />}
                                sx={{ mt: 3 }}
                            >
                                View audit trail
                            </Button>
                        </Panel>
                    ) : (
                        <Panel>
                            <EmptyState title='Your next step in care' message='Your booking outcome and the exact new audit entry will appear here after you book.' />
                        </Panel>
                    )}
                </Box>
            </Box>
        </>
    );
};
export default Transaction;
