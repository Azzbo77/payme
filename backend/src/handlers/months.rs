use axum::{
    extract::{Path, State},
    Json,
};
use chrono::{Datelike, Duration, Local, NaiveDate, Utc};
use serde::Deserialize;
use sqlx::SqlitePool;
use utoipa::ToSchema;

use crate::error::PaymeError;
use crate::middleware::auth::Claims;
use crate::models::{
    IncomeEntry, ItemWithCategory, Month, MonthSummary, MonthlyBudgetWithCategory,
    MonthlyFixedExpense, MonthlySavings,
};
use crate::pdf;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateMonthRequest {
    pub year: i32,
    pub month: i32,
}

#[utoipa::path(
    get,
    path = "/api/months",
    responses(
        (status = 200, description = "List all months for the user", body = [Month]),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "List all budget months",
    description = "Retrieves a history of all months created by the user, ordered by date."
)]
pub async fn list_months(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<Vec<Month>>, PaymeError> {
    let months: Vec<Month> = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE user_id = ? ORDER BY year DESC, month DESC",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    Ok(Json(months))
}

#[utoipa::path(
    post,
    path = "/api/months",
    request_body = CreateMonthRequest,
    responses(
        (status = 200, description = "Month created or returned if already exists", body = MonthSummary),
        (status = 400, description = "Invalid month or year"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Create a month for any year/month",
    description = "Creates a new month for the specified year and month. If the month already exists, returns the existing month. This allows navigating to and creating historical months."
)]
pub async fn create_month(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<CreateMonthRequest>,
) -> Result<Json<MonthSummary>, PaymeError> {
    if payload.month < 1 || payload.month > 12 {
        return Err(PaymeError::BadRequest(
            "Month must be between 1 and 12".to_string(),
        ));
    }

    if payload.year < 2000 || payload.year > 2100 {
        return Err(PaymeError::BadRequest(
            "Year must be between 2000 and 2100".to_string(),
        ));
    }

    let existing: Option<Month> = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE user_id = ? AND year = ? AND month = ?",
    )
    .bind(claims.sub)
    .bind(payload.year)
    .bind(payload.month)
    .fetch_optional(&pool)
    .await?;

    let month_record = match existing {
        Some(m) => m,
        None => {
            let id: i64 = sqlx::query_scalar(
                "INSERT INTO months (user_id, year, month) VALUES (?, ?, ?) RETURNING id",
            )
            .bind(claims.sub)
            .bind(payload.year)
            .bind(payload.month)
            .fetch_one(&pool)
            .await?;

            let categories: Vec<(i64, f64)> = sqlx::query_as(
                "SELECT id, default_amount FROM budget_categories WHERE user_id = ?",
            )
            .bind(claims.sub)
            .fetch_all(&pool)
            .await?;

            for (cat_id, default_amount) in categories {
                sqlx::query(
                    "INSERT INTO monthly_budgets (month_id, category_id, allocated_amount) VALUES (?, ?, ?)",
                )
                .bind(id)
                .bind(cat_id)
                .bind(default_amount)
                .execute(&pool)
                .await
                .ok();
            }

            let fixed_expenses: Vec<(String, f64)> =
                sqlx::query_as("SELECT label, amount FROM fixed_expenses WHERE user_id = ? AND auto_generate = 1")
                    .bind(claims.sub)
                    .fetch_all(&pool)
                    .await?;

            for (label, amount) in fixed_expenses {
                sqlx::query(
                    "INSERT INTO monthly_fixed_expenses (month_id, label, amount) VALUES (?, ?, ?)",
                )
                .bind(id)
                .bind(label)
                .bind(amount)
                .execute(&pool)
                .await?;
            }

            // Add recurring wage if one is configured
            if let Ok(Some(wage)) = crate::handlers::income::get_wage_for_month(
                &pool,
                claims.sub,
                payload.year,
                payload.month,
            )
            .await
            {
                sqlx::query(
                    "INSERT INTO income_entries (month_id, label, amount) VALUES (?, ?, ?)",
                )
                .bind(id)
                .bind(&wage.label)
                .bind(wage.amount)
                .execute(&pool)
                .await?;
            }

            let (savings, retirement_savings, savings_goal): (f64, f64, f64) = sqlx::query_as(
                "SELECT savings, retirement_savings, savings_goal FROM users WHERE id = ?",
            )
            .bind(claims.sub)
            .fetch_one(&pool)
            .await?;

            sqlx::query(
                "INSERT INTO monthly_savings (month_id, savings, retirement_savings, savings_goal) VALUES (?, ?, ?, ?)",
            )
            .bind(id)
            .bind(savings)
            .bind(retirement_savings)
            .bind(savings_goal)
            .execute(&pool)
            .await?;

            // Generate recurring items for this month
            let _ = crate::handlers::recurring_items::generate_items_for_month(&pool, id).await;

            Month {
                id,
                user_id: claims.sub,
                year: payload.year,
                month: payload.month,
                is_closed: false,
                closed_at: None,
            }
        }
    };

    get_month_summary(&pool, claims.sub, month_record.id).await
}

