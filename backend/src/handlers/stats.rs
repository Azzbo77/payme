use axum::{extract::State, Json};
use sqlx::SqlitePool;

use crate::error::PaymeError;
use crate::middleware::auth::Claims;
use crate::models::{CategoryStats, MonthlyStats, StatsResponse};

#[utoipa::path(
    get,
    path = "/api/stats",
    responses(
        (status = 200, description = "Get financial trends and category comparisons", body = StatsResponse),
        (status = 500, description = "Internal server error")
    ),
    tag = "Insights",
    summary = "Generate financial statistics",
    description = "Calculates average monthly spending/income, monthly trends (Net income), and month-over-month category performance comparisons."
)]
pub async fn get_stats(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<StatsResponse>, PaymeError> {
    use std::collections::HashMap;

    let months: Vec<(i64, i32, i32)> = sqlx::query_as(
        "SELECT id, year, month FROM months WHERE user_id = ? ORDER BY year DESC, month DESC",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    if months.is_empty() {
        return Ok(Json(StatsResponse {
            category_comparisons: vec![],
            monthly_trends: vec![],
            average_monthly_spending: 0.0,
            average_monthly_income: 0.0,
        }));
    }

    // Batch query: Get all income by month (1 query instead of N)
    let income_by_month: Vec<(i64, f64)> = sqlx::query_as(
        "SELECT month_id, COALESCE(SUM(amount), 0.0) FROM income_entries WHERE month_id IN (SELECT id FROM months WHERE user_id = ?) GROUP BY month_id",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    // Batch query: Get all spent items by month (1 query instead of N)
    let spent_by_month: Vec<(i64, f64)> = sqlx::query_as(
        "SELECT month_id, COALESCE(SUM(amount), 0.0) FROM items WHERE month_id IN (SELECT id FROM months WHERE user_id = ?) AND savings_destination = 'none' GROUP BY month_id",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    // Convert to maps for fast lookup
    let income_map: HashMap<i64, f64> = income_by_month.into_iter().collect();
    let spent_map: HashMap<i64, f64> = spent_by_month.into_iter().collect();

    // Fetch fixed expenses once (they don't vary by month)
    let fixed_total: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0.0) FROM fixed_expenses WHERE user_id = ?",
    )
    .bind(claims.sub)
    .fetch_one(&pool)
    .await?;

    let mut monthly_trends: Vec<MonthlyStats> = vec![];
    let mut total_spending = 0.0;
    let mut total_income_all = 0.0;

    for (month_id, year, month) in &months {
        let income = *income_map.get(month_id).unwrap_or(&0.0);
        let spent = *spent_map.get(month_id).unwrap_or(&0.0);

        total_spending += spent;
        total_income_all += income;

        monthly_trends.push(MonthlyStats {
            year: *year,
            month: *month,
            total_income: income,
            total_spent: spent,
            total_fixed: fixed_total.0,
            net: income - fixed_total.0 - spent,
        });
    }

    let month_count = months.len() as f64;
    let average_monthly_spending = if month_count > 0.0 {
        total_spending / month_count
    } else {
        0.0
    };
    let average_monthly_income = if month_count > 0.0 {
        total_income_all / month_count
    } else {
        0.0
    };

    let mut category_comparisons: Vec<CategoryStats> = vec![];

    if !months.is_empty() {
        let current_month_id = months[0].0;
        let previous_month_id = months.get(1).map(|m| m.0);

        let categories: Vec<(i64, String)> =
            sqlx::query_as("SELECT id, label FROM budget_categories WHERE user_id = ?")
                .bind(claims.sub)
                .fetch_all(&pool)
                .await?;

        // Batch query: Get all items for current and previous months in one query
        let mut month_ids = vec![current_month_id];
        if let Some(prev_id) = previous_month_id {
            month_ids.push(prev_id);
        }

        let category_data: Vec<(i64, i64, f64)> = sqlx::query_as(
            "SELECT month_id, category_id, COALESCE(SUM(amount), 0.0) FROM items WHERE month_id IN (?, ?) AND savings_destination = 'none' GROUP BY month_id, category_id",
        )
        .bind(current_month_id)
        .bind(previous_month_id)
        .fetch_all(&pool)
        .await?;

        // Build maps: (month_id, category_id) -> amount
        let mut category_map: HashMap<(i64, i64), f64> = HashMap::new();
        for (month_id, cat_id, amount) in category_data {
            category_map.insert((month_id, cat_id), amount);
        }

        for (cat_id, cat_label) in categories {
            let current_spent = *category_map.get(&(current_month_id, cat_id)).unwrap_or(&0.0);
            let previous_spent = previous_month_id
                .and_then(|prev_id| category_map.get(&(prev_id, cat_id)).copied())
                .unwrap_or(0.0);

            let change_amount = current_spent - previous_spent;
            let change_percent = if previous_spent > 0.0 {
                Some((change_amount / previous_spent) * 100.0)
            } else {
                None
            };

            category_comparisons.push(CategoryStats {
                category_id: cat_id,
                category_label: cat_label,
                current_month_spent: current_spent,
                previous_month_spent: previous_spent,
                change_amount,
                change_percent,
            });
        }
    }

    Ok(Json(StatsResponse {
        category_comparisons,
        monthly_trends,
        average_monthly_spending,
        average_monthly_income,
    }))
}
