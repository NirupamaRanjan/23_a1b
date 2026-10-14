import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../context/DataProvider';

export default function useApi(request, params = {}, enabled = true) {
    
    const { actorKey, revision, session, loading } = useSession();
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({ data: null, loading: true, error: '' });
    const serialized = JSON.stringify(params);
    const fetchIdentity = `${serialized}|${actorKey}|${enabled}|${!!session}`;
    const identityRef = useRef('');
    
    useEffect(() => {
        const controller = new AbortController();
        if (!enabled || !session || loading) {
            identityRef.current = '';
            setState({ data: null, loading: false, error: '' });
            return () => controller.abort();
        }

        const replaced = identityRef.current !== fetchIdentity;
        identityRef.current = fetchIdentity;
        setState((previous) => ({
            data: replaced ? null : previous.data,
            loading: true,
            error: '',
        }));
        
        request(JSON.parse(serialized), { signal: controller.signal })
            .then((data) => {
                if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    setState((previous) => ({
                        data: previous.data,
                        loading: false,
                        error: error.message,
                    }));
            });
        return () => controller.abort();
    }, [request, serialized, fetchIdentity, revision, attempt, enabled, session, loading]);
    
    const retry = useCallback(() => setAttempt((value) => value + 1), []);
    return { ...state, retry };
}
