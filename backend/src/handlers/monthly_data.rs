use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono;
use serde::Deserialize;
use sqlx::SqlitePool;
use utoipa::ToSchema;
use validator::Validate;

use crate::error::PaymeError;
use crate::middleware::auth::Claims;
use crate::models::{CurrentAccountBalance, MonthlyFixedExpense, MonthlySavings};

#[derive(Deserialize, ToSchema, Validate)]
pub struct CreateMonthlyFixedExpense {
    #[validate(length(min = 1, max = 100))]
    pub label: String,
    #[validate(range(min = 0.0))]
    pub amount: f64,
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct UpdateMonthlyFixedExpense {
    #[validate(length(min = 1, max = 100))]
    pub label: Option<String>,
    #[validate(range(min = 0.0))]
    pub amount: Option<f64>,
}

#[utoipa::path(
    post,
    path = "/api/months/{month_id}/fixed-expenses",
    params(("month_id" = i64, Path, description = "Month ID")),
    request_body = CreateMonthlyFixedExpense,
    responses(
        (status = 201, body = MonthlyFixedExpense),
        (status = 404, description = "Month not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Add fixed expense to specific month",
    description = "Adds a fixed expense to a specific month's snapshot."
)]
pub async fn create_monthly_fixed_expense(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
    Json(payload): Json<CreateMonthlyFixedExpense>,
) -> Result<Json<MonthlyFixedExpense>, PaymeError> {
    payload.validate()?;

    let _: (i64,) = sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
        .bind(month_id)
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or(PaymeError::NotFound)?;

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO monthly_fixed_expenses (month_id, label, amount) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(month_id)
    .bind(&payload.label)
    .bind(payload.amount)
    .fetch_one(&pool)
    .await?;

    Ok(Json(MonthlyFixedExpense {
        id,
        month_id,
        label: payload.label,
        amount: payload.amount,
    }))
}

#[utoipa::path(
    put,
    path = "/api/months/{month_id}/fixed-expenses/{id}",
    params(
        ("month_id" = i64, Path, description = "Month ID"),
        ("id" = i64, Path, description = "Fixed expense ID")
    ),
    request_body = UpdateMonthlyFixedExpense,
    responses(
        (status = 200, body = MonthlyFixedExpense),
        (status = 404, description = "Not Found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Update monthly fixed expense",
    description = "Updates a fixed expense for a specific month."
)]
pub async fn update_monthly_fixed_expense(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path((month_id, expense_id)): Path<(i64, i64)>,
    Json(payload): Json<UpdateMonthlyFixedExpense>,
) -> Result<Json<MonthlyFixedExpense>, PaymeError> {
    payload.validate()?;

    let _: (i64,) = sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
        .bind(month_id)
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or(PaymeError::NotFound)?;

    let existing: MonthlyFixedExpense = sqlx::query_as(
        "SELECT id, month_id, label, amount FROM monthly_fixed_expenses WHERE id = ? AND month_id = ?",
    )
    .bind(expense_id)
    .bind(month_id)
    .fetch_optional(&pool)
    .await?
    .ok_or(PaymeError::NotFound)?;

    let label = payload.label.unwrap_or(existing.label);
    let amount = payload.amount.unwrap_or(existing.amount);

    sqlx::query("UPDATE monthly_fixed_expenses SET label = ?, amount = ? WHERE id = ?")
        .bind(&label)
        .bind(amount)
        .bind(expense_id)
        .execute(&pool)
        .await?;

    Ok(Json(MonthlyFixedExpense {
        id: expense_id,
        month_id,
        label,
        amount,
    }))
}

#[utoipa::path(
    delete,
    path = "/api/months/{month_id}/fixed-expenses/{id}",
    params(
        ("month_id" = i64, Path, description = "Month ID"),
        ("id" = i64, Path, description = "Fixed expense ID")
    ),
    responses((status = 204, description = "Deleted")),
    tag = "Months",
    summary = "Delete monthly fixed expense",
    description = "Removes a fixed expense from a specific month."
)]
pub async fn delete_monthly_fixed_expense(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path((month_id, expense_id)): Path<(i64, i64)>,
) -> Result<StatusCode, PaymeError> {
    let _: (i64,) = sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
        .bind(month_id)
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or(PaymeError::NotFound)?;

    sqlx::query("DELETE FROM monthly_fixed_expenses WHERE id = ? AND month_id = ?")
        .bind(expense_id)
        .bind(month_id)
        .execute(&pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct UpdateMonthlySavings {
    #[validate(range(min = 0.0))]
    pub savings: Option<f64>,
    #[validate(range(min = 0.0))]
    pub retirement_savings: Option<f64>,
    #[validate(range(min = 0.0))]
    pub savings_goal: Option<f64>,
}

#[utoipa::path(
    get,
    path = "/api/months/{month_id}/savings",
    params(("month_id" = i64, Path, description = "Month ID")),
    responses(
        (status = 200, body = MonthlySavings),
        (status = 404, description = "Month not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Get monthly savings snapshot",
    description = "Retrieves the savings values for a specific month."
)]
pub async fn get_monthly_savings(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
) -> Result<Json<MonthlySavings>, PaymeError> {
    let _: (i64,) = sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
        .bind(month_id)
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or(PaymeError::NotFound)?;

    let existing: Option<MonthlySavings> = sqlx::query_as(
        "SELECT id, month_id, savings, retirement_savings, savings_goal FROM monthly_savings WHERE month_id = ?",
    )
    .bind(month_id)
    .fetch_optional(&pool)
    .await?;

    match existing {
        Some(savings) => Ok(Json(savings)),
        None => {
            // If no monthly savings exist yet, create one with defaults from user
            let (savings, retirement_savings, savings_goal): (f64, f64, f64) = sqlx::query_as(
                "SELECT savings, retirement_savings, savings_goal FROM users WHERE id = ?",
            )
            .bind(claims.sub)
            .fetch_one(&pool)
            .await?;

            let id: i64 = sqlx::query_scalar(
                "INSERT INTO monthly_savings (month_id, savings, retirement_savings, savings_goal) VALUES (?, ?, ?, ?) RETURNING id",
            )
            .bind(month_id)
            .bind(savings)
            .bind(retirement_savings)
            .bind(savings_goal)
            .fetch_one(&pool)
            .await?;

            Ok(Json(MonthlySavings {
                id,
                month_id,
                savings,
                retirement_savings,
                savings_goal,
            }))
        }
    }
}

#[utoipa::path(
    put,
    path = "/api/months/{month_id}/savings",
    params(("month_id" = i64, Path, description = "Month ID")),
    request_body = UpdateMonthlySavings,
    responses(
        (status = 200, body = MonthlySavings),
        (status = 404, description = "Month not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Update monthly savings snapshot",
    description = "Updates the savings values for a specific month."
)]
pub async fn update_monthly_savings(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
    Json(payload): Json<UpdateMonthlySavings>,
) -> Result<Json<MonthlySavings>, PaymeError> {
    payload.validate()?;

    let _: (i64,) = sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
        .bind(month_id)
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or(PaymeError::NotFound)?;

    let existing: Option<MonthlySavings> = sqlx::query_as(
        "SELECT id, month_id, savings, retirement_savings, savings_goal FROM monthly_savings WHERE month_id = ?",
    )
    .bind(month_id)
    .fetch_optional(&pool)
    .await?;

    let (savings, retirement_savings, savings_goal) = match existing {
        Some(ref e) => (
            payload.savings.unwrap_or(e.savings),
            payload.retirement_savings.unwrap_or(e.retirement_savings),
            payload.savings_goal.unwrap_or(e.savings_goal),
        ),
        None => (
            payload.savings.unwrap_or(0.0),
            payload.retirement_savings.unwrap_or(0.0),
            payload.savings_goal.unwrap_or(0.0),
        ),
    };

    if existing.is_some() {
        sqlx::query(
            "UPDATE monthly_savings SET savings = ?, retirement_savings = ?, savings_goal = ? WHERE month_id = ?",
        )
        .bind(savings)
        .bind(retirement_savings)
        .bind(savings_goal)
        .bind(month_id)
        .execute(&pool)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO monthly_savings (month_id, savings, retirement_savings, savings_goal) VALUES (?, ?, ?, ?)",
        )
        .bind(month_id)
        .bind(savings)
        .bind(retirement_savings)
        .bind(savings_goal)
        .execute(&pool)
        .await?;
    }

    let updated: MonthlySavings = sqlx::query_as(
        "SELECT id, month_id, savings, retirement_savings, savings_goal FROM monthly_savings WHERE month_id = ?",
    )
    .bind(month_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(updated))
}
#[utoipa::path(
    get,
    path = "/api/months/{month_id}/current-account",
    params(("month_id" = i64, Path, description = "Month ID")),
    responses(
        (status = 200, body = CurrentAccountBalance),
        (status = 404, description = "Month not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Get current account balance",
    description = "Retrieves the current account balance for a specific month."
)]
pub async fn get_monthly_current_account(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
) -> Result<Json<CurrentAccountBalance>, PaymeError> {
    let _: (i64,) = sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
        .bind(month_id)
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or(PaymeError::NotFound)?;

    let balance: Option<CurrentAccountBalance> = sqlx::query_as(
        "SELECT id, month_id, balance FROM monthly_current_account WHERE month_id = ?",
    )
    .bind(month_id)
    .fetch_optional(&pool)
    .await?;

    match balance {
        Some(b) => Ok(Json(b)),
        None => {
            // Create with 0 balance if doesn't exist
            let id: i64 = sqlx::query_scalar(
                "INSERT INTO monthly_current_account (month_id, balance) VALUES (?, 0) RETURNING id",
            )
            .bind(month_id)
            .fetch_one(&pool)
            .await?;

            Ok(Json(CurrentAccountBalance {
                id,
                month_id,
                balance: 0.0,
            }))
        }
    }
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct UpdateCurrentAccount {
    #[validate(range(min = -999999.99, max = 999999.99))]
    pub balance: f64,
}

#[utoipa::path(
    put,
    path = "/api/months/{month_id}/current-account",
    params(("month_id" = i64, Path, description = "Month ID")),
    request_body = UpdateCurrentAccount,
    responses(
        (status = 200, body = CurrentAccountBalance),
        (status = 404, description = "Month not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Update current account balance",
    description = "Updates the current account balance for a specific month."
)]
pub async fn update_monthly_current_account(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
    Json(payload): Json<UpdateCurrentAccount>,
) -> Result<Json<CurrentAccountBalance>, PaymeError> {
    payload.validate()?;

    let _: (i64,) = sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
        .bind(month_id)
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or(PaymeError::NotFound)?;

    let existing: Option<CurrentAccountBalance> = sqlx::query_as(
        "SELECT id, month_id, balance FROM monthly_current_account WHERE month_id = ?",
    )
    .bind(month_id)
    .fetch_optional(&pool)
    .await?;

    if let Some(_) = existing {
        sqlx::query("UPDATE monthly_current_account SET balance = ? WHERE month_id = ?")
            .bind(payload.balance)
            .bind(month_id)
            .execute(&pool)
            .await?;
    } else {
        sqlx::query("INSERT INTO monthly_current_account (month_id, balance) VALUES (?, ?)")
            .bind(month_id)
            .bind(payload.balance)
            .execute(&pool)
            .await?;
    }

    let updated: CurrentAccountBalance = sqlx::query_as(
        "SELECT id, month_id, balance FROM monthly_current_account WHERE month_id = ?",
    )
    .bind(month_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(updated))
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct TransferRequest {
    #[validate(range(min = 0.01))]
    pub amount: f64,
    pub destination: String, // "savings" or "retirement_savings"
}

#[utoipa::path(
    get,
    path = "/api/current-account/preferences/enabled",
    responses(
        (status = 200, body = serde_json::Value),
        (status = 500, description = "Internal server error")
    ),
    tag = "Current Account",
    summary = "Get current account enabled status",
    description = "Retrieves whether current account tracking is enabled for the user."
)]
pub async fn get_current_account_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    let enabled: i64 = sqlx::query_scalar(
        "SELECT current_account_enabled FROM users WHERE id = ?",
    )
    .bind(claims.sub)
    .fetch_one(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "enabled": enabled == 1 })))
}

