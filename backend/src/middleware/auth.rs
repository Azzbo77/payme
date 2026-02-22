use axum::{extract::Request, middleware::Next, response::Response};
use axum_extra::extract::CookieJar;
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::error::PaymeError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: i64,
    pub username: String,
    pub exp: usize,
    #[serde(default)]
    pub token_type: TokenType,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TokenType {
    #[serde(rename = "access")]
    Access,
    #[serde(rename = "refresh")]
    Refresh,
}

impl Default for TokenType {
    fn default() -> Self {
        TokenType::Access
    }
}

pub async fn auth_middleware(
    jar: CookieJar,
    mut request: Request,
    next: Next,
) -> Result<Response, PaymeError> {
    let token = jar
        .get("access_token")
        .map(|c| c.value().to_string())
        .or_else(|| {
            jar.get("token")
                .map(|c| c.value().to_string())
        })
        .or_else(|| {
            request
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.strip_prefix("Bearer "))
                .map(|s| s.to_string())
        })
        .ok_or(PaymeError::Unauthorized)?;

    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET environment variable is required");

    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| PaymeError::Unauthorized)?;

    // Verify this is an access token, not a refresh token
    if token_data.claims.token_type != TokenType::Access {
        return Err(PaymeError::Unauthorized);
    }

    request.extensions_mut().insert(token_data.claims);
    Ok(next.run(request).await)
}
