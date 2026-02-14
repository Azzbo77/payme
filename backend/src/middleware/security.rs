use axum::{extract::Request, middleware::Next, response::Response};

/// Middleware that adds security headers to all responses
pub async fn add_security_headers(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;

    response.headers_mut().insert(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
            .parse()
            .unwrap(),
    );

    response
        .headers_mut()
        .insert("X-Content-Type-Options", "nosniff".parse().unwrap());

    response
        .headers_mut()
        .insert("X-Frame-Options", "DENY".parse().unwrap());

    response
        .headers_mut()
        .insert("X-XSS-Protection", "1; mode=block".parse().unwrap());

    response.headers_mut().insert(
        "Referrer-Policy",
        "strict-origin-when-cross-origin".parse().unwrap(),
    );

    response
}
