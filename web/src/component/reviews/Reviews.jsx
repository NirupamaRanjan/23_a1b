import EmptyState from '../common/EmptyState';
import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Rating,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    Typography,
    alpha,
    styled,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { API } from '../../service/api';
import useApi from '../../hooks/useApi';
import { number } from '../../utils/format';
import { Panel, State } from '../common/Ui';
const Layout = styled(Box)(({ theme }) => ({
    flex: '1 1 0',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    gap: 10,
    [theme.breakpoints.down('sm')]: { gap: 8 },
}));
const ScrollArea = styled(Box)({
    minHeight: 0,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    overflowWrap: 'anywhere',
});
// Readable field names: known catalog fields get friendly labels, others are capitalised.
const FIELD_LABELS = { name: 'Medicine', strength: 'Strength', route: 'Route' };
const fieldLabel = (key, labels) => {
    if (labels && labels[key]) return labels[key];
    const text = String(key).replaceAll('_', ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
};
export const DocumentValue = ({ value, depth = 0, columns = 2, labels }) => {
    if (depth > 12)
        return (
            <Typography variant='body2' color='text.secondary'>
                This field is too deeply nested to display.
            </Typography>
        );
    if (value === null || value === undefined)
        return (
            <Typography variant='body2' color='text.secondary'>
                Not specified
            </Typography>
        );
    if (Array.isArray(value))
        return value.length ? (
            <Stack sx={{ gap: 0.7 }}>
                {value.map((item, index) => (
                    <Box key={index} sx={{ borderLeft: 2, borderColor: 'divider', pl: 1.2 }}>
                        <DocumentValue value={item} depth={depth + 1} />
                    </Box>
                ))}
            </Stack>
        ) : (
            <Typography variant='body2'>No items</Typography>
        );
    if (typeof value === 'object')
        return (
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: depth === 0 ? `repeat(${columns},minmax(0,1fr))` : '1fr',
                    },
                    gap: 1,
                }}
            >
                {Object.entries(value).map(([key, item]) => (
                    <Box key={key} sx={{ minWidth: 0 }}>
                        <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 600 }}>
                            {fieldLabel(key, labels)}
                        </Typography>
                        <DocumentValue value={item} depth={depth + 1} />
                    </Box>
                ))}
            </Box>
        );
    return (
        <Typography variant='body2' sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
        </Typography>
    );
};
const BarChart = ({ title, rows, labelKey, total }) => {
    const maximum = Math.max(1, ...rows.map((row) => number(row.count)));
    const share = (count) => (total ? Math.round((number(count) / total) * 100) : 0);
    return (
        <Panel sx={{ p: { xs: 1.5, md: 2 }, minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography component='h2' sx={{ mb: 1, flexShrink: 0, fontSize: { xs: 16, md: 18 }, lineHeight: 1.35, fontWeight: 600 }}>{title}</Typography>
            <ScrollArea sx={{ flex: 1 }}>
                <Stack sx={{ minHeight: '100%', justifyContent: 'space-evenly', gap: 0.5 }}>
                    {!rows.length && <EmptyState title='No tags available' message='Feedback tags will appear here when they are recorded.' compact />}
                    {rows.map((row, index) => (
                        <Stack
                            key={String(row[labelKey]) + index}
                            direction='row'
                            sx={{ alignItems: 'center', gap: { xs: 1, md: 1.5 }, minHeight: { xs: 22, md: 24 }, flexShrink: 0 }}
                        >
                            <Typography
                                variant='body2'
                                sx={{
                                    width: labelKey === 'rating' ? { xs: 52, md: 62 } : { xs: 110, md: 135 },
                                    fontSize: { xs: 14, md: 16 },
                                    flexShrink: 0,
                                    overflowWrap: 'anywhere',
                                }}
                            >
                                {labelKey === 'rating'
                                    ? `${row.rating} ${number(row.rating) === 1 ? 'star' : 'stars'}`
                                    : row.tag}
                            </Typography>
                            <Box
                                sx={(theme) => ({
                                    flex: 1,
                                    height: { xs: 14, md: 18 },
                                    minWidth: 16,
                                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                                    borderRadius: 1,
                                })}
                            >
                                <Box
                                    sx={{
                                        height: '100%',
                                        width: `${Math.min(100, (number(row.count) / maximum) * 100)}%`,
                                        bgcolor: 'primary.main',
                                        borderRadius: 1,
                                    }}
                                />
                            </Box>
                            <Typography
                                variant='body2'
                                sx={{
                                    width: total ? { xs: 84, md: 116 } : { xs: 40, md: 64 },
                                    flexShrink: 0,
                                    fontSize: { xs: 14, md: 16 },
                                    textAlign: 'right',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {number(row.count)}
                                {total ? (
                                    <Typography
                                        component='span'
                                        variant='body2'
                                        color='text.secondary'
                                        sx={{ fontSize: 'inherit' }}
                                    >
                                        {' '}
                                        · {share(row.count)}%
                                    </Typography>
                                ) : null}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
            </ScrollArea>
        </Panel>
    );
};
export const CatalogDocument = ({ record }) => {
    const readableSlots =
        Array.isArray(record.availability_slots) &&
        record.availability_slots.length > 0 &&
        record.availability_slots.every(
            (slot) =>
                slot &&
                typeof slot === 'object' &&
                !Array.isArray(slot) &&
                Object.keys(slot).every((key) => ['day', 'start', 'end'].includes(key))
        );
    const extras = Object.fromEntries(
        Object.entries(record).filter(
            ([key]) =>
                ![
                    'id',
                    '_id',
                    'specialty',
                    'physician',
                    'availability_slots',
                    'medication_details',
                ].includes(key)
        )
    );
    // The database id is reference information, so it sits with the other extra fields.
    if (record.id) extras.catalog_id = record.id;
    return (
        <>
            <Typography sx={{ fontWeight: 600, mb: 2, fontSize: { xs: 16, md: 20 } }}>
                {record.specialty || 'Unspecified specialty'}
                {record.physician && (
                    <Typography component='span' color='text.secondary' sx={{ fontWeight: 400 }}>
                        {' '}
                        · {String(record.physician)}
                    </Typography>
                )}
            </Typography>
            <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 2, lg: 3 } }}
            >
                <Box sx={{ p: { xs: 1.5, lg: 2.5 }, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant='body2' sx={{ fontWeight: 600, mb: 1.5 }}>
                        Medication details
                    </Typography>
                    <DocumentValue
                        value={record.medication_details}
                        columns={3}
                        labels={FIELD_LABELS}
                    />
                </Box>
                <Box sx={{ p: { xs: 1.5, lg: 2.5 }, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant='body2' sx={{ fontWeight: 600, mb: 1.5 }}>
                        Availability slots
                    </Typography>
                    {readableSlots ? (
                        <Table
                            size='small'
                            aria-label='Availability slots'
                            sx={{ '& td, & th': { px: { xs: 1, md: 1.5 }, py: { xs: 0.75, md: 1.25 }, fontSize: { xs: 14, md: 16, xl: 18 }, lineHeight: 1.5 } }}
                        >
                            <TableHead>
                                <TableRow>
                                    <TableCell>Day</TableCell>
                                    <TableCell>Start</TableCell>
                                    <TableCell>End</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {record.availability_slots.map((slot, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{slot.day}</TableCell>
                                        <TableCell>{slot.start}</TableCell>
                                        <TableCell>{slot.end}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <DocumentValue value={record.availability_slots} />
                    )}
                </Box>
            </Box>
            {Object.keys(extras).length > 0 && (
                <Box component='details' sx={{ mt: 2 }}>
                    <Typography
                        component='summary'
                        color='primary.main'
                        variant='body2'
                        sx={{ cursor: 'pointer', minHeight: 36, py: 0.5 }}
                    >
                        Additional fields
                    </Typography>
                    <DocumentValue value={extras} />
                </Box>
            )}
        </>
    );
};
const Reviews = () => {
    const theme = useTheme();
    const phone = useMediaQuery(theme.breakpoints.down('sm'));
    const short = useMediaQuery('(max-height: 740px)');
    const compact = phone || short;
    const [section, setSection] = useState('overview');
    const [specialty, setSpecialty] = useState('');
    const [page, setPage] = useState(1);
    const reviews = useApi(API.reviews);
    const specialties = useApi(API.specialties);
    const catalogs = useApi(API.catalogs, { specialty, page, page_size: 1 });
    const record = catalogs.data?.items?.[0];
    const data = reviews.data;
    const total = number(data?.total_reviews);
    const positive = (data?.rating_distribution || [])
        .filter((row) => number(row.rating) >= 4)
        .reduce((sum, row) => sum + number(row.count), 0);
    const positiveShare = total ? Math.round((positive / total) * 100) : 0;
    const summary = (
        <Panel
            sx={(theme) => ({
                p: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                flexShrink: 0,
            })}
        >
            <State
                resource={reviews}
                compact
                empty={data?.total_reviews === 0}
                emptyMessage='Patient feedback will appear here when reviews are available.'
                emptyTitle='Feedback is on its way'
            >
                <Stack
                    direction='row'
                    sx={{ gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}
                >
                    <Box>
                        <Typography variant='body2' color='primary.main' sx={{ fontWeight: 600 }}>
                            Overall average rating
                        </Typography>
                        <Stack direction='row' sx={{ alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontSize: 26, lineHeight: 1.2, fontWeight: 700 }}>
                                {number(data?.avg_rating).toFixed(2)}
                                <Typography
                                    component='span'
                                    color='text.secondary'
                                    sx={{ ml: 1, fontSize: 14 }}
                                >
                                    / 5
                                </Typography>
                            </Typography>
                            <Rating
                                value={number(data?.avg_rating)}
                                precision={0.1}
                                readOnly
                                size='small'
                                aria-label={`Average ${number(data?.avg_rating).toFixed(2)} out of 5 stars`}
                                sx={{ color: 'primary.main' }}
                            />
                        </Stack>
                    </Box>
                    <Box>
                        <Typography variant='body2' color='text.secondary'>
                            Satisfied patients
                        </Typography>
                        <Typography sx={{ fontSize: 26, lineHeight: 1.2, fontWeight: 700 }}>
                            {positiveShare}%
                            <Typography
                                component='span'
                                color='text.secondary'
                                sx={{ ml: 1, fontSize: 14 }}
                            >
                                rated 4–5 stars
                            </Typography>
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant='body2' color='text.secondary'>
                            Reviews
                        </Typography>
                        <Typography sx={{ fontWeight: 600 }}>
                            Based on {total.toLocaleString()} reviews from all clinics
                        </Typography>
                    </Box>
                </Stack>
            </State>
        </Panel>
    );
    const charts = (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
                minHeight: 0,
                flex: compact ? '1 1 0' : '0 0 clamp(166px, 23vh, 260px)',
            }}
        >
            <State
                resource={reviews}
                compact
                empty={data?.total_reviews === 0}
                emptyMessage='Charts will appear when reviews exist.'
                emptyTitle='No feedback to chart yet'
            >
                <BarChart
                    title='Rating distribution'
                    rows={data?.rating_distribution || []}
                    labelKey='rating'
                    total={total}
                />
                <BarChart
                    title='Top bedside-manner tags'
                    rows={data?.frequent_tags || []}
                    labelKey='tag'
                />
            </State>
        </Box>
    );
    const catalog = (
        <Panel
            sx={{
                p: { xs: 1.5, md: 2.5, xl: 3 },
                '@media (min-width: 600px) and (max-height: 850px)': { paddingBlock: 1 },
                '& .MuiTypography-body2': { fontSize: { xs: 14, md: 16, xl: 18 }, lineHeight: 1.6 },
                flex: '1 1 0',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
            }}
        >
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                sx={{
                    alignItems: { xs: 'stretch', md: 'center' },
                    gap: { xs: 0.75, md: 2 },
                    flexShrink: 0,
                }}
            >
                <Typography sx={{ fontWeight: 600, flexShrink: 0, fontSize: { xs: 16, md: 20 } }}>Medical catalog</Typography>
                {/* Specialty chips share the title row on wide screens to leave room for the entry. */}
                <Stack
                    direction='row'
                    role='group'
                    aria-label='Filter catalog by specialty'
                    sx={{ gap: 0.75, flex: 1, minWidth: 0, overflowX: 'auto', pb: 0.25 }}
                >
                    {[
                        { specialty: '', label: 'All' },
                        ...(specialties.data?.items || []).map((row) => ({
                            specialty: row.specialty,
                            label: row.specialty,
                        })),
                    ].map((chip) => (
                        <Chip
                            key={chip.specialty || 'all'}
                            label={chip.label}
                            size='small'
                            color='primary'
                            variant={specialty === chip.specialty ? 'filled' : 'outlined'}
                            aria-pressed={specialty === chip.specialty}
                            onClick={() => { setSpecialty(chip.specialty); setPage(1); }}
                            sx={{ flexShrink: 0 }}
                        />
                    ))}
                </Stack>
                <Typography
                    variant='body2'
                    color='text.secondary'
                    sx={{ fontSize: 14, flexShrink: 0, display: { xs: 'none', md: 'block' } }}
                >
                    Read-only reference
                </Typography>
            </Stack>
            <ScrollArea
                sx={{ flex: 1, pr: 0.5, pt: 1 }}
                data-testid='catalog-content'
                tabIndex={0}
                aria-label='Medical catalog document'
            >
                <State
                    resource={catalogs}
                    compact
                    empty={catalogs.data?.items.length === 0}
                    emptyMessage='No catalog entries for this specialty.'
                    emptyTitle='No references for this specialty'
                    emptyAction={{ label: 'Show all specialties', onClick: () => { setSpecialty(''); setPage(1); } }}
                >
                    {record && <CatalogDocument record={record} />}
                </State>
            </ScrollArea>
            <Stack direction='row' sx={{ alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Typography variant='body2' color='text.secondary' sx={{ flex: 1, fontSize: 12 }}>
                    Catalog entry {catalogs.data?.total ? page : 0} of {catalogs.data?.total ?? 0}
                </Typography>
                <Button
                    size='small'
                    variant='outlined'
                    disabled={page <= 1 || catalogs.loading}
                    onClick={() => setPage(page - 1)}
                    sx={{ minWidth: 0, px: 1, minHeight: { xs: 44, sm: 32 } }}
                >
                    Previous
                </Button>
                <Button
                    size='small'
                    variant='outlined'
                    disabled={page >= (catalogs.data?.pages || 1) || catalogs.loading}
                    onClick={() => setPage(page + 1)}
                    sx={{ minWidth: 0, px: 1, minHeight: { xs: 44, sm: 32 } }}
                >
                    Next
                </Button>
            </Stack>
        </Panel>
    );
    return (
        <Layout data-testid='reviews-screen'>
            <Box sx={{ flexShrink: 0 }}>
                <Typography
                    component='h1'
                    sx={{ fontSize: { xs: 23, sm: 29 }, lineHeight: 1.15, fontWeight: 700 }}
                >
                    Reviews and medical catalog
                </Typography>
                {!phone && (
                    <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                        Global feedback and flexible references on one screen.
                    </Typography>
                )}
            </Box>
            {compact && (
                <Tabs
                    value={section}
                    onChange={(_, value) => setSection(value)}
                    variant='fullWidth'
                    aria-label='Reviews sections'
                    sx={{ flexShrink: 0, minHeight: 44 }}
                >
                    <Tab label='Overview' value='overview' />
                    <Tab label='Charts' value='charts' />
                    <Tab label='Catalog' value='catalog' />
                </Tabs>
            )}
            {!compact ? (
                <>
                    {summary}
                    {charts}
                    {catalog}
                </>
            ) : section === 'overview' ? (
                <ScrollArea sx={{ flex: 1 }}>
                    {summary}
                    <Typography color='text.secondary' variant='body2' sx={{ mt: 2 }}>
                        Use Charts for rating distribution and feedback tags, or Catalog for the
                        medical reference.
                    </Typography>
                </ScrollArea>
            ) : section === 'charts' ? (
                charts
            ) : (
                catalog
            )}
        </Layout>
    );
};
export default Reviews;
