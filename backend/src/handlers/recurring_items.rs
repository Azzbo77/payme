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
use crate::models::RecurringItem;

fn default_savings_destination() -> String {
    "none".to_string()
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct CreateRecurringItem {
    pub category_id: i64,
    #[validate(length(min = 1, max = 200))]
    pub description: String,
    #[validate(range(min = 0.0))]
    pub amount: f64,
    #[validate(range(min = 1, max = 31))]
    pub day_of_month: i32,
    #[serde(default = "default_savings_destination")]
    pub savings_destination: String,
}

#[derive(Deserialize, ToSchema, Validate)]
pub struct UpdateRecurringItem {
    pub category_id: Option<i64>,
    #[validate(length(min = 1, max = 200))]
    pub description: Option<String>,
    #[validate(range(min = 0.0))]
    pub amount: Option<f64>,
    #[validate(range(min = 1, max = 31))]
    pub day_of_month: Option<i32>,
    pub savings_destination: Option<String>,
    pub is_active: Option<bool>,
}

#[utoipa::path(
    get, path = "/api/recurring-items",
    responses(
        (status = 200, body = [RecurringItem]),
        (status = 500, description = "Internal server error")
    ),
    tag = "Recurring Items",
    summary = "List recurring transaction templates",
    description = "Retrieves all recurring transaction templates for the authenticated user."
)]
pub async fn list_recurring_items(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<Vec<RecurringItem>>, PaymeError> {
    let items: Vec<RecurringItem> = sqlx::query_as(
        r#"
        SELECT id, user_id, category_id, description, amount, day_of_month, savings_destination, is_active, created_at
        FROM recurring_items
        WHERE user_id = ? AND is_active = 1
        ORDER BY day_of_month ASC
        "#,
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    Ok(Json(items))
}

#[utoipa::path(
    post, path = "/api/recurring-items",
    request_body = CreateRecurringItem,
    responses(
        (status = 200, body = RecurringItem),
        (status = 400, description = "Invalid input"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Recurring Items",
    summary = "Create recurring transaction template",
    description = "Creates a new recurring transaction template that will auto-populate items on the specified day each month."
)]
pub async fn create_recurring_item(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(payload): Json<CreateRecurringItem>,
) -> Result<Json<RecurringItem>, PaymeError> {
    payload.validate()?;

    let _category: (i64,) =
        sqlx::query_as("SELECT id FROM budget_categories WHERE id = ? AND user_id = ?")
            .bind(payload.category_id)
            .bind(claims.sub)
            .fetch_optional(&pool)
            .await?
            .ok_or(PaymeError::BadRequest("Invalid category".to_string()))?;

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO recurring_items (user_id, category_id, description, amount, day_of_month, savings_destination, is_active) VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING id",
    )
    .bind(claims.sub)
    .bind(payload.category_id)
    .bind(&payload.description)
    .bind(payload.amount)
    .bind(payload.day_of_month)
    .bind(&payload.savings_destination)
    .fetch_one(&pool)
    .await?;

    let created_at = chrono::Utc::now().to_rfc3339();

    Ok(Json(RecurringItem {
        id,
        user_id: claims.sub,
        category_id: payload.category_id,
        description: payload.description,
        amount: payload.amount,
        day_of_month: payload.day_of_month,
        savings_destination: payload.savings_destination,
        is_active: true,
        created_at,
    }))
}

#[utoipa::path(
    put,
    path = "/api/recurring-items/{id}",
    params(
        ("id" = i64, Path, description = "Recurring Item ID")
    ),
    request_body = UpdateRecurringItem,
    responses(
        (status = 200, description = "Recurring item updated successfully", body = RecurringItem),
        (status = 404, description = "Recurring item not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Recurring Items",
    summary = "Update recurring transaction template",
    description = "Updates an existing recurring transaction template."
)]
pub async fn update_recurring_item(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(item_id): Path<i64>,
    Json(payload): Json<UpdateRecurringItem>,
) -> Result<Json<RecurringItem>, PaymeError> {
    payload.validate()?;

    let existing: RecurringItem = sqlx::query_as(
        "SELECT id, user_id, category_id, description, amount, day_of_month, savings_destination, is_active, created_at FROM recurring_items WHERE id = ? AND user_id = ?",
    )
    .bind(item_id)
    .bind(claims.sub)
    .fetch_optional(&pool)
    .await?
    .ok_or(PaymeError::NotFound)?;

    let category_id = payload.category_id.unwrap_or(existing.category_id);
    let description = payload.description.unwrap_or(existing.description);
    let amount = payload.amount.unwrap_or(existing.amount);
    let day_of_month = payload.day_of_month.unwrap_or(existing.day_of_month);
    let savings_destination = payload
        .savings_destination
        .unwrap_or(existing.savings_destination.clone());
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    if payload.category_id.is_some() {
        let _category: (i64,) =
            sqlx::query_as("SELECT id FROM budget_categories WHERE id = ? AND user_id = ?")
                .bind(category_id)
                .bind(claims.sub)
                .fetch_optional(&pool)
                .await?
                .ok_or(PaymeError::BadRequest("Invalid category".to_string()))?;
    }

    sqlx::query(
        "UPDATE recurring_items SET category_id = ?, description = ?, amount = ?, day_of_month = ?, savings_destination = ?, is_active = ? WHERE id = ?",
    )
    .bind(category_id)
    .bind(&description)
    .bind(amount)
    .bind(day_of_month)
    .bind(&savings_destination)
    .bind(is_active as i32)
    .bind(item_id)
    .execute(&pool)
    .await?;

    Ok(Json(RecurringItem {
        id: item_id,
        user_id: claims.sub,
        category_id,
        description,
        amount,
        day_of_month,
        savings_destination,
        is_active,
        created_at: existing.created_at,
    }))
}

#[utoipa::path(
    delete,
    path = "/api/recurring-items/{id}",
    params(
        ("id" = i64, Path, description = "Recurring Item ID")
    ),
    responses(
        (status = 204, description = "Recurring item deleted successfully"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Recurring Items",
    summary = "Delete recurring transaction template",
    description = "Deactivates a recurring transaction template so it no longer generates items."
)]
pub async fn delete_recurring_item(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(item_id): Path<i64>,
) -> Result<StatusCode, PaymeError> {
    let exists: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM recurring_items WHERE id = ? AND user_id = ?")
            .bind(item_id)
            .bind(claims.sub)
            .fetch_optional(&pool)
            .await?;

    exists.ok_or(PaymeError::NotFound)?;

    sqlx::query("UPDATE recurring_items SET is_active = 0 WHERE id = ? AND user_id = ?")
        .bind(item_id)
        .bind(claims.sub)
        .execute(&pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Auto-generate items from recurring templates for a given month
pub async fn generate_items_for_month(
    pool: &SqlitePool,
    month_id: i64,
) -> Result<(), PaymeError> {
    // Get the month details
    let (user_id, year, month): (i64, i32, i32) =
        sqlx::query_as("SELECT user_id, year, month FROM months WHERE id = ?")
            .bind(month_id)
            .fetch_optional(pool)
            .await?
            .ok_or(PaymeError::NotFound)?;

    // Get all active recurring items for this user
    let recurring_items: Vec<(i64, i64, String, f64, i32, String)> = sqlx::query_as(
        "SELECT id, category_id, description, amount, day_of_month, savings_destination FROM recurring_items WHERE user_id = ? AND is_active = 1"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // For each recurring item, create a transaction on the specified day
    for (recurring_id, cat_id, desc, amt, day, dest) in recurring_items {
        // Create a NaiveDate for the transaction
        // If the day doesn't exist in that month, use the last day of the month
        let num_days = last_day_of_month(year, month);
        let day_to_use = std::cmp::min(day, num_days);

        let spent_on = chrono::NaiveDate::from_ymd_opt(year, month as u32, day_to_use as u32)
            .ok_or(PaymeError::BadRequest("Invalid date for recurring item".to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO items (month_id, category_id, description, amount, spent_on, savings_destination, recurring_item_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(month_id)
        .bind(cat_id)
        .bind(&desc)
        .bind(amt)
        .bind(spent_on.format("%Y-%m-%d").to_string())
        .bind(&dest)
        .bind(recurring_id)
        .execute(pool)
        .await?;

        // Update savings destination balances if needed
        match dest.as_str() {
            "savings" => {
                sqlx::query("UPDATE users SET savings = savings + ? WHERE id = ?")
                    .bind(amt)
                    .bind(user_id)
                    .execute(pool)
                    .await?;
            }
            "retirement_savings" => {
                sqlx::query("UPDATE users SET retirement_savings = retirement_savings + ? WHERE id = ?")
                    .bind(amt)
                    .bind(user_id)
                    .execute(pool)
                    .await?;
            }
            _ => {}
        }
    }

    Ok(())
}

/// Helper function to get the last day of a month
fn last_day_of_month(year: i32, month: i32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_last_day_of_month() {
        assert_eq!(last_day_of_month(2024, 1), 31);
        assert_eq!(last_day_of_month(2024, 2), 29); // Leap year
        assert_eq!(last_day_of_month(2023, 2), 28); // Non-leap year
        assert_eq!(last_day_of_month(2024, 4), 30);
        assert_eq!(last_day_of_month(2024, 12), 31);
    }
}
