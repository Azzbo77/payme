/**
 * API Error type system for better error handling and user feedback
 */

export type ApiErrorType = "network" | "auth" | "validation" | "server" | "unknown";

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly type: ApiErrorType;
  readonly status?: number;
  readonly validationErrors?: Record<string, string[]>;
  readonly requestId?: string;

  constructor(
    message: string,
    type: ApiErrorType,
    status?: number,
    validationErrors?: Record<string, string[]>,
    requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    this.status = status;
    this.validationErrors = validationErrors;
    this.requestId = requestId;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.type) {
      case "network":
        return "Network connection failed. Please check your internet connection.";
      case "auth":
        return "Authentication failed. Please log in again.";
      case "validation":
        return "Please check your input and try again.";
      case "server":
        return "Server error. Please try again later.";
      default:
        return this.message || "An unexpected error occurred.";
    }
  }

  /**
   * Get validation error message for a specific field
   */
  getFieldError(field: string): string | undefined {
    if (!this.validationErrors) return undefined;
    const errors = this.validationErrors[field];
    return errors ? errors[0] : undefined;
  }

  /**
   * Check if this is a specific error type
   */
  isType(type: ApiErrorType): boolean {
    return this.type === type;
  }

  /**
   * Get all validation errors as array
   */
  getValidationErrorsList(): ValidationErrorDetail[] {
    if (!this.validationErrors) return [];
    return Object.entries(this.validationErrors).flatMap(([field, messages]) =>
      messages.map((message) => ({ field, message }))
    );
  }
}

/**
 * Parse error response from API
 */
export function parseApiError(
  status: number,
  body: unknown,
  requestId?: string
): ApiError {
  // Handle network errors (usually status 0)
  if (status === 0) {
    return new ApiError(
      "Network connection failed",
      "network",
      status,
      undefined,
      requestId
    );
  }

  // Handle auth errors
  if (status === 401 || status === 403) {
    return new ApiError(
      "Unauthorized",
      "auth",
      status,
      undefined,
      requestId
    );
  }

  // Handle validation errors
  if (status === 400) {
    if (typeof body === "object" && body !== null) {
      const errorObj = body as Record<string, unknown>;
      const message = typeof errorObj.error === "string" ? errorObj.error : "Validation failed";
      return new ApiError(
        message,
        "validation",
        status,
        extractValidationErrors(errorObj),
        requestId
      );
    }
    return new ApiError(
      "Bad request",
      "validation",
      status,
      undefined,
      requestId
    );
  }

  // Handle server errors
  if (status >= 500) {
    const errorMsg = extractErrorMessage(body);
    return new ApiError(
      errorMsg || "Server error",
      "server",
      status,
      undefined,
      requestId
    );
  }

  // Handle other HTTP errors
  if (status >= 400) {
    const errorMsg = extractErrorMessage(body);
    return new ApiError(
      errorMsg || `HTTP ${status}`,
      "unknown",
      status,
      undefined,
      requestId
    );
  }

  // Fallback
  return new ApiError(
    "Unknown error",
    "unknown",
    status,
    undefined,
    requestId
  );
}

/**
 * Extract error message from response body
 */
function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body === "object" && body !== null) {
    const errorObj = body as Record<string, unknown>;
    if (typeof errorObj.error === "string") {
      return errorObj.error;
    }
    if (typeof errorObj.details === "string") {
      return errorObj.details;
    }
    if (typeof errorObj.message === "string") {
      return errorObj.message;
    }
  }
  return undefined;
}

/**
 * Extract validation errors from response body
 */
function extractValidationErrors(
  body: Record<string, unknown>
): Record<string, string[]> | undefined {
  if (typeof body.errors === "object" && body.errors !== null) {
    return body.errors as Record<string, string[]>;
  }
  if (typeof body.validation === "object" && body.validation !== null) {
    return body.validation as Record<string, string[]>;
  }
  return undefined;
}
