import { Box, Button, Stack, Typography } from '@mui/material';

// A local vector illustration: inherits the theme and needs no image/network request.
const EmptyState = ({ title = 'Nothing to show yet', message, action, compact = false }) => (
    <Stack role='status' data-testid='empty-state' sx={{
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        gap: compact ? 1 : 1.5, px: 2, py: compact ? 2 : { xs: 3, md: 5 },
        minHeight: compact ? 140 : 240, width: '100%', minWidth: 0, flex: '1 1 auto',
        gridColumn: '1 / -1', borderRadius: 2,
        bgcolor: 'action.hover', border: '1px dashed', borderColor: 'divider',
    }}>
        <Box component='svg' viewBox='0 0 180 120' aria-hidden='true' focusable='false'
            sx={{ width: compact ? 100 : 150, height: compact ? 68 : 100, color: 'primary.main', flexShrink: 0 }}>
            <ellipse cx='90' cy='106' rx='63' ry='7' fill='currentColor' opacity='.07' />
            <circle cx='90' cy='55' r='47' fill='currentColor' opacity='.07' />
            <rect x='55' y='24' width='69' height='77' rx='10' fill='white' stroke='currentColor' strokeWidth='2' />
            <rect x='75' y='18' width='29' height='12' rx='5' fill='currentColor' />
            <path d='M88 43v18m-9-9h18' stroke='currentColor' strokeWidth='4' strokeLinecap='round' />
            <path d='M69 74h31m-31 11h20' stroke='currentColor' strokeWidth='3' strokeLinecap='round' opacity='.3' />
            <circle cx='124' cy='82' r='16' fill='white' stroke='currentColor' strokeWidth='2.5' />
            <path d='m136 94 12 12' stroke='currentColor' strokeWidth='5' strokeLinecap='round' />
            <path d='M31 48h10m-5-5v10m102-30h8m-4-4v8' stroke='currentColor' strokeWidth='2' strokeLinecap='round' opacity='.4' />
        </Box>
        <Typography component='h3' sx={{ fontSize: compact ? 16 : 19, fontWeight: 600 }}>{title}</Typography>
        {message && <Typography variant='body2' color='text.secondary' sx={{ maxWidth: 370 }}>{message}</Typography>}
        {action?.onClick && <Button variant='outlined' onClick={action.onClick} disabled={action.disabled}>{action.label}</Button>}
    </Stack>
);
export default EmptyState;