#[utoipa::path(
    get,
    path = "/api/months/current",
    responses(
        (status = 200, description = "Get current month or create it if it doesn't exist", body = MonthSummary),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Get current month summary",
    description = "Checks for the current calendar month. If it doesn't exist, it creates it and copies over your default categories."
)]
pub async fn get_or_create_current_month(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<MonthSummary>, PaymeError> {
    let (year, month) = get_current_payday_month(&pool, claims.sub).await?;

    let existing: Option<Month> = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE user_id = ? AND year = ? AND month = ?",
    )
    .bind(claims.sub)
    .bind(year)
    .bind(month)
    .fetch_optional(&pool)
    .await?;

    let month_record = match existing {
        Some(m) => m,
        None => {
            let id: i64 = sqlx::query_scalar(
                "INSERT INTO months (user_id, year, month) VALUES (?, ?, ?) RETURNING id",
            )
            .bind(claims.sub)
            .bind(year)
            .bind(month)
            .fetch_one(&pool)
            .await?;

            let categories: Vec<(i64, f64)> = sqlx::query_as(
                "SELECT id, default_amount FROM budget_categories WHERE user_id = ?",
            )
            .bind(claims.sub)
            .fetch_all(&pool)
            .await?;

            for (cat_id, default_amount) in categories {
                sqlx::query(
                    "INSERT INTO monthly_budgets (month_id, category_id, allocated_amount) VALUES (?, ?, ?)",
                )
                .bind(id)
                .bind(cat_id)
                .bind(default_amount)
                .execute(&pool)
                .await
                .ok();
            }

            let fixed_expenses: Vec<(i64, String, f64)> =
                sqlx::query_as("SELECT id, label, amount FROM fixed_expenses WHERE user_id = ? AND auto_generate = 1")
                    .bind(claims.sub)
                    .fetch_all(&pool)
                    .await?;

            for (expense_id, label, amount) in fixed_expenses {
                sqlx::query(
                    "INSERT INTO monthly_fixed_expenses (month_id, fixed_expense_id, label, amount) VALUES (?, ?, ?, ?)",
                )
                .bind(id)
                .bind(expense_id)
                .bind(label)
                .bind(amount)
                .execute(&pool)
                .await?;
            }

            let (savings, retirement_savings, savings_goal): (f64, f64, f64) = sqlx::query_as(
                "SELECT savings, retirement_savings, savings_goal FROM users WHERE id = ?",
            )
            .bind(claims.sub)
            .fetch_one(&pool)
            .await?;

            sqlx::query(
                "INSERT INTO monthly_savings (month_id, savings, retirement_savings, savings_goal) VALUES (?, ?, ?, ?)",
            )
            .bind(id)
            .bind(savings)
            .bind(retirement_savings)
            .bind(savings_goal)
            .execute(&pool)
            .await?;

            // Generate recurring items for this month
            let _ = crate::handlers::recurring_items::generate_items_for_month(&pool, id).await;

            Month {
                id,
                user_id: claims.sub,
                year,
                month,
                is_closed: false,
                closed_at: None,
            }
        }
    };

    get_month_summary(&pool, claims.sub, month_record.id).await
}

