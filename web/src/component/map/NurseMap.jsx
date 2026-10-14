import { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    GlobalStyles,
    List,
    ListItemButton,
    Stack,
    TextField,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Circle, CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { useSession } from '../../context/DataProvider';
import useNearbyNurses from '../../hooks/useNearbyNurses';
import { dateTime, validId } from '../../utils/format';
import { Heading, Panel, State, Title } from '../common/Ui';

// Leaflet's required positioning and control styles are intentionally inside JSX.
// No leaflet.css or application CSS file is imported.
const LeafletStyles = () => (
    <GlobalStyles
        styles={(theme) => ({
            '.leaflet-container': {
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                height: '100%',
                background: theme.palette.background.default,
                font: 'inherit',
                touchAction: 'none',
                outline: 0,
            },
            '.leaflet-pane, .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-pane > svg, .leaflet-pane > canvas':
                { position: 'absolute', left: 0, top: 0 },
            '.leaflet-pane': { zIndex: 400 },
            '.leaflet-tile-pane': { zIndex: 200 },
            '.leaflet-overlay-pane': { zIndex: 400 },
            '.leaflet-shadow-pane': { zIndex: 500 },
            '.leaflet-marker-pane': { zIndex: 600 },
            '.leaflet-tooltip-pane': { zIndex: 650 },
            '.leaflet-popup-pane': { zIndex: 700 },
            '.leaflet-tile': {
                visibility: 'hidden',
                maxWidth: 'none !important',
                maxHeight: 'none !important',
                userSelect: 'none',
            },
            '.leaflet-tile-loaded': { visibility: 'inherit' },
            '.leaflet-container img': { maxWidth: 'none !important' },
            '.leaflet-zoom-animated': { transformOrigin: '0 0' },
            '.leaflet-zoom-anim .leaflet-zoom-animated': {
                transition: 'transform 250ms cubic-bezier(0,0,.25,1)',
            },
            '.leaflet-zoom-anim .leaflet-tile': { transition: 'none' },
            '.leaflet-interactive': { cursor: 'pointer' },
            '.leaflet-grab': { cursor: 'grab' },
            '.leaflet-dragging .leaflet-grab': { cursor: 'grabbing' },
            '.leaflet-control': {
                position: 'relative',
                zIndex: 800,
                pointerEvents: 'auto',
                float: 'left',
                clear: 'both',
            },
            '.leaflet-top, .leaflet-bottom': {
                position: 'absolute',
                zIndex: 1000,
                pointerEvents: 'none',
            },
            '.leaflet-top': { top: 0 },
            '.leaflet-bottom': { bottom: 0 },
            '.leaflet-left': { left: 0 },
            '.leaflet-right': { right: 0 },
            '.leaflet-right .leaflet-control': { float: 'right' },
            '.leaflet-top .leaflet-control': { marginTop: 10 },
            '.leaflet-bottom .leaflet-control': { marginBottom: 10 },
            '.leaflet-left .leaflet-control': { marginLeft: 10 },
            '.leaflet-right .leaflet-control': { marginRight: 10 },
            '.leaflet-bar': {
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 6,
                overflow: 'hidden',
            },
            '.leaflet-bar a': {
                display: 'block',
                width: 44,
                height: 44,
                lineHeight: '44px',
                textAlign: 'center',
                fontSize: 24,
                textDecoration: 'none',
                color: theme.palette.text.primary,
                background: theme.palette.background.paper,
            },
            '.leaflet-bar a + a': { borderTop: `1px solid ${theme.palette.divider}` },
            '.leaflet-bar a.leaflet-disabled': { color: theme.palette.text.disabled },
            '.leaflet-control-attribution': {
                background: alpha(theme.palette.background.paper, 0.9),
                padding: '2px 5px',
                fontSize: 11,
                color: theme.palette.text.secondary,
                maxWidth: '90%',
            },
            '.leaflet-control-attribution a': { color: theme.palette.primary.main },
            '.leaflet-container svg': { userSelect: 'none' },
            '.leaflet-container .leaflet-control a:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: -3,
            },
        })}
    />
);
const validPoint = (lat, lng) =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const OriginPicker = ({ chooseOrigin }) => {
    useMapEvents({
        click: (event) => chooseOrigin(event.latlng.lat, event.latlng.lng),
    });
    return null;
};
const NurseMap = () => {
    const { selectedClinic } = useSession();
    const theme = useTheme();
    const clinicLat = Number(selectedClinic?.latitude),
        clinicLng = Number(selectedClinic?.longitude);
    const initial =
        selectedClinic && validPoint(clinicLat, clinicLng)
            ? { latitude: clinicLat, longitude: clinicLng }
            : null;
    const [origin, setOrigin] = useState(initial);
    const [latitude, setLatitude] = useState(initial ? String(initial.latitude) : '');
    const [longitude, setLongitude] = useState(initial ? String(initial.longitude) : '');
    const [validation, setValidation] = useState('');
    const [locating, setLocating] = useState(false);
    const [selected, setSelected] = useState(null);
    const resource = useNearbyNurses(origin);
    const chooseOrigin = (lat, lng) => {
        setValidation('');
        setOrigin({ latitude: lat, longitude: lng });
        setLatitude(String(Number(lat.toFixed(6))));
        setLongitude(String(Number(lng.toFixed(6))));
        setSelected(null);
    };
    const apply = (event) => {
        event.preventDefault();
        const lat = Number(latitude),
            lng = Number(longitude);
        if (!latitude.trim() || !longitude.trim() || !validPoint(lat, lng)) {
            setValidation('Enter latitude from −90 to 90 and longitude from −180 to 180.');
            return;
        }
        chooseOrigin(lat, lng);
    };
    const locate = () => {
        if (!navigator.geolocation) {
            setValidation('Location is unavailable. Enter coordinates instead.');
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                chooseOrigin(position.coords.latitude, position.coords.longitude);
                setLocating(false);
            },
            () => {
                setValidation(
                    'Location access was denied or unavailable. Choose an origin manually.'
                );
                setLocating(false);
            },
            { timeout: 10000 }
        );
    };
    const nurses = (resource.data?.items || [])
        .map((row) => ({
            ...row,
            lat: Number(row.location?.coordinates?.[1]),
            lng: Number(row.location?.coordinates?.[0]),
            distance: Number(row.dist?.calculated),
        }))
        .filter(
            (row) =>
                validId(row.nurse_id) &&
                row.is_active === true &&
                validPoint(row.lat, row.lng) &&
                Number.isFinite(row.distance) &&
                row.distance >= 0 &&
                row.distance <= 5000
        )
        .sort((a, b) => a.distance - b.distance);
    return (
        <>
            <LeafletStyles />
            <Heading
                title='Nearby nurses'
                subtitle='Choose a search origin. Results within 5 km update every 10 seconds.'
            />
            <Panel component='form' onSubmit={apply} sx={{ mb: 3 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2 }}>
                    <TextField
                        label='Origin latitude'
                        value={latitude}
                        onChange={(event) => setLatitude(event.target.value)}
                    />
                    <TextField
                        label='Origin longitude'
                        value={longitude}
                        onChange={(event) => setLongitude(event.target.value)}
                    />
                    <Button variant='contained' type='submit'>
                        Apply origin
                    </Button>
                    <Button
                        variant='outlined'
                        startIcon={<MyLocationIcon />}
                        onClick={locate}
                        disabled={locating}
                    >
                        {locating ? 'Locating…' : 'Use my location'}
                    </Button>
                    <Button
                        variant='outlined'
                        startIcon={<RefreshIcon />}
                        onClick={resource.retry}
                        disabled={!origin}
                    >
                        Refresh now
                    </Button>
                </Stack>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                    {initial
                        ? 'Clinic coordinates provide the initial origin. Choose coordinates, your location, or click the map.'
                        : 'Enter coordinates or use your location to start.'}
                </Typography>
                {validation && (
                    <Alert severity='warning' sx={{ mt: 2 }}>
                        {validation}
                    </Alert>
                )}
            </Panel>
            {resource.error && resource.data && (
                <Alert severity='warning' sx={{ mb: 2 }}>
                    Live update failed. Showing the last successful results from{' '}
                    {dateTime(resource.data.updated_at)} UTC. {resource.error}
                </Alert>
            )}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' },
                    gap: 3,
                }}
            >
                <Panel>
                    <Title>5 km search radius</Title>
                    <Box sx={{ height: 420, borderRadius: 2, overflow: 'hidden' }}>
                        {origin ? (
                            <MapContainer
                                key={`${origin.latitude}:${origin.longitude}`}
                                center={[origin.latitude, origin.longitude]}
                                zoom={12}
                                scrollWheelZoom={false}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <TileLayer
                                    url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                                    attribution='&copy; OpenStreetMap contributors'
                                />
                                <OriginPicker chooseOrigin={chooseOrigin} />
                                <Circle
                                    center={[origin.latitude, origin.longitude]}
                                    radius={5000}
                                    pathOptions={{
                                        color: theme.palette.primary.main,
                                        fillOpacity: 0.08,
                                    }}
                                />
                                <CircleMarker
                                    center={[origin.latitude, origin.longitude]}
                                    radius={8}
                                    pathOptions={{
                                        color: theme.palette.primary.main,
                                        fillOpacity: 1,
                                    }}
                                />
                                {nurses.map((row) => (
                                    <CircleMarker
                                        key={row.nurse_id}
                                        center={[row.lat, row.lng]}
                                        radius={selected === row.nurse_id ? 11 : 7}
                                        pathOptions={{
                                            color: theme.palette.success.main,
                                            fillOpacity: 0.85,
                                            weight: selected === row.nurse_id ? 4 : 2,
                                        }}
                                        eventHandlers={{ click: () => setSelected(row.nurse_id) }}
                                    />
                                ))}
                            </MapContainer>
                        ) : (
                            <Typography color='text.secondary'>
                                Select an origin to load the map.
                            </Typography>
                        )}
                    </Box>
                    <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                        Map tiles require internet access. Click a nurse marker to highlight its
                        list entry.
                    </Typography>
                </Panel>
                <Panel>
                    <Title>Distance-ordered results</Title>
                    {!origin ? (
                        <Typography color='text.secondary'>Choose an origin first.</Typography>
                    ) : (
                        <State
                            resource={{
                                ...resource,
                                error: resource.data ? '' : resource.error,
                            }}
                            empty={!nurses.length}
                            emptyMessage='No active nurses within 5 km.'
                        >
                            <Typography variant='body2' color='text.secondary'>
                                Updated {dateTime(resource.data?.updated_at)} UTC
                            </Typography>
                            <List disablePadding>
                                {nurses.map((row, index) => (
                                    <ListItemButton
                                        key={row.nurse_id}
                                        selected={selected === row.nurse_id}
                                        onClick={() => setSelected(row.nurse_id)}
                                        sx={{
                                            my: 1,
                                            borderBottom: 1,
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                        }}
                                    >
                                        <Box sx={{ width: '100%' }}>
                                            <Stack
                                                direction='row'
                                                sx={{ justifyContent: 'space-between', gap: 1 }}
                                            >
                                                <Typography sx={{ fontWeight: 600 }}>
                                                    {index + 1}.{' '}
                                                    {row.nurse_name || `Nurse ${row.nurse_id}`}
                                                </Typography>
                                                <Typography
                                                    color='primary.main'
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {(row.distance / 1000).toFixed(2)} km
                                                </Typography>
                                            </Stack>
                                            <Typography variant='body2' color='text.secondary'>
                                                Active · ping {dateTime(row.created_at)} UTC
                                            </Typography>
                                        </Box>
                                    </ListItemButton>
                                ))}
                            </List>
                        </State>
                    )}
                </Panel>
            </Box>
        </>
    );
};
export default NurseMap;