#[utoipa::path(
    put,
    path = "/api/current-account/preferences/enabled",
    request_body = serde_json::Value,
    responses(
        (status = 200, body = serde_json::Value),
        (status = 500, description = "Internal server error")
    ),
    tag = "Current Account",
    summary = "Set current account enabled status",
    description = "Enables or disables current account tracking for the user."
)]
pub async fn set_current_account_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    let enabled = payload
        .get("enabled")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| PaymeError::BadRequest("Invalid payload".to_string()))?;

    let enabled_int = if enabled { 1 } else { 0 };

    sqlx::query("UPDATE users SET current_account_enabled = ? WHERE id = ?")
        .bind(enabled_int)
        .bind(claims.sub)
        .execute(&pool)
        .await?;

    Ok(Json(serde_json::json!({ "enabled": enabled })))
}

#[utoipa::path(
    get,
    path = "/api/custom-savings-goals/preferences/enabled",
    responses(
        (status = 200, body = serde_json::Value),
        (status = 500, description = "Internal server error")
    ),
    tag = "Custom Savings Goals",
    summary = "Get custom savings goals enabled status",
    description = "Retrieves whether custom savings goals are enabled for the user."
)]
pub async fn get_custom_savings_goals_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    let enabled: i64 = sqlx::query_scalar(
        "SELECT custom_savings_goals_enabled FROM users WHERE id = ?",
    )
    .bind(claims.sub)
    .fetch_one(&pool)
    .await?;

    Ok(Json(serde_json::json!({ "enabled": enabled == 1 })))
}