#[utoipa::path(
    get,
    path = "/api/months/{id}",
    params(
        ("id" = i64, Path, description = "Month ID")
    ),
    responses(
        (status = 200, description = "Get full summary for a specific month", body = MonthSummary),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Get specific month details",
    description = "Returns a complete financial summary for a given month ID, including income, fixed expenses, and itemized spending."
)]
pub async fn get_month(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
) -> Result<Json<MonthSummary>, PaymeError> {
    let month: Month = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE id = ? AND user_id = ?",
    )
    .bind(month_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or(PaymeError::NotFound)?;

    get_month_summary(&pool, claims.sub, month.id).await
}

async fn get_month_summary(
    pool: &SqlitePool,
    _user_id: i64,
    month_id: i64,
) -> Result<Json<MonthSummary>, PaymeError> {
    let month: Month = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE id = ?",
    )
    .bind(month_id)
    .fetch_one(pool)
    .await?;

    let income_entries: Vec<IncomeEntry> =
        sqlx::query_as("SELECT id, month_id, label, amount FROM income_entries WHERE month_id = ?")
            .bind(month_id)
            .fetch_all(pool)
            .await?;

    let fixed_expenses: Vec<MonthlyFixedExpense> = sqlx::query_as(
        "SELECT id, month_id, fixed_expense_id, label, amount FROM monthly_fixed_expenses WHERE month_id = ?",
    )
    .bind(month_id)
    .fetch_all(pool)
    .await?;

    let savings: Option<MonthlySavings> =
        sqlx::query_as("SELECT id, month_id, savings, retirement_savings, savings_goal FROM monthly_savings WHERE month_id = ?")
            .bind(month_id)
            .fetch_optional(pool)
            .await?;

    let budgets: Vec<MonthlyBudgetWithCategory> =
        sqlx::query_as::<_, (i64, i64, i64, String, f64)>(
            r#"
        SELECT mb.id, mb.month_id, mb.category_id, bc.label, mb.allocated_amount
        FROM monthly_budgets mb
        JOIN budget_categories bc ON mb.category_id = bc.id
        WHERE mb.month_id = ?
        "#,
        )
        .bind(month_id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(
            |(id, month_id, category_id, category_label, allocated_amount)| {
                MonthlyBudgetWithCategory {
                    id,
                    month_id,
                    category_id,
                    category_label,
                    allocated_amount,
                    spent_amount: 0.0,
                }
            },
        )
        .collect();

    let items: Vec<ItemWithCategory> = sqlx::query_as(
        r#"
        SELECT i.id, i.month_id, i.category_id, bc.label as category_label, i.description, i.amount, i.spent_on, i.savings_destination, i.recurring_item_id
        FROM items i
        JOIN budget_categories bc ON i.category_id = bc.id
        WHERE i.month_id = ?
        ORDER BY i.spent_on DESC
        "#,
    )
    .bind(month_id)
    .fetch_all(pool)
    .await?;

    let budgets: Vec<MonthlyBudgetWithCategory> = budgets
        .into_iter()
        .map(|mut b| {
            b.spent_amount = items
                .iter()
                .filter(|i| i.category_id == b.category_id && i.savings_destination == "none")
                .map(|i| i.amount)
                .sum();
            b
        })
        .collect();

    let total_income: f64 = income_entries.iter().map(|i| i.amount).sum();
    let total_fixed: f64 = fixed_expenses.iter().map(|e| e.amount).sum();
    let total_budgeted: f64 = budgets.iter().map(|b| b.allocated_amount).sum();
    // Only count items as "spent" if they're not being transferred to savings
    let total_spent: f64 = items
        .iter()
        .filter(|i| i.savings_destination == "none")
        .map(|i| i.amount)
        .sum();
    let remaining = total_income - total_fixed - total_spent;

    Ok(Json(MonthSummary {
        month,
        income_entries,
        fixed_expenses,
        budgets,
        items,
        savings,
        total_income,
        total_fixed,
        total_budgeted,
        total_spent,
        remaining,
    }))
}

