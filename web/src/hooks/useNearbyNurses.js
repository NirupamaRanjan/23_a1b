import { useEffect, useState } from 'react';
import { API } from '../service/api';
import { useSession } from '../context/DataProvider';
export default function useNearbyNurses(origin) {
    const { actorKey, session } = useSession();
    const [state, setState] = useState({ data: null, loading: false, error: '' });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!origin || !session) {
            setState({ data: null, loading: false, error: '' });
            return;
        }
        let stopped = false,
            timer,
            inFlight = false;
        const controller = new AbortController();
        setState({ data: null, loading: true, error: '' });
        const poll = async () => {
            clearTimeout(timer);
            if (stopped || inFlight) return;
            if (document.visibilityState !== 'hidden') {
                inFlight = true;
                try {
                    const data = await API.nurses(origin, { signal: controller.signal });
                    if (!stopped) setState({ data, loading: false, error: '' });
                } catch (error) {
                    if (!stopped)
                        setState((previous) => ({
                            ...previous,
                            loading: false,
                            error: error.message,
                        }));
                } finally {
                    inFlight = false;
                }
            }
            if (!stopped) timer = setTimeout(poll, 10000);
        };
        const visible = () => {
            if (document.visibilityState === 'visible') poll();
        };
        poll();
        document.addEventListener('visibilitychange', visible);
        return () => {
            stopped = true;
            controller.abort();
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', visible);
        };
    }, [origin?.latitude, origin?.longitude, actorKey, attempt, !!session]);
    return { ...state, retry: () => setAttempt((value) => value + 1) };
}
