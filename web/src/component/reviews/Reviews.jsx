import { useEffect, useState } from 'react';
import {
    Box,
    Button,
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
    styled,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { API } from '../../service/api';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
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
export const DocumentValue = ({ value, depth = 0, columns = 2 }) => {
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
                            {key.replaceAll('_', ' ')}
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
const BarChart = ({ title, rows, labelKey }) => {
    const maximum = Math.max(1, ...rows.map((row) => number(row.count)));
    return (
        <Panel sx={{ p: 1.5, minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ mb: 0.75, flexShrink: 0, fontWeight: 600 }}>{title}</Typography>
            <ScrollArea sx={{ flex: 1 }}>
                <Stack sx={{ gap: 0.4 }}>
                    {rows.map((row, index) => (
                        <Stack
                            key={String(row[labelKey]) + index}
                            direction='row'
                            sx={{ alignItems: 'center', gap: 1.25, minHeight: 20 }}
                        >
                            <Typography
                                variant='body2'
                                sx={{
                                    width: labelKey === 'rating' ? 52 : 125,
                                    flexShrink: 0,
                                    overflowWrap: 'anywhere',
                                }}
                            >
                                {labelKey === 'rating' ? `${row.rating} stars` : row.tag}
                            </Typography>
                            <Box
                                sx={(theme) => ({
                                    flex: 1,
                                    height: 12,
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
                                sx={{ width: 40, textAlign: 'right', fontWeight: 600 }}
                            >
                                {number(row.count)}
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
                !['id', '_id', 'specialty', 'availability_slots', 'medication_details'].includes(
                    key
                )
        )
    );
    return (
        <>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 0.2, fontSize: 12 }}>
                Document ID: {record.id}
            </Typography>
            <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
            >
                <Box>
                    <Typography variant='body2' sx={{ fontWeight: 600, mb: 0.5 }}>
                        Medication details
                    </Typography>
                    <DocumentValue value={record.medication_details} columns={3} />
                </Box>
                <Box>
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        Availability slots
                    </Typography>
                    {readableSlots ? (
                        <Table
                            size='small'
                            aria-label='Availability slots'
                            sx={{ '& td, & th': { px: 1, py: 0.2, fontSize: 12 } }}
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
                <Box component='details' sx={{ mt: 0.25 }}>
                    <Typography
                        component='summary'
                        color='primary.main'
                        variant='body2'
                        sx={{ cursor: 'pointer', minHeight: 24, py: 0 }}
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
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const q = useDebounce(query);
    const reviews = useApi(API.reviews);
    const catalogs = useApi(API.catalogs, { q, page, page_size: 1 });
    const record = catalogs.data?.items?.[0];
    const data = reviews.data;
    useEffect(() => {
        setPage(1);
    }, [q]);
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
                emptyMessage='No reviews available.'
            >
                <Stack
                    direction='row'
                    sx={{ gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}
                >
                    <Box>
                        <Typography variant='body2' color='primary.main' sx={{ fontWeight: 600 }}>
                            Overall average rating
                        </Typography>
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
                    </Box>
                    <Box>
                        <Typography variant='body2' color='text.secondary'>
                            Review count
                        </Typography>
                        <Typography sx={{ fontSize: 26, lineHeight: 1.2, fontWeight: 700 }}>
                            {data?.total_reviews ?? '—'}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant='body2' color='text.secondary'>
                            Scope
                        </Typography>
                        <Typography sx={{ fontWeight: 600 }}>All PatientReviews</Typography>
                    </Box>
                </Stack>
            </State>
        </Panel>
    );
    const charts = (
        <State
            resource={reviews}
            compact
            empty={data?.total_reviews === 0}
            emptyMessage='Charts will appear when reviews exist.'
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.5,
                    minHeight: 0,
                    flex: compact ? '1 1 0' : '0 0 166px',
                }}
            >
                <BarChart
                    title='Rating distribution'
                    rows={data?.rating_distribution || []}
                    labelKey='rating'
                />
                <BarChart
                    title='Top bedside-manner tags'
                    rows={data?.frequent_tags || []}
                    labelKey='tag'
                />
            </Box>
        </State>
    );
    const catalog = (
        <Panel
            sx={{
                p: 1.5,
                flex: '1 1 0',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
            }}
        >
            <Stack
                direction='row'
                sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    flexShrink: 0,
                }}
            >
                <Typography sx={{ fontWeight: 600 }}>Medical catalog</Typography>
                <Typography variant='body2' color='text.secondary' sx={{ fontSize: 12 }}>
                    Read-only reference
                </Typography>
            </Stack>
            <Stack direction='row' sx={{ gap: 1.5, flexShrink: 0 }}>
                <TextField
                    label='Search specialty'
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                    sx={{ flex: 1, minWidth: 0 }}
                />
                <TextField
                    label='Document'
                    value={record?.specialty || 'No document'}
                    slotProps={{ input: { readOnly: true } }}
                    sx={{ flex: 1, minWidth: 0 }}
                />
            </Stack>
            <ScrollArea
                sx={{ flex: 1, pr: 0.5 }}
                data-testid='catalog-content'
                tabIndex={0}
                aria-label='Medical catalog document'
            >
                <State
                    resource={catalogs}
                    compact
                    empty={catalogs.data?.items.length === 0}
                    emptyMessage='No catalog documents match your search.'
                >
                    {record && <CatalogDocument record={record} />}
                </State>
            </ScrollArea>
            <Stack direction='row' sx={{ alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Typography variant='body2' color='text.secondary' sx={{ flex: 1, fontSize: 12 }}>
                    Document {catalogs.data?.total ? page : 0} of {catalogs.data?.total ?? 0}
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