#[utoipa::path(
    post,
    path = "/api/months/{id}/close",
    params(
        ("id" = i64, Path, description = "Month ID")
    ),
    responses(
        (status = 200, description = "Month closed and PDF snapshot generated", body = Month),
        (status = 400, description = "Month is already closed"),
        (status = 404, description = "Month not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Close month and generate report",
    description = "Finalizes the month, prevents further edits, and generates a PDF snapshot for long-term storage."
)]
pub async fn close_month(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
) -> Result<Json<Month>, PaymeError> {
    let month: Month = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE id = ? AND user_id = ?",
    )
    .bind(month_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or(PaymeError::NotFound)?;

    if month.is_closed {
        return Err(PaymeError::BadRequest(
            "Month is already closed".to_string(),
        ));
    }

    let summary = get_month_summary(&pool, claims.sub, month_id).await?.0;
    let pdf_data = pdf::generate_pdf(&summary).map_err(|e| PaymeError::Internal(e.to_string()))?;

    sqlx::query("INSERT INTO monthly_snapshots (month_id, pdf_data) VALUES (?, ?)")
        .bind(month_id)
        .bind(&pdf_data)
        .execute(&pool)
        .await?;

    let now = Utc::now();
    sqlx::query("UPDATE months SET is_closed = 1, closed_at = ? WHERE id = ?")
        .bind(now)
        .bind(month_id)
        .execute(&pool)
        .await?;

    let updated: Month = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE id = ?",
    )
    .bind(month_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(updated))
}

#[utoipa::path(
    post,
    path = "/api/months/{id}/reopen",
    params(
        ("id" = i64, Path, description = "Month ID")
    ),
    responses(
        (status = 200, description = "Month reopened", body = Month),
        (status = 400, description = "Month is not closed"),
        (status = 404, description = "Month not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Months",
    summary = "Reopen a closed month",
    description = "Reopens a previously closed month, allowing further edits."
)]
pub async fn reopen_month(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
) -> Result<Json<Month>, PaymeError> {
    let month: Month = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE id = ? AND user_id = ?",
    )
    .bind(month_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or(PaymeError::NotFound)?;

    if !month.is_closed {
        return Err(PaymeError::BadRequest("Month is not closed".to_string()));
    }

    sqlx::query("UPDATE months SET is_closed = 0, closed_at = NULL WHERE id = ?")
        .bind(month_id)
        .execute(&pool)
        .await?;

    sqlx::query("DELETE FROM monthly_snapshots WHERE month_id = ?")
        .bind(month_id)
        .execute(&pool)
        .await?;

    let updated: Month = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE id = ?",
    )
    .bind(month_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(updated))
}

#[utoipa::path(
    get,
    path = "/api/months/{id}/pdf",
    params(
        ("id" = i64, Path, description = "Month ID")
    ),
    responses(
        (status = 200, description = "Download the PDF snapshot", content_type = "application/pdf"),
        (status = 404, description = "PDF snapshot not found for this month")
    ),
    tag = "Months",
    summary = "Download month PDF",
    description = "Retrieves the binary PDF data for a closed month's financial report."
)]
pub async fn get_month_pdf(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(month_id): Path<i64>,
) -> Result<impl axum::response::IntoResponse, PaymeError> {
    let _month: Month = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE id = ? AND user_id = ?",
    )
    .bind(month_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or(PaymeError::NotFound)?;

    let snapshot: (Vec<u8>,) =
        sqlx::query_as("SELECT pdf_data FROM monthly_snapshots WHERE month_id = ?")
            .bind(month_id)
            .fetch_optional(&pool)
            .await?
            .ok_or(PaymeError::NotFound)?;

    Ok((
        [
            ("Content-Type", "application/pdf"),
            ("Content-Disposition", "attachment; filename=\"month.pdf\""),
        ],
        snapshot.0,
    ))
}

#[utoipa::path(
    get,
    path = "/api/payday/preferences",
    responses(
        (status = 200, body = serde_json::Value),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Get payday preference",
    description = "Returns the user's configured payday (day of month when accounting period starts)."
)]
pub async fn get_payday(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    let payday: i32 = sqlx::query_scalar("SELECT payday FROM users WHERE id = ?")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await?;

    Ok(Json(serde_json::json!({ "payday": payday })))
}

#[utoipa::path(
    put,
    path = "/api/payday/preferences",
    request_body = serde_json::Value,
    responses(
        (status = 200, body = serde_json::Value),
        (status = 400, description = "Invalid payday"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Set payday preference",
    description = "Sets the user's payday (day of month when accounting period starts). Must be between 1 and 31."
)]
pub async fn set_payday(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    let payday = payload
        .get("payday")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| PaymeError::BadRequest("Invalid payload".to_string()))?;

    if payday < 1 || payday > 31 {
        return Err(PaymeError::BadRequest(
            "Payday must be between 1 and 31".to_string(),
        ));
    }

    sqlx::query("UPDATE users SET payday = ? WHERE id = ?")
        .bind(payday as i32)
        .bind(claims.sub)
        .execute(&pool)
        .await?;

    Ok(Json(serde_json::json!({ "payday": payday })))
}

