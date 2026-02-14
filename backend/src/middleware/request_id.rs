use axum::{extract::Request, middleware::Next, response::Response};
use uuid::Uuid;

/// Unique identifier for this request  
#[derive(Clone, Debug)]
pub struct RequestId(pub String);

/// Middleware that adds a unique request ID to each request
/// The ID is stored in request extensions and can be accessed by handlers
pub async fn request_id_middleware(mut request: Request, next: Next) -> Response {
    let request_id = RequestId(Uuid::new_v4().to_string());
    let id_for_logging = request_id.0.clone();
    request.extensions_mut().insert(request_id);

    let response = next.run(request).await;

    // Log response status with request_id for tracing
    if response.status().is_client_error() || response.status().is_server_error() {
        tracing::warn!(
            request_id = %id_for_logging,
            status = %response.status(),
            "Request failed"
        );
    }

    response
}
