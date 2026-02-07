use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;
use sqlx::SqlitePool;
use utoipa::ToSchema;
use validator::Validate;

use crate::error::PaymeError;
use crate::middleware::auth::Claims;
use crate::models::{IncomeEntry, RecurringWage};

#[derive(Deserialize, ToSchema, Validate)]
pub struct CreateIncome {
    #[validate(length(min = 1, max = 100))]
    pub label: String,
    #[validate(range(min = 0.0))]
    pub amount: f64,
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct UpdateIncome {
    #[validate(length(min = 1, max = 100))]
    pub label: Option<String>,
    #[validate(range(min = 0.0))]
    pub amount: Option<f64>,
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct CreateRecurringWage {
    #[validate(range(min = 0.0))]
    pub amount: f64,
    #[validate(length(min = 1, max = 100))]
    pub label: String,
    pub effective_from: String, // YYYY-MM-DD format
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct UpdateRecurringWage {
    #[validate(range(min = 0.0))]
    pub amount: Option<f64>,
    #[validate(length(min = 1, max = 100))]
    pub label: Option<String>,
    pub effective_from: Option<String>, // YYYY-MM-DD format
}

#[utoipa::path(
    get, path = "/api/months/{id}/income",
    params(("id" = i64, Path)),
    responses(
        (status = 200, body = [IncomeEntry]),
        (status = 500, description = "Internal server error")
    ),
    tag = "Income",
    summary = "List monthly income",
    description = "Retrieves all sources of income (paychecks, gifts, etc.) recorded for a specific month."
)]
pub async fn list_income(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
) -> Result<Json<Vec<IncomeEntry>>, PaymeError> {
    verify_month_access(&pool, claims.sub, month_id).await?;

    let entries: Vec<IncomeEntry> =
        sqlx::query_as("SELECT id, month_id, label, amount FROM income_entries WHERE month_id = ?")
            .bind(month_id)
            .fetch_all(&pool)
            .await?;

    Ok(Json(entries))
}

#[utoipa::path(
    post, path = "/api/months/{id}/income",
    params(("id" = i64, Path)),
    request_body = CreateIncome,
    responses(
        (status = 200, body = IncomeEntry),
        (status = 500, description = "Internal server error")   
    ),
    tag = "Income",
    summary = "Add income entry",
    description = "Records a new income source for the month. Only available if the month is open."
)]
pub async fn create_income(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
    Json(payload): Json<CreateIncome>,
) -> Result<Json<IncomeEntry>, PaymeError> {
    payload.validate()?;
    verify_month_not_closed(&pool, claims.sub, month_id).await?;

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO income_entries (month_id, label, amount) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(month_id)
    .bind(&payload.label)
    .bind(payload.amount)
    .fetch_one(&pool)
    .await?;

    Ok(Json(IncomeEntry {
        id,
        month_id,
        label: payload.label,
        amount: payload.amount,
    }))
}

#[utoipa::path(
    put,
    path = "/api/months/{month_id}/income/{id}",
    params(
        ("month_id" = i64, Path, description = "Month ID"),
        ("id" = i64, Path, description = "Income Entry ID")
    ),
    request_body = UpdateIncome,
    responses(
        (status = 200, description = "Income updated successfully", body = IncomeEntry),
        (status = 500, description = "Internal server error")
    ),
    tag = "Income",
    summary = "Update income entry",
    description = "Modifies an existing income record's label or amount."
)]
pub async fn update_income(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path((month_id, income_id)): Path<(i64, i64)>,
    Json(payload): Json<UpdateIncome>,
) -> Result<Json<IncomeEntry>, PaymeError> {
    payload.validate()?;
    verify_month_not_closed(&pool, claims.sub, month_id).await?;

    let existing: IncomeEntry = sqlx::query_as(
        "SELECT id, month_id, label, amount FROM income_entries WHERE id = ? AND month_id = ?",
    )
    .bind(income_id)
    .bind(month_id)
    .fetch_optional(&pool)
    .await?
    .ok_or(PaymeError::NotFound)?;

    let label = payload.label.unwrap_or(existing.label);
    let amount = payload.amount.unwrap_or(existing.amount);

    sqlx::query("UPDATE income_entries SET label = ?, amount = ? WHERE id = ?")
        .bind(&label)
        .bind(amount)
        .bind(income_id)
        .execute(&pool)
        .await?;

    Ok(Json(IncomeEntry {
        id: income_id,
        month_id,
        label,
        amount,
    }))
}

