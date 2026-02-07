use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use sqlx::SqlitePool;
use utoipa::ToSchema;

use crate::error::PaymeError;
use crate::middleware::auth::Claims;

#[derive(Deserialize, ToSchema)]
pub struct PreferencePayload {
    pub enabled: bool,
}

/// Generic preference getter - fetches a user preference by column name
async fn get_preference(
    pool: &SqlitePool,
    user_id: i64,
    column_name: &str,
) -> Result<bool, PaymeError> {
    let query_string = format!("SELECT {} FROM users WHERE id = ?", column_name);
    let enabled: i64 = sqlx::query_scalar(&query_string)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    Ok(enabled == 1)
}

/// Generic preference setter - updates a user preference by column name
async fn set_preference(
    pool: &SqlitePool,
    user_id: i64,
    column_name: &str,
    enabled: bool,
) -> Result<(), PaymeError> {
    let enabled_int = if enabled { 1 } else { 0 };
    let query_string = format!("UPDATE users SET {} = ? WHERE id = ?", column_name);
    sqlx::query(&query_string)
        .bind(enabled_int)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(())
}

// ===== Recurring Wages Preferences =====

#[utoipa::path(
    get, path = "/api/preferences/recurring-wages",
    responses(
        (status = 200, body = PreferencePayload),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Get recurring wages preference",
    description = "Returns whether recurring wages are enabled for the user."
)]
pub async fn get_recurring_wages_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<PreferencePayload>, PaymeError> {
    let enabled = get_preference(&pool, claims.sub, "recurring_wages_enabled").await?;
    Ok(Json(PreferencePayload { enabled }))
}

#[utoipa::path(
    put, path = "/api/preferences/recurring-wages",
    request_body = PreferencePayload,
    responses(
        (status = 200, body = PreferencePayload),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Set recurring wages preference",
    description = "Enables or disables recurring wages for the user."
)]
pub async fn set_recurring_wages_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<PreferencePayload>,
) -> Result<Json<PreferencePayload>, PaymeError> {
    set_preference(&pool, claims.sub, "recurring_wages_enabled", payload.enabled).await?;
    Ok(Json(PreferencePayload {
        enabled: payload.enabled,
    }))
}

// ===== Current Account Preferences =====

#[utoipa::path(
    get, path = "/api/preferences/current-account",
    responses(
        (status = 200, body = PreferencePayload),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Get current account preference",
    description = "Returns whether current account tracking is enabled for the user."
)]
pub async fn get_current_account_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<PreferencePayload>, PaymeError> {
    let enabled = get_preference(&pool, claims.sub, "current_account_enabled").await?;
    Ok(Json(PreferencePayload { enabled }))
}

#[utoipa::path(
    put, path = "/api/preferences/current-account",
    request_body = PreferencePayload,
    responses(
        (status = 200, body = PreferencePayload),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Set current account preference",
    description = "Enables or disables current account tracking for the user."
)]
pub async fn set_current_account_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<PreferencePayload>,
) -> Result<Json<PreferencePayload>, PaymeError> {
    set_preference(&pool, claims.sub, "current_account_enabled", payload.enabled).await?;
    Ok(Json(PreferencePayload {
        enabled: payload.enabled,
    }))
}

// ===== Custom Savings Goals Preferences =====

#[utoipa::path(
    get, path = "/api/preferences/custom-savings-goals",
    responses(
        (status = 200, body = PreferencePayload),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Get custom savings goals preference",
    description = "Returns whether custom savings goals are enabled for the user."
)]
pub async fn get_custom_savings_goals_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<PreferencePayload>, PaymeError> {
    let enabled = get_preference(&pool, claims.sub, "custom_savings_goals_enabled").await?;
    Ok(Json(PreferencePayload { enabled }))
}

#[utoipa::path(
    put, path = "/api/preferences/custom-savings-goals",
    request_body = PreferencePayload,
    responses(
        (status = 200, body = PreferencePayload),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Set custom savings goals preference",
    description = "Enables or disables custom savings goals for the user."
)]
pub async fn set_custom_savings_goals_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<PreferencePayload>,
) -> Result<Json<PreferencePayload>, PaymeError> {
    set_preference(&pool, claims.sub, "custom_savings_goals_enabled", payload.enabled).await?;
    Ok(Json(PreferencePayload {
        enabled: payload.enabled,
    }))
}
