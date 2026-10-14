import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/DataProvider';
export default function useApi(request, params = {}, enabled = true) {
    const { actorKey, revision, session, loading } = useSession();
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({ data: null, loading: true, error: '' });
    const serialized = JSON.stringify(params);
    useEffect(() => {
        const controller = new AbortController();
        if (!enabled || !session || loading) {
            setState({ data: null, loading: false, error: '' });
            return () => controller.abort();
        }
        setState({ data: null, loading: true, error: '' });
        request(JSON.parse(serialized), { signal: controller.signal })
            .then((data) => {
                if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState({ data: null, loading: false, error: error.message });
            });
        return () => controller.abort();
    }, [request, serialized, actorKey, revision, attempt, enabled, !!session, loading]);
    const retry = useCallback(() => setAttempt((value) => value + 1), []);
    return { ...state, retry };
}
