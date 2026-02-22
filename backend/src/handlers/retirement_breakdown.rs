use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::SqlitePool;
use utoipa::ToSchema;
use validator::Validate;

use crate::error::PaymeError;
use crate::middleware::auth::Claims;
use crate::models::RetirementBreakdownItem;

#[derive(Deserialize, ToSchema, Validate)]
pub struct CreateRetirementBreakdownItem {
    #[validate(length(min = 1, max = 255))]
    pub label: String,
    #[validate(range(min = 0.0))]
    pub amount: f64,
    #[serde(rename = "type")]
    pub item_type: String,
    pub ticker: Option<String>,
    pub quantity: Option<f64>,
    pub current_price: Option<f64>,
    pub last_updated: Option<i64>,
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct UpdateRetirementBreakdownItem {
    #[validate(length(min = 1, max = 255))]
    pub label: String,
    #[validate(range(min = 0.0))]
    pub amount: f64,
    #[serde(rename = "type")]
    pub item_type: String,
    pub ticker: Option<String>,
    pub quantity: Option<f64>,
    pub current_price: Option<f64>,
    pub last_updated: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/api/retirement-breakdown",
    responses(
        (status = 200, body = Vec<RetirementBreakdownItem>),
        (status = 500, description = "Internal server error")
    ),
    tag = "Wealth",
    summary = "Get retirement breakdown items",
    description = "Retrieves all breakdown items for the user's retirement savings."
)]
pub async fn get_retirement_breakdown(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<Vec<RetirementBreakdownItem>>, PaymeError> {
    let items: Vec<RetirementBreakdownItem> = sqlx::query_as(
        "SELECT id, user_id, label, amount, item_type, ticker, quantity, current_price, last_updated, created_at, updated_at FROM retirement_breakdown_items WHERE user_id = ? ORDER BY created_at"
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    Ok(Json(items))
}

#[utoipa::path(
    post,
    path = "/api/retirement-breakdown",
    request_body = CreateRetirementBreakdownItem,
    responses(
        (status = 201, body = RetirementBreakdownItem),
        (status = 400, description = "Invalid input"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Wealth",
    summary = "Create retirement breakdown item",
    description = "Adds a new item to the retirement breakdown (e.g., stocks, custom accounts)."
)]
pub async fn create_retirement_breakdown_item(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<CreateRetirementBreakdownItem>,
) -> Result<Json<RetirementBreakdownItem>, PaymeError> {
    payload.validate()?;

    let now = chrono::Utc::now().to_rfc3339();
    
    let result = sqlx::query(
        "INSERT INTO retirement_breakdown_items (user_id, label, amount, item_type, ticker, quantity, current_price, last_updated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(claims.sub)
    .bind(&payload.label)
    .bind(payload.amount)
    .bind(&payload.item_type)
    .bind(&payload.ticker)
    .bind(payload.quantity)
    .bind(payload.current_price)
    .bind(payload.last_updated)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await?;

    let item_id = result.last_insert_rowid();

    let item: RetirementBreakdownItem = sqlx::query_as(
        "SELECT id, user_id, label, amount, item_type, ticker, quantity, current_price, last_updated, created_at, updated_at FROM retirement_breakdown_items WHERE id = ?"
    )
    .bind(item_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

#[utoipa::path(
    put,
    path = "/api/retirement-breakdown/{id}",
    request_body = UpdateRetirementBreakdownItem,
    responses(
        (status = 200, body = RetirementBreakdownItem),
        (status = 404, description = "Item not found"),
        (status = 400, description = "Invalid input"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Wealth",
    summary = "Update retirement breakdown item",
    description = "Updates an existing retirement breakdown item."
)]
pub async fn update_retirement_breakdown_item(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateRetirementBreakdownItem>,
) -> Result<Json<RetirementBreakdownItem>, PaymeError> {
    payload.validate()?;

    // Verify the item belongs to the user
    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM retirement_breakdown_items WHERE id = ? AND user_id = ?"
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?;

    if existing.is_none() {
        return Err(PaymeError::NotFound);
    }

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE retirement_breakdown_items SET label = ?, amount = ?, item_type = ?, ticker = ?, quantity = ?, current_price = ?, last_updated = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&payload.label)
    .bind(payload.amount)
    .bind(&payload.item_type)
    .bind(&payload.ticker)
    .bind(payload.quantity)
    .bind(payload.current_price)
    .bind(payload.last_updated)
    .bind(&now)
    .bind(id)
    .execute(&pool)
    .await?;

    let item: RetirementBreakdownItem = sqlx::query_as(
        "SELECT id, user_id, label, amount, item_type, ticker, quantity, current_price, last_updated, created_at, updated_at FROM retirement_breakdown_items WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(item))
}

#[utoipa::path(
    delete,
    path = "/api/retirement-breakdown/{id}",
    responses(
        (status = 204, description = "Item deleted"),
        (status = 404, description = "Item not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Wealth",
    summary = "Delete retirement breakdown item",
    description = "Removes a retirement breakdown item."
)]
pub async fn delete_retirement_breakdown_item(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(id): Path<i64>,
) -> Result<StatusCode, PaymeError> {
    // Verify the item belongs to the user
    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM retirement_breakdown_items WHERE id = ? AND user_id = ?"
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?;

    if existing.is_none() {
        return Err(PaymeError::NotFound);
    }

    sqlx::query("DELETE FROM retirement_breakdown_items WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
