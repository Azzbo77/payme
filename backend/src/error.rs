use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;
use validator::ValidationErrors;

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}

#[derive(Error, Debug)]
pub enum PaymeError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Validation error: {0}")]
    Validation(#[from] ValidationErrors),

    #[error("Not found")]
    NotFound,

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Rate limit exceeded")]
    RateLimited,
}

impl IntoResponse for PaymeError {
    fn into_response(self) -> Response {
        let (status, error, details) = match &self {
            PaymeError::Database(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database error".to_string(),
                Some(format!("A database operation failed: {}", err)),
            ),
            PaymeError::Validation(err) => (
                StatusCode::BAD_REQUEST,
                "Validation error".to_string(),
                Some(format!("Request validation failed: {}", err)),
            ),
            PaymeError::NotFound => (
                StatusCode::NOT_FOUND,
                "Not found".to_string(),
                None,
            ),
            PaymeError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "Unauthorized".to_string(),
                Some("Authentication required or invalid credentials".to_string()),
            ),
            PaymeError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                "Bad request".to_string(),
                Some(msg.clone()),
            ),
            PaymeError::Internal(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
                Some(msg.clone()),
            ),
            PaymeError::RateLimited => (
                StatusCode::TOO_MANY_REQUESTS,
                "Rate limit exceeded".to_string(),
                Some("Too many requests. Please try again later.".to_string()),
            ),
        };

        tracing::error!("{}: {:?}", error, details);

        let error_response = ErrorResponse {
            error,
            details,
        };

        (status, Json(error_response)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;

    #[test]
    fn test_not_found_response() {
        let error = PaymeError::NotFound;
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_unauthorized_response() {
        let error = PaymeError::Unauthorized;
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_bad_request_response() {
        let error = PaymeError::BadRequest("test".to_string());
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_internal_response() {
        let error = PaymeError::Internal("test".to_string());
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn test_rate_limited_response() {
        let error = PaymeError::RateLimited;
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[test]
    fn test_error_display() {
        assert_eq!(PaymeError::NotFound.to_string(), "Not found");
        assert_eq!(PaymeError::Unauthorized.to_string(), "Unauthorized");
        assert_eq!(
            PaymeError::BadRequest("invalid".to_string()).to_string(),
            "Bad request: invalid"
        );
        assert_eq!(
            PaymeError::Internal("error".to_string()).to_string(),
            "Internal error: error"
        );
    }
}
