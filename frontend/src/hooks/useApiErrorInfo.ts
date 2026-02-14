import { ApiError } from "../api/errors";

/**
 * Hook to check error conditions and get error details
 * Makes it easier to show appropriate error messages to users
 */
export function useApiErrorInfo(error: ApiError | null) {
  return {
    /**
     * Check if it's a network error
     */
    isNetworkError: error?.type === "network",

    /**
     * Check if it's an auth error (requires login)
     */
    isAuthError: error?.type === "auth",

    /**
     * Check if it's a validation error (bad input)
     */
    isValidationError: error?.type === "validation",

    /**
     * Check if it's a server error
     */
    isServerError: error?.type === "server",

    /**
     * Get the user-friendly error message
     */
    message: error?.getUserMessage() ?? null,

    /**
     * Get a specific field's validation error
     */
    getFieldError: (field: string) => error?.getFieldError(field) ?? undefined,

    /**
     * Check if a specific field has an error
     */
    hasFieldError: (field: string) => !!error?.getFieldError(field),

    /**
     * Get all validation errors as an array
     */
    validationErrors: error?.getValidationErrorsList() ?? [],

    /**
     * Get the request ID (for support/debugging)
     */
    requestId: error?.requestId,

    /**
     * Get HTTP status code
     */
    status: error?.status,
  };
}
