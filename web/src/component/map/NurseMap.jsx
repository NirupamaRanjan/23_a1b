import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useSession } from '../../context/DataProvider';
import useNearbyNurses from '../../hooks/useNearbyNurses';
import { dateTime, validId } from '../../utils/format';
import EmptyState from '../common/EmptyState';
import { Heading, Panel, State, Title } from '../common/Ui';

// Leaflet's required positioning and control styles are intentionally inside JSX.
// Leaflet CSS is expressed here; the global font-face is loaded by the application entry.
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
                pointerEvents: 'none',
            },
            '.leaflet-tile-loaded': { visibility: 'inherit' },
            '.leaflet-container img': { maxWidth: 'none !important' },
            '.leaflet-zoom-animated': { transformOrigin: '0 0' },
            '.leaflet-zoom-anim .leaflet-zoom-animated': {
                transition: 'transform 250ms cubic-bezier(0,0,.25,1)',
            },
            '.leaflet-zoom-anim .leaflet-tile': { transition: 'none' },
            '.leaflet-interactive': { cursor: 'pointer', pointerEvents: 'auto' },
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
            '.leaflet-right .leaflet-control': { float: 'right', marginRight: 10 },
            '.leaflet-top .leaflet-control': { marginTop: 10 },
            '.leaflet-bottom .leaflet-control': { marginBottom: 10 },
            '.leaflet-left .leaflet-control': { marginLeft: 10 },
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
// Keep the Leaflet instance/tile cache when the origin changes.
const MapViewport = ({ origin }) => {
    const map = useMap();
    useEffect(() => {
        map.setView([origin.latitude, origin.longitude], map.getZoom(), { animate: false });
        map.invalidateSize({ pan: false });
    }, [map, origin.latitude, origin.longitude]);
    return null;
};

