import { useState, useEffect, useCallback, useRef } from 'react';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseDataFetchOptions<T> {
  autoFetch?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (err: any) => void;
}

export interface UseDataFetchReturn<T> {
  data: T | null;
  status: FetchStatus;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isEmpty: boolean;
  reload: (silent?: boolean) => Promise<T | null>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Standard four-state data fetching hook to prevent premature empty states,
 * stuck loading spinners, and unhandled errors.
 *
 * State cycle:
 * 'idle' -> 'loading' -> 'success' (with data) OR 'error' (with error)
 */
export function useDataFetch<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = [],
  options: UseDataFetchOptions<T> = {}
): UseDataFetchReturn<T> {
  const { autoFetch = true, onSuccess, onError } = options;

  const [status, setStatus] = useState<FetchStatus>(autoFetch ? 'loading' : 'idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const activeRequestIdRef = useRef(0);

  const reload = useCallback(async (silent = false): Promise<T | null> => {
    const requestId = ++activeRequestIdRef.current;
    if (!silent) {
      setStatus('loading');
      setError(null);
    }

    try {
      const result = await fetchFnRef.current();
      // Ignore if a newer request was dispatched
      if (requestId === activeRequestIdRef.current) {
        setData(result);
        setStatus('success');
        setError(null);
        if (onSuccessRef.current) onSuccessRef.current(result);
        return result;
      }
      return null;
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        const errorObj = err instanceof Error ? err : new Error(err?.message || 'Failed to load data');
        setError(errorObj);
        setStatus('error');
        if (onErrorRef.current) onErrorRef.current(errorObj);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const isLoading = status === 'loading' || status === 'idle';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isEmpty = isSuccess && (Array.isArray(data) ? data.length === 0 : !data);

  return {
    data,
    status,
    error,
    isLoading,
    isSuccess,
    isError,
    isEmpty,
    reload,
    setData,
  };
}
