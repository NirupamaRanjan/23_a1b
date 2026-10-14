import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { API, ApiError } from '../service/api';
import { validId } from '../utils/format';
export const DataContext = createContext(null);
export const useSession = () => useContext(DataContext);
const DataProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [selectedClinic, setSelectedClinic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const sequence = useRef(0);
    const sessionRef = useRef(null);
    sessionRef.current = session;
    const install = useCallback((data) => {
        if (
            !data.actor ||
            !['patient', 'staff'].includes(data.actor.role) ||
            !validId(data.actor.id) ||
            typeof data.csrf_token !== 'string' ||
            !data.csrf_token.trim() ||
            (data.patient && !validId(data.patient.id))
        ) {
            throw new ApiError(
                'The backend session response is incomplete. Check the session API configuration.',
                0,
                'INVALID_SESSION'
            );
        }
        API.setCsrfToken(data.csrf_token);
        setSession(data);
        setSelectedClinic(data.clinic || null);
        setRevision((value) => value + 1);
    }, []);
    const loadSession = useCallback(async () => {
        const run = ++sequence.current;
        const initial = !sessionRef.current;
        if (initial) {
            setLoading(true);
            API.setCsrfToken('');
        }
        setError('');
        try {
            const data = await API.session();
            if (run === sequence.current) install(data);
        } catch (error) {
            if (run === sequence.current) {
                setSession(null);
                API.setCsrfToken('');
                setError(error.message);
            }
        } finally {
            if (run === sequence.current) setLoading(false);
        }
    }, [install]);
    useEffect(() => {
        loadSession();
        return () => {
            sequence.current += 1;
        };
    }, [loadSession]);
    const switchActor = async (actor) => {
        const run = ++sequence.current;
        setLoading(true);
        setError('');
        try {
            const data = await API.switchActor({
                role: actor.role,
                actor_id: actor.id,
            });
            if (run === sequence.current) install(data);
        } catch (error) {
            if (run === sequence.current) {
                setSession(null);
                API.setCsrfToken('');
                setError(error.message);
            }
        } finally {
            if (run === sequence.current) setLoading(false);
        }
    };
    const refresh = useCallback(() => setRevision((value) => value + 1), []);
    const updateBalance = (balance, patientId) =>
        setSession((previous) =>
            previous?.patient && previous.patient.id === patientId
                ? {
                      ...previous,
                      patient: { ...previous.patient, hsa_balance: balance },
                  }
                : previous
        );
    const actorKey = session
        ? `${session.actor.role}:${session.actor.id}:${session.patient?.id || ''}`
        : '';
    return (
        <DataContext.Provider
            value={{
                session,
                selectedClinic,
                setSelectedClinic,
                loading,
                error,
                loadSession,
                switchActor,
                revision,
                refresh,
                updateBalance,
                actorKey,
            }}
        >
            {children}
        </DataContext.Provider>
    );
};
export default DataProvider;
