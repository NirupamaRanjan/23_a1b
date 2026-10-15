import { useCallback, useEffect, useState } from 'react';
import { API } from '../service/api';
import { useSession } from '../context/DataProvider';

export default function useNearbyNurses(origin) {
    const { actorKey, session } = useSession();
    const key = origin ? `${actorKey}:${origin.latitude}:${origin.longitude}` : '';
    const [state, setState] = useState({ key: '', data: null, loading: false, error: '' });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!origin || !session) return;
        let stopped = false, timer, inFlight = false;
        const controller = new AbortController();
        setState((previous) => previous.key === key
            ? { ...previous, loading: !previous.data, error: '' }
            : { key, data: null, loading: true, error: '' });
        const poll = async () => {
            clearTimeout(timer);
            if (stopped || inFlight) return;
            if (document.visibilityState !== 'hidden') {
                inFlight = true;
                try {
                    const data = await API.nurses(origin, { signal: controller.signal });
                    if (!stopped) setState({ key, data, loading: false, error: '' });
                } catch (error) {
                    if (!stopped) setState((previous) => ({
                        ...previous, loading: false, error: error.message,
                    }));
                } finally {
                    inFlight = false;
                }
            }
            if (!stopped) timer = setTimeout(poll, 10000);
        };
        const visible = () => { if (document.visibilityState === 'visible') poll(); };
        poll();
        document.addEventListener('visibilitychange', visible);
        return () => {
            stopped = true;
            controller.abort();
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', visible);
        };
    }, [key, attempt, !!session]);
    const retry = useCallback(() => setAttempt((value) => value + 1), []);
    // Don't briefly expose results from a different actor or previous search origin.
    const current = origin && session && state.key === key ? state
        : { data: null, loading: !!origin && !!session, error: '' };
    return { ...current, retry };
}
