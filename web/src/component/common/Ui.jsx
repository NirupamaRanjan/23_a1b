import EmptyState from './EmptyState';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    LinearProgress,
    Paper,
    Stack,
    Typography,
    styled,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
export const Panel = styled(Paper)(({ theme }) => ({
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    padding: 24,
    boxShadow: 'none',
    minWidth: 0,
    [theme.breakpoints.down('sm')]: { padding: 16 },
}));
export const Heading = ({ title, subtitle, action }) => (
    <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
            mb: 3,
            gap: 1.5,
            justifyContent: 'space-between',
            alignItems: { sm: 'center' },
            flexShrink: 0,
        }}
    >
        <Box>
            <Typography variant='h1'>{title}</Typography>
            {subtitle && (
                <Typography color='text.secondary' sx={{ mt: 0.75 }}>
                    {subtitle}
                </Typography>
            )}
        </Box>
        {action}
    </Stack>
);
export const Title = ({ children, action }) => (
    <Stack
        direction='row'
        sx={{
            mb: 2,
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
        }}
    >
        <Typography variant='h2'>{children}</Typography>
        {action}
    </Stack>
);
export const FieldValue = ({ label, value }) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
            {label}
        </Typography>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{value ?? '—'}</Typography>
    </Box>
);
export const STATUS_LABELS = {
    WAITING: 'Waiting',
    IN_CONSULTATION: 'In consultation',
    DISCHARGED: 'Discharged',
};
export const Status = ({ value }) => (
    <Chip
        size='small'
        label={STATUS_LABELS[value] || value || '—'}
        sx={(theme) => ({
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.main,
            fontWeight: 600,
        })}
    />
);
// Replaces a screen the current actor may not use (for example clinic staff on patient-only screens).
export const Restricted = ({ title, message }) => {
    const navigate = useNavigate();
    return (
        <Panel data-testid='restricted'>
            <EmptyState
                title={title}
                message={message}
                action={{ label: 'Go to Browse', onClick: () => navigate('/browse') }}
            />
        </Panel>
    );
};
export const State = ({
    resource,
    empty = false,
    emptyMessage = 'No records available.',
    emptyTitle = 'No matching results',
    emptyAction,
    children,
    compact = false,
}) => {
    if (resource.loading)
        return (
            <Box aria-busy='true' role='status' sx={{ py: compact ? 1 : 3 }}>
                <LinearProgress />
                <Typography sx={{ mt: 1 }} color='text.secondary'>
                    Loading…
                </Typography>
            </Box>
        );
    if (resource.error)
        return (
            <Alert
                severity='error'
                action={
                    <Button color='inherit' size='small' onClick={resource.retry}>
                        Retry
                    </Button>
                }
            >
                {resource.error}
            </Alert>
        );
    if (empty)
        return (
            <EmptyState
                title={emptyTitle}
                message={emptyMessage}
                action={emptyAction}
                compact={compact}
            />
        );
    return children;
};
export const Pager = ({ data, page, setPage, disabled = false }) => {
    const pages = Math.max(1, Number(data?.pages) || 1);
    return (
        <Stack direction='row' sx={{ mt: 2, gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant='body2' color='text.secondary' sx={{ flex: 1 }}>
                Page {page} of {pages} · {data?.total ?? 0} records
            </Typography>
            <Button
                variant='outlined'
                disabled={disabled || page <= 1}
                onClick={() => setPage(page - 1)}
            >
                Previous
            </Button>
            <Button
                variant='outlined'
                disabled={disabled || page >= pages}
                onClick={() => setPage(page + 1)}
            >
                Next
            </Button>
        </Stack>
    );
};