#[utoipa::path(
    delete,
    path = "/api/months/{month_id}/income/{id}",
    params(
        ("month_id" = i64, Path, description = "Month ID"),
        ("id" = i64, Path, description = "Income Entry ID")
    ),
    responses(
        (status = 204, description = "Income deleted successfully"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Income",
    summary = "Delete income entry",
    description = "Removes a specific income source from the month's records."
)]
pub async fn delete_income(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path((month_id, income_id)): Path<(i64, i64)>,
) -> Result<StatusCode, PaymeError> {
    verify_month_not_closed(&pool, claims.sub, month_id).await?;

    sqlx::query("DELETE FROM income_entries WHERE id = ? AND month_id = ?")
        .bind(income_id)
        .bind(month_id)
        .execute(&pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn verify_month_access(
    pool: &SqlitePool,
    user_id: i64,
    month_id: i64,
) -> Result<(), PaymeError> {
    let exists: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
            .bind(month_id)
            .bind(user_id)
            .fetch_optional(pool)
            .await?;

    exists.map(|_| ()).ok_or(PaymeError::NotFound)
}

async fn verify_month_not_closed(
    pool: &SqlitePool,
    user_id: i64,
    month_id: i64,
) -> Result<(), PaymeError> {
    let month: Option<(bool,)> =
        sqlx::query_as("SELECT is_closed FROM months WHERE id = ? AND user_id = ?")
            .bind(month_id)
            .bind(user_id)
            .fetch_optional(pool)
            .await?;

    match month {
        Some((true,)) => Err(PaymeError::BadRequest("Month is closed".to_string())),
        Some((false,)) => Ok(()),
        None => Err(PaymeError::NotFound),
    }
}

// ===== Recurring Wages Functions =====

#[utoipa::path(
    get, path = "/api/recurring-wages",
    responses(
        (status = 200, body = [RecurringWage]),
        (status = 500, description = "Internal server error")
    ),
    tag = "Income",
    summary = "Get recurring wages history",
    description = "Retrieves all recurring wage entries for the user, ordered by effective_from date."
)]
pub async fn list_recurring_wages(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<Vec<RecurringWage>>, PaymeError> {
    let wages: Vec<RecurringWage> = sqlx::query_as(
        "SELECT id, user_id, amount, label, effective_from, created_at FROM recurring_wages WHERE user_id = ? ORDER BY effective_from DESC",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    Ok(Json(wages))
}

#[utoipa::path(
    get, path = "/api/recurring-wages/current",
    responses(
        (status = 200, body = RecurringWage),
        (status = 404, description = "No recurring wage configured"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Income",
    summary = "Get current recurring wage",
    description = "Retrieves the current recurring wage entry (most recent with effective_from <= today)."
)]
pub async fn get_current_recurring_wage(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<RecurringWage>, PaymeError> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let wage: Option<RecurringWage> = sqlx::query_as(
        "SELECT id, user_id, amount, label, effective_from, created_at FROM recurring_wages WHERE user_id = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1",
    )
    .bind(claims.sub)
    .bind(&today)
    .fetch_optional(&pool)
    .await?;

    wage.map(Json).ok_or(PaymeError::NotFound)
}

#[utoipa::path(
    post, path = "/api/recurring-wages",
    request_body = CreateRecurringWage,
    responses(
        (status = 201, body = RecurringWage),
        (status = 400, description = "Invalid input"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Income",
    summary = "Create recurring wage",
    description = "Creates a new recurring wage entry. Effective from the specified date onwards."
)]
pub async fn create_recurring_wage(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<CreateRecurringWage>,
) -> Result<(StatusCode, Json<RecurringWage>), PaymeError> {
    payload.validate()?;

    // Validate the effective_from date format
    NaiveDate::parse_from_str(&payload.effective_from, "%Y-%m-%d")
        .map_err(|_| PaymeError::BadRequest("Invalid date format. Use YYYY-MM-DD".to_string()))?;

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO recurring_wages (user_id, amount, label, effective_from) VALUES (?, ?, ?, ?) RETURNING id",
    )
    .bind(claims.sub)
    .bind(payload.amount)
    .bind(&payload.label)
    .bind(&payload.effective_from)
    .fetch_one(&pool)
    .await?;

    let wage: RecurringWage = sqlx::query_as(
        "SELECT id, user_id, amount, label, effective_from, created_at FROM recurring_wages WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&pool)
    .await?;

    Ok((StatusCode::CREATED, Json(wage)))
}

#[utoipa::path(
    put, path = "/api/recurring-wages/{id}",
    params(("id" = i64, Path)),
    request_body = UpdateRecurringWage,
    responses(
        (status = 200, body = RecurringWage),
        (status = 404, description = "Recurring wage not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Income",
    summary = "Update recurring wage",
    description = "Updates an existing recurring wage entry."
)]
pub async fn update_recurring_wage(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(wage_id): Path<i64>,
    Json(payload): Json<UpdateRecurringWage>,
) -> Result<Json<RecurringWage>, PaymeError> {
    payload.validate()?;

    // Verify ownership
    let existing: Option<RecurringWage> = sqlx::query_as(
        "SELECT id, user_id, amount, label, effective_from, created_at FROM recurring_wages WHERE id = ? AND user_id = ?",
    )
    .bind(wage_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?;

    let wage = existing.ok_or(PaymeError::NotFound)?;

    // Validate the effective_from date format if provided
    if let Some(ref effective_from) = payload.effective_from {
        NaiveDate::parse_from_str(effective_from, "%Y-%m-%d")
            .map_err(|_| PaymeError::BadRequest("Invalid date format. Use YYYY-MM-DD".to_string()))?;
    }

    let amount = payload.amount.unwrap_or(wage.amount);
    let label = payload.label.unwrap_or(wage.label);
    let effective_from = payload.effective_from.unwrap_or(wage.effective_from);

    sqlx::query(
        "UPDATE recurring_wages SET amount = ?, label = ?, effective_from = ? WHERE id = ?",
    )
    .bind(amount)
    .bind(&label)
    .bind(&effective_from)
    .bind(wage_id)
    .execute(&pool)
    .await?;

    let updated: RecurringWage = sqlx::query_as(
        "SELECT id, user_id, amount, label, effective_from, created_at FROM recurring_wages WHERE id = ?",
    )
    .bind(wage_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(updated))
}

#[utoipa::path(
    delete, path = "/api/recurring-wages/{id}",
    params(("id" = i64, Path)),
    responses(
        (status = 204),
        (status = 404, description = "Recurring wage not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Income",
    summary = "Delete recurring wage",
    description = "Deletes a recurring wage entry."
)]
pub async fn delete_recurring_wage(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(wage_id): Path<i64>,
) -> Result<StatusCode, PaymeError> {
    let result = sqlx::query("DELETE FROM recurring_wages WHERE id = ? AND user_id = ?")
        .bind(wage_id)
        .bind(claims.sub)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(PaymeError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Get the effective recurring wage for a specific month
pub async fn get_wage_for_month(
    pool: &SqlitePool,
    user_id: i64,
    year: i32,
    month: i32,
) -> Result<Option<RecurringWage>, PaymeError> {
    // Check if recurring wages are enabled
    let enabled: Option<i64> = sqlx::query_scalar(
        "SELECT recurring_wages_enabled FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    if enabled != Some(1) {
        return Ok(None);
    }

    // Create a date for the first day of the month
    let month_date = format!("{:04}-{:02}-01", year, month);

    let wage: Option<RecurringWage> = sqlx::query_as(
        "SELECT id, user_id, amount, label, effective_from, created_at FROM recurring_wages WHERE user_id = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1",
    )
    .bind(user_id)
    .bind(&month_date)
    .fetch_optional(pool)
    .await?;

    Ok(wage)
}