#[utoipa::path(
    put,
    path = "/api/custom-savings-goals/preferences/enabled",
    request_body = serde_json::Value,
    responses(
        (status = 200, body = serde_json::Value),
        (status = 500, description = "Internal server error")
    ),
    tag = "Custom Savings Goals",
    summary = "Set custom savings goals enabled status",
    description = "Enables or disables custom savings goals for the user."
)]
pub async fn set_custom_savings_goals_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    let enabled = payload
        .get("enabled")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| PaymeError::BadRequest("Invalid payload".to_string()))?;

    let enabled_int = if enabled { 1 } else { 0 };

    sqlx::query("UPDATE users SET custom_savings_goals_enabled = ? WHERE id = ?")
        .bind(enabled_int)
        .bind(claims.sub)
        .execute(&pool)
        .await?;

    Ok(Json(serde_json::json!({ "enabled": enabled })))
}

#[utoipa::path(
    post,
    path = "/api/months/{month_id}/transfer",
    params(("month_id" = i64, Path, description = "Month ID")),
    request_body = TransferRequest,
    responses(
        (status = 200, body = serde_json::Value),
        (status = 400, description = "Invalid destination or insufficient balance"),
        (status = 404, description = "Month not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Transfer money between accounts",
    description = "Transfers money from current account to savings or retirement savings."
)]
pub async fn transfer_from_current_account(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
    Json(payload): Json<TransferRequest>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    payload.validate()?;

    let valid_destinations = ["savings", "retirement_savings"];
    if !valid_destinations.contains(&payload.destination.as_str()) {
        return Err(PaymeError::BadRequest(
            "Destination must be 'savings' or 'retirement_savings'".to_string(),
        ));
    }

    let _: (i64,) = sqlx::query_as("SELECT id FROM months WHERE id = ? AND user_id = ?")
        .bind(month_id)
        .bind(claims.sub)
        .fetch_optional(&pool)
        .await?
        .ok_or(PaymeError::NotFound)?;

    // Get current account balance
    let current_balance: Option<f64> = sqlx::query_scalar(
        "SELECT balance FROM monthly_current_account WHERE month_id = ?",
    )
    .bind(month_id)
    .fetch_optional(&pool)
    .await?;

    let current_balance = current_balance.unwrap_or(0.0);

    if current_balance < payload.amount {
        return Err(PaymeError::BadRequest(
            "Insufficient balance in current account".to_string(),
        ));
    }

    // Get first category for transfer item
    let category_id: i64 = sqlx::query_scalar(
        "SELECT id FROM budget_categories WHERE user_id = ? ORDER BY id LIMIT 1"
    )
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or(PaymeError::BadRequest("No categories found".to_string()))?;

    let today = chrono::Local::now().naive_local().date();

    // Create item entry for transfer record
    sqlx::query(
        "INSERT INTO items (month_id, category_id, description, amount, spent_on, savings_destination) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(month_id)
    .bind(category_id)
    .bind(format!("Transfer to {}", payload.destination.replace("_", " ")))
    .bind(payload.amount)
    .bind(today)
    .bind(&payload.destination)
    .execute(&pool)
    .await?;

    // Update current account
    sqlx::query("UPDATE monthly_current_account SET balance = balance - ? WHERE month_id = ?")
        .bind(payload.amount)
        .bind(month_id)
        .execute(&pool)
        .await?;

    // Update savings or retirement savings
    if payload.destination == "savings" {
        sqlx::query("UPDATE monthly_savings SET savings = savings + ? WHERE month_id = ?")
            .bind(payload.amount)
            .bind(month_id)
            .execute(&pool)
            .await?;
        
        // Update user-level savings
        sqlx::query("UPDATE users SET savings = savings + ? WHERE id = ?")
            .bind(payload.amount)
            .bind(claims.sub)
            .execute(&pool)
            .await?;
    } else {
        sqlx::query("UPDATE monthly_savings SET retirement_savings = retirement_savings + ? WHERE month_id = ?")
            .bind(payload.amount)
            .bind(month_id)
            .execute(&pool)
            .await?;
        
        // Update user-level retirement savings
        sqlx::query("UPDATE users SET retirement_savings = retirement_savings + ? WHERE id = ?")
            .bind(payload.amount)
            .bind(claims.sub)
            .execute(&pool)
            .await?;
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Transferred {} to {}", payload.amount, payload.destination)
    })))
}
