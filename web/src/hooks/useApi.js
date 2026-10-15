import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/DataProvider';
export default function useApi(request, params = {}, enabled = true) {
    const { actorKey, revision, session, loading } = useSession();
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({ data: null, loading: true, error: '' });
    const serialized = JSON.stringify(params);
    const key = JSON.stringify([serialized, actorKey, revision, attempt, enabled, !!session, loading]);
    useEffect(() => {
        const controller = new AbortController();
        if (!enabled || !session || loading) {
            setState({ key, data: null, loading: false, error: '' });
            return () => controller.abort();
        }
        setState({ key, data: null, loading: true, error: '' });
        request(JSON.parse(serialized), { signal: controller.signal })
            .then((data) => {
                if (!controller.signal.aborted) setState({ key, data, loading: false, error: '' });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({ key, data: null, loading: false, error: error.message });
            });
        return () => controller.abort();
    }, [request, serialized, actorKey, revision, attempt, enabled, !!session, loading]);
    const retry = useCallback(() => setAttempt((value) => value + 1), []);
    const current = state.key === key ? state : { data: null, loading: enabled && !!session && !loading, error: '' };
    return { ...current, retry };
}