#[utoipa::path(
    get,
    path = "/api/payday-mode/preferences/enabled",
    responses(
        (status = 200, body = serde_json::Value),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Get payday mode status",
    description = "Returns whether payday-based accounting periods are enabled for the user."
)]
pub async fn get_payday_mode_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    let enabled: i64 = sqlx::query_scalar("SELECT payday_mode_enabled FROM users WHERE id = ?")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await?;

    Ok(Json(serde_json::json!({ "enabled": enabled == 1 })))
}

#[utoipa::path(
    put,
    path = "/api/payday-mode/preferences/enabled",
    request_body = serde_json::Value,
    responses(
        (status = 200, body = serde_json::Value),
        (status = 500, description = "Internal server error")
    ),
    tag = "Preferences",
    summary = "Set payday mode status",
    description = "Enables or disables payday-based accounting periods for the user."
)]
pub async fn set_payday_mode_enabled(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, PaymeError> {
    let enabled = payload
        .get("enabled")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| PaymeError::BadRequest("Invalid payload".to_string()))?;

    let enabled_int = if enabled { 1 } else { 0 };

    sqlx::query("UPDATE users SET payday_mode_enabled = ? WHERE id = ?")
        .bind(enabled_int)
        .bind(claims.sub)
        .execute(&pool)
        .await?;

    Ok(Json(serde_json::json!({ "enabled": enabled })))
}

/// Helper function to calculate the current month
/// If payday mode is enabled, uses payday-based periods
/// If disabled, uses traditional calendar months
async fn get_current_payday_month(pool: &SqlitePool, user_id: i64) -> Result<(i32, i32), PaymeError> {
    // Get the user's payday preferences
    let (payday_mode_enabled, payday_pref): (i32, i32) = sqlx::query_as(
        "SELECT payday_mode_enabled, payday FROM users WHERE id = ?"
    )
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    let today = Local::now().naive_local().date();
    let year = today.year();
    let month = today.month() as i32;
    
    // If payday mode is disabled, use traditional calendar months
    if payday_mode_enabled == 0 {
        return Ok((year, month));
    }
    
    // Otherwise, use payday-based periods
    // Get the user's payday of the current month
    let payday_candidate = NaiveDate::from_ymd_opt(year, month as u32, payday_pref as u32)
        .unwrap_or_else(|| {
            // Fallback if day doesn't exist (e.g., Feb 30)
            // Use last day of month minus 9 days (to stay in the month)
            let last_day = if month == 12 {
                NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap() - Duration::days(1)
            } else {
                NaiveDate::from_ymd_opt(year, (month + 1) as u32, 1).unwrap() - Duration::days(1)
            };
            last_day.min(NaiveDate::from_ymd_opt(year, month as u32, 28).unwrap())
        });
    
    // Adjust payday if it falls on a weekend
    let payday = adjust_payday_for_weekend(payday_candidate);
    
    // If today is on or after the payday, we're in the current payday month
    // Otherwise, we're in the previous payday month
    if today >= payday {
        Ok((year, month))
    } else {
        // We're before the payday, so we're in the previous month's payday period
        let prev_month = month - 1;
        let prev_year = if prev_month < 1 { year - 1 } else { year };
        let prev_month_normalized = if prev_month < 1 { 12 } else { prev_month };
        
        Ok((prev_year, prev_month_normalized))
    }
}

/// Helper function to adjust payday if it falls on a weekend
/// If payday is Saturday, move it to Friday
/// If payday is Sunday, move it to Friday
fn adjust_payday_for_weekend(payday: NaiveDate) -> NaiveDate {
    let weekday = payday.weekday();
    match weekday {
        chrono::Weekday::Sat => payday - Duration::days(1), // Friday
        chrono::Weekday::Sun => payday - Duration::days(2),    // Friday
        _ => payday,
    }
}