const NurseMap = () => {
    const { selectedClinic } = useSession();
    const theme = useTheme();
    const [origin, setOrigin] = useState(null);
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [validation, setValidation] = useState('');
    const [locationMessage, setLocationMessage] = useState('Requesting your current location…');
    const [locating, setLocating] = useState(true);
    const locationRequest = useRef(0);
    const [selected, setSelected] = useState(null);
    const resource = useNearbyNurses(origin);
    const [tiles, setTiles] = useState({ loading: true, failed: false });
    const [tileAttempt, setTileAttempt] = useState(0);
    const tileEvents = useMemo(() => ({
        loading: () => setTiles({ loading: true, failed: false }),
        load: () => setTiles((previous) => ({ ...previous, loading: false })),
        tileerror: () => setTiles((previous) => ({ ...previous, failed: true })),
    }), []);
    const chooseOrigin = useCallback((lat, lng, source = 'Using your chosen search origin.') => {
        locationRequest.current += 1;
        setLocating(false);
        setLocationMessage(source);
        setValidation('');
        const point = { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
        setOrigin((previous) => previous?.latitude === point.latitude && previous?.longitude === point.longitude ? previous : point);
        setLatitude(String(Number(lat.toFixed(6))));
        setLongitude(String(Number(lng.toFixed(6))));
        setSelected(null);
    }, []);
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
    const locate = useCallback(() => {
        const request = ++locationRequest.current;
        const unavailable = (error) => {
            if (request !== locationRequest.current) return;
            const message = error?.code === 1
                ? 'Location permission was denied. Allow location in your browser settings, or choose an origin manually.'
                : error?.code === 3
                  ? 'Location lookup timed out. Try again or choose an origin manually.'
                  : 'Your location is unavailable. Try again or choose an origin manually.';
            setLocating(false);
            setValidation(message);
            setLocationMessage('Choose your location or enter coordinates to search.');
        };
        if (!navigator.geolocation) {
            unavailable();
            return;
        }
        setLocating(true);
        setValidation('');
        setLocationMessage('Requesting your current location…');
        try { navigator.geolocation.getCurrentPosition(
            (position) => {
                if (request !== locationRequest.current) return;
                if (!validPoint(position.coords.latitude, position.coords.longitude)) {
                    unavailable();
                    return;
                }
                chooseOrigin(position.coords.latitude, position.coords.longitude,
                    `Using your current location (reported accuracy: ${Math.round(position.coords.accuracy)} m).`);
            },
            unavailable,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        ); } catch { unavailable(); }
    }, [chooseOrigin]);
    useEffect(() => {
        locate();
        return () => { locationRequest.current += 1; };
    }, [locate]);
    const useClinic = () => {
        const lat = Number(selectedClinic?.latitude), lng = Number(selectedClinic?.longitude);
        if (selectedClinic && validPoint(lat, lng))
            chooseOrigin(lat, lng, `Using ${selectedClinic.name}'s location, rather than your device location.`);
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
                subtitle='Active nurses within 5 km of your current or chosen location. Results update every 10 seconds.'
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
                    <Button variant='outlined' onClick={useClinic} disabled={!selectedClinic}>Use selected clinic</Button>
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
                    {locationMessage} Location access requires browser permission and HTTPS or localhost.
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
                    <Box sx={{ height: { xs: 420, lg: 'clamp(460px, 56vh, 680px)' }, borderRadius: 2, overflow: 'hidden' }}>
                        {origin ? (
                            <MapContainer
                                center={[origin.latitude, origin.longitude]}
                                zoom={12}
                                scrollWheelZoom={false}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <TileLayer
                                    key={tileAttempt}
                                    url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                                    eventHandlers={tileEvents}
                                    updateWhenIdle
                                    updateWhenZooming={false}
                                    keepBuffer={2}
                                    maxZoom={19}
                                />
                                <MapViewport origin={origin} />
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
                                        bubblingMouseEvents={false}
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
                            <EmptyState title={locating ? 'Finding your location' : 'Choose a search location'} message={locating ? 'Allow location access in your browser to find care near you.' : 'Use your location, select a clinic, or enter coordinates above.'} />
                        )}
                    </Box>
                    {origin && tiles.failed ? (
                        <Alert severity='warning' sx={{ mt: 1 }} action={
                            <Button color='inherit' onClick={() => {
                                setTiles({ loading: true, failed: false });
                                setTileAttempt((value) => value + 1);
                            }}>Retry map images</Button>
                        }>
                            Some map images could not load. Check your internet connection. Nurse results are independent.
                        </Alert>
                    ) : origin && tiles.loading ? (
                        <Typography role='status' variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                            Loading map images… Nurse results can appear before the background map.
                        </Typography>
                    ) : null}
                    <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                        Map tiles require internet access. Click a nurse marker to highlight its
                        list entry.
                    </Typography>
                </Panel>
                <Panel sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Title>Distance-ordered results</Title>
                    {!origin ? (
                        <EmptyState title={locating ? 'Finding nearby care' : 'Ready when you are'} message='Choose a search location to see active nurses within 5 km.' />
                    ) : (
                        <State
                            resource={{
                                ...resource,
                                error: resource.data ? '' : resource.error,
                            }}
                            empty={!nurses.length}
                            emptyMessage='No active nurses with a recent location are within 5 km of this origin. Try another location or check again shortly.'
                            emptyTitle='No nearby nurses right now'
                            emptyAction={{ label: 'Refresh results', onClick: resource.retry, disabled: resource.loading }}
                        >
                            <Typography variant='body2' color='text.secondary'>
                                Updated {dateTime(resource.data?.updated_at)} UTC
                            </Typography>
                            <List disablePadding>
                                {nurses.map((row, index) => (
                                    <ListItemButton
                                        key={row.nurse_id}
                                        selected={selected === row.nurse_id}
                                        aria-label={`Select ${row.nurse_name || `Nurse ${row.nurse_id}`}`}
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
