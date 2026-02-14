/**
 * API Error Handling Guide
 * 
 * This guide shows how to use the improved API error handling in payme.
 */

/**
 * ERROR TYPES
 * 
 * All API errors are now typed as ApiError with specific types:
 * - "network": Connection failed (no internet, server down)
 * - "auth": Authentication failed (401/403 - session expired, invalid login)
 * - "validation": Bad input data (400 - form validation failed)
 * - "server": Server error (5xx)
 * - "unknown": Unexpected error
 */

/**
 * BASIC USAGE WITH useFetch
 * 
 * Example: Loading user data with error handling
 */
/*
import { useFetch } from "@/hooks";
import { api } from "@/api/client";

function UserProfile() {
  const { data, loading, error, errorMessage } = useFetch(
    () => api.auth.me()
  );

  if (loading) return <div>Loading...</div>;

  if (error) {
    return (
      <div className="error">
        {errorMessage}
        {error.requestId && (
          <p className="text-sm text-gray-500">
            Error ID: {error.requestId} (for support)
          </p>
        )}
      </div>
    );
  }

  return <div>Welcome, {data?.username}</div>;
}
*/

/**
 * ADVANCED USAGE: CHECKING ERROR TYPE
 * 
 * Different error handling based on error type
 */
/*
import { useFetch, useApiErrorInfo } from "@/hooks";
import { api } from "@/api/client";

function LoginForm() {
  const { data, error, refetch } = useFetch(
    () => api.auth.login(username, password)
  );

  const errorInfo = useApiErrorInfo(error);

  if (errorInfo.isNetworkError) {
    return <div>Check your internet connection</div>;
  }

  if (errorInfo.isAuthError) {
    return <div>Invalid username or password</div>;
  }

  if (errorInfo.isServerError) {
    return (
      <div>
        Server is down. Try again in a few minutes.
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  if (error) {
    return <div>{errorInfo.message}</div>;
  }

  return <div>Logged in!</div>;
}
*/

/**
 * VALIDATION ERROR HANDLING
 * 
 * Display form field errors from validation
 */
/*
import { useFetch, useApiErrorInfo } from "@/hooks";
import { api } from "@/api/client";

function UpdateProfile({ userId, newUsername, currentPassword }) {
  const { error } = useFetch(
    () => api.auth.changeUsername(newUsername)
  );

  const errorInfo = useApiErrorInfo(error);

  return (
    <form>
      <input
        name="username"
        defaultValue={newUsername}
      />
      {errorInfo.hasFieldError("username") && (
        <span className="error">
          {errorInfo.getFieldError("username")}
        </span>
      )}

      {!errorInfo.isValidationError && error && (
        <div className="error">{errorInfo.message}</div>
      )}

      <button type="submit">Update</button>
    </form>
  );
}
*/

/**
 * ERROR INFO OBJECT METHODS
 * 
 * useApiErrorInfo(error) returns:
 * 
 * - isNetworkError: boolean - network connectivity issue
 * - isAuthError: boolean - authentication required or failed
 * - isValidationError: boolean - invalid input data
 * - isServerError: boolean - 5xx error
 * - message: string | null - user-friendly error message
 * - getFieldError(fieldName): string | undefined - specific field error
 * - hasFieldError(fieldName): boolean - check if field has error
 * - validationErrors: Array<{field, message}> - all validation errors
 * - requestId: string | undefined - unique error ID for support
 * - status: number | undefined - HTTP status code
 */

/**
 * API ERROR CLASS METHODS
 * 
 * When working directly with ApiError:
 * 
 * error.getUserMessage() - get user-friendly message
 * error.getFieldError(field) - get field validation error
 * error.getValidationErrorsList() - get all validation errors as array
 * error.isType(type) - check error type (e.g., error.isType("auth"))
 */

export {};
