import { useState, useCallback, useEffect } from "react";
import { ApiError, ApiErrorType } from "../api/errors";

interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  errorType: ApiErrorType | null;
  errorMessage: string | null;
}

interface UseFetchOptions {
  immediate?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: ApiError) => void;
}

/**
 * Centralized hook for API calls with automatic loading and error states
 * Provides better error handling with error type differentiation
 */
export function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps?: unknown[],
  options: UseFetchOptions = {}
): UseFetchState<T> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options.immediate !== false);
  const [error, setError] = useState<ApiError | null>(null);
  const [errorType, setErrorType] = useState<ApiErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorType(null);
    setErrorMessage(null);
    try {
      const result = await fetchFn();
      setData(result);
      options.onSuccess?.(result);
    } catch (err) {
      const apiError = err instanceof ApiError
        ? err
        : new ApiError(
            err instanceof Error ? err.message : String(err),
            "unknown"
          );
      setError(apiError);
      setErrorType(apiError.type);
      setErrorMessage(apiError.getUserMessage());
      options.onError?.(apiError);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, options]);

  useEffect(() => {
    if (options.immediate === false) {
      return;
    }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, options.immediate, ...(deps || [])]);

  return { data, loading, error, errorType, errorMessage, refetch };
}
