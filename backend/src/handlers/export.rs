use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use utoipa::ToSchema;

use crate::error::PaymeError;
use crate::middleware::auth::Claims;
use crate::models::{BudgetCategory, FixedExpense, IncomeEntry, Item, Month};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UserExport {
    pub version: u32,
    pub savings: Option<f64>,
    pub retirement_savings: Option<f64>,
    pub preferences: Option<PreferencesExport>,
    pub fixed_expenses: Vec<FixedExpenseExport>,
    pub categories: Vec<CategoryExport>,
    pub recurring_wages: Vec<RecurringWageExport>,
    pub months: Vec<MonthExport>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct PreferencesExport {
    pub recurring_wages_enabled: bool,
    pub current_account_enabled: bool,
    pub custom_savings_goals_enabled: bool,
    pub fixed_expenses_enabled: bool,
    pub stock_tracking_enabled: bool,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct FixedExpenseExport {
    pub label: String,
    pub amount: f64,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct RecurringWageExport {
    pub label: String,
    pub amount: f64,
    pub effective_from: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct CategoryExport {
    pub label: String,
    pub default_amount: f64,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct MonthExport {
    pub year: i32,
    pub month: i32,
    pub is_closed: bool,
    pub current_account_balance: Option<f64>,
    pub monthly_savings_amount: Option<f64>,
    pub monthly_savings_goal: Option<f64>,
    pub monthly_retirement_savings_goal: Option<f64>,
    pub income_entries: Vec<IncomeExport>,
    pub budgets: Vec<BudgetExport>,
    pub items: Vec<ItemExport>,
    pub monthly_fixed_expenses: Vec<MonthlyFixedExpenseExport>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct MonthlyFixedExpenseExport {
    pub label: String,
    pub amount: f64,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct IncomeExport {
    pub label: String,
    pub amount: f64,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct BudgetExport {
    pub category_label: String,
    pub allocated_amount: f64,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct ItemExport {
    pub category_label: String,
    pub description: String,
    pub amount: f64,
    pub spent_on: String,
    pub savings_destination: String,
}

#[utoipa::path(
    get,
    path = "/api/export/json",
    responses(
        (status = 200, description = "A complete JSON export of all user data", body = UserExport),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error during database aggregation")
    ),
    tag = "Data Management",
    summary = "Export all data to JSON",
    description = "Gathers all user profile info, fixed expenses, categories, and monthly history into a single portable JSON object."
)]
pub async fn export_json(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<UserExport>, PaymeError> {
    let savings: f64 = sqlx::query_scalar("SELECT savings FROM users WHERE id = ?")
        .bind(claims.sub)
        .fetch_one(&pool)
        .await
        .unwrap_or(0.0);

    let retirement_savings: f64 =
        sqlx::query_scalar("SELECT retirement_savings FROM users WHERE id = ?")
            .bind(claims.sub)
            .fetch_one(&pool)
            .await
            .unwrap_or(0.0);

    // Get user preferences
    let preferences: (i32, i32, i32, i32, i32) = sqlx::query_as(
        "SELECT recurring_wages_enabled, current_account_enabled, custom_savings_goals_enabled, fixed_expenses_enabled, COALESCE((SELECT 0), 0) as stock_tracking_enabled FROM users WHERE id = ?"
    )
    .bind(claims.sub)
    .fetch_one(&pool)
    .await
    .unwrap_or((1, 1, 1, 0, 0));

    let prefs = PreferencesExport {
        recurring_wages_enabled: preferences.0 != 0,
        current_account_enabled: preferences.1 != 0,
        custom_savings_goals_enabled: preferences.2 != 0,
        fixed_expenses_enabled: preferences.3 != 0,
        stock_tracking_enabled: preferences.4 != 0,
    };

    let fixed_expenses: Vec<FixedExpense> =
        sqlx::query_as("SELECT id, user_id, label, amount FROM fixed_expenses WHERE user_id = ?")
            .bind(claims.sub)
            .fetch_all(&pool)
            .await?;

    let recurring_wages: Vec<(String, f64, String)> = sqlx::query_as(
        "SELECT label, amount, effective_from FROM recurring_wages WHERE user_id = ? ORDER BY effective_from DESC",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    let categories: Vec<BudgetCategory> = sqlx::query_as(
        "SELECT id, user_id, label, default_amount FROM budget_categories WHERE user_id = ?",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    let months: Vec<Month> = sqlx::query_as(
        "SELECT id, user_id, year, month, is_closed, closed_at FROM months WHERE user_id = ? ORDER BY year, month",
    )
    .bind(claims.sub)
    .fetch_all(&pool)
    .await?;

    let mut month_exports = Vec::new();

    for m in &months {
        let income_entries: Vec<IncomeEntry> = sqlx::query_as(
            "SELECT id, month_id, label, amount FROM income_entries WHERE month_id = ?",
        )
        .bind(m.id)
        .fetch_all(&pool)
        .await?;

        let budgets: Vec<(String, f64)> = sqlx::query_as(
            r#"
            SELECT bc.label, mb.allocated_amount
            FROM monthly_budgets mb
            JOIN budget_categories bc ON mb.category_id = bc.id
            WHERE mb.month_id = ?
            "#,
        )
        .bind(m.id)
        .fetch_all(&pool)
        .await?;

        let items: Vec<Item> = sqlx::query_as(
            "SELECT id, month_id, category_id, description, amount, spent_on, savings_destination FROM items WHERE month_id = ?",
        )
        .bind(m.id)
        .fetch_all(&pool)
        .await?;

        // Get current account balance for this month
        let current_account_balance: Option<f64> =
            sqlx::query_scalar("SELECT balance FROM monthly_current_account WHERE month_id = ?")
                .bind(m.id)
                .fetch_optional(&pool)
                .await?;

        // Get monthly savings amount
        let monthly_savings: Option<f64> =
            sqlx::query_scalar("SELECT savings FROM monthly_savings WHERE month_id = ?")
                .bind(m.id)
                .fetch_optional(&pool)
                .await?;

        // Get monthly savings goal
        let monthly_savings_goal: Option<f64> =
            sqlx::query_scalar("SELECT savings_goal FROM monthly_savings WHERE month_id = ?")
                .bind(m.id)
                .fetch_optional(&pool)
                .await?;

        // Get monthly retirement savings goal
        let monthly_retirement_savings_goal: Option<f64> =
            sqlx::query_scalar("SELECT retirement_savings FROM monthly_savings WHERE month_id = ?")
                .bind(m.id)
                .fetch_optional(&pool)
                .await?;

        // Get monthly fixed expenses for this month
        let monthly_fixed_expenses: Vec<(String, f64)> =
            sqlx::query_as("SELECT label, amount FROM monthly_fixed_expenses WHERE month_id = ?")
                .bind(m.id)
                .fetch_all(&pool)
                .await?;

        let mut item_exports = Vec::new();
        for item in items {
            let cat = categories.iter().find(|c| c.id == item.category_id);
            if let Some(cat) = cat {
                item_exports.push(ItemExport {
                    category_label: cat.label.clone(),
                    description: item.description,
                    amount: item.amount,
                    spent_on: item.spent_on.to_string(),
                    savings_destination: item.savings_destination,
                });
            }
        }

        month_exports.push(MonthExport {
            year: m.year,
            month: m.month,
            is_closed: m.is_closed,
            current_account_balance,
            monthly_savings_amount: monthly_savings,
            monthly_savings_goal,
            monthly_retirement_savings_goal,
            income_entries: income_entries
                .into_iter()
                .map(|i| IncomeExport {
                    label: i.label,
                    amount: i.amount,
                })
                .collect(),
            budgets: budgets
                .into_iter()
                .map(|(label, amount)| BudgetExport {
                    category_label: label,
                    allocated_amount: amount,
                })
                .collect(),
            items: item_exports,
            monthly_fixed_expenses: monthly_fixed_expenses
                .into_iter()
                .map(|(label, amount)| MonthlyFixedExpenseExport { label, amount })
                .collect(),
        });
    }

    Ok(Json(UserExport {
        version: 2,
        savings: Some(savings),
        retirement_savings: Some(retirement_savings),
        preferences: Some(prefs),
        fixed_expenses: fixed_expenses
            .into_iter()
            .map(|e| FixedExpenseExport {
                label: e.label,
                amount: e.amount,
            })
            .collect(),
        recurring_wages: recurring_wages
            .into_iter()
            .map(|(label, amount, effective_from)| RecurringWageExport {
                label,
                amount,
                effective_from,
            })
            .collect(),
        categories: categories
            .into_iter()
            .map(|c| CategoryExport {
                label: c.label,
                default_amount: c.default_amount,
            })
            .collect(),
        months: month_exports,
    }))
}

#[utoipa::path(
    post,
    path = "/api/import/json",
    request_body = UserExport,
    responses(
        (status = 200, description = "Data imported successfully. Note: This overwrites existing user data."),
        (status = 500, description = "Internal server error during database restoration")
    ),
    tag = "Data Management",
    summary = "Import data from JSON",
    description = "Overwrites the current user's database records with the provided JSON export. This action is destructive and irreversible."
)]
pub async fn import_json(
    State(pool): State<SqlitePool>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(data): Json<UserExport>,
) -> Result<StatusCode, PaymeError> {
    let mut tx = pool.begin().await?;

    let months: Vec<(i64,)> = sqlx::query_as("SELECT id FROM months WHERE user_id = ?")
        .bind(claims.sub)
        .fetch_all(&mut *tx)
        .await?;

    for (month_id,) in &months {
        sqlx::query("DELETE FROM items WHERE month_id = ?")
            .bind(month_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM monthly_budgets WHERE month_id = ?")
            .bind(month_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM income_entries WHERE month_id = ?")
            .bind(month_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM monthly_snapshots WHERE month_id = ?")
            .bind(month_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM monthly_fixed_expenses WHERE month_id = ?")
            .bind(month_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM monthly_current_account WHERE month_id = ?")
            .bind(month_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM monthly_savings WHERE month_id = ?")
            .bind(month_id)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query("DELETE FROM months WHERE user_id = ?")
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM budget_categories WHERE user_id = ?")
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM fixed_expenses WHERE user_id = ?")
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM recurring_wages WHERE user_id = ?")
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;

    if let Some(savings) = data.savings {
        sqlx::query("UPDATE users SET savings = ? WHERE id = ?")
            .bind(savings)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(retirement_savings) = data.retirement_savings {
        sqlx::query("UPDATE users SET retirement_savings = ? WHERE id = ?")
            .bind(retirement_savings)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
    }
    // Import preferences
    if let Some(prefs) = data.preferences {
        sqlx::query(
            "UPDATE users SET recurring_wages_enabled = ?, current_account_enabled = ?, custom_savings_goals_enabled = ?, fixed_expenses_enabled = ? WHERE id = ?"
        )
        .bind(if prefs.recurring_wages_enabled { 1 } else { 0 })
        .bind(if prefs.current_account_enabled { 1 } else { 0 })
        .bind(if prefs.custom_savings_goals_enabled { 1 } else { 0 })
        .bind(if prefs.fixed_expenses_enabled { 1 } else { 0 })
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    }
    // Import fixed expenses
    let mut fixed_expense_map: std::collections::HashMap<String, i64> =
        std::collections::HashMap::new();
    for expense in &data.fixed_expenses {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO fixed_expenses (user_id, label, amount) VALUES (?, ?, ?) RETURNING id",
        )
        .bind(claims.sub)
        .bind(&expense.label)
        .bind(expense.amount)
        .fetch_one(&mut *tx)
        .await?;
        fixed_expense_map.insert(expense.label.clone(), id);
    }

    // Import recurring wages
    for wage in &data.recurring_wages {
        sqlx::query(
            "INSERT INTO recurring_wages (user_id, label, amount, effective_from) VALUES (?, ?, ?, ?)",
        )
        .bind(claims.sub)
        .bind(&wage.label)
        .bind(wage.amount)
        .bind(&wage.effective_from)
        .execute(&mut *tx)
        .await?;
    }

    let mut category_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for cat in &data.categories {
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO budget_categories (user_id, label, default_amount) VALUES (?, ?, ?) RETURNING id",
        )
        .bind(claims.sub)
        .bind(&cat.label)
        .bind(cat.default_amount)
        .fetch_one(&mut *tx)
        .await?;
        category_map.insert(cat.label.clone(), id);
    }

    for month_data in &data.months {
        let month_id: i64 = sqlx::query_scalar(
            "INSERT INTO months (user_id, year, month, is_closed) VALUES (?, ?, ?, ?) RETURNING id",
        )
        .bind(claims.sub)
        .bind(month_data.year)
        .bind(month_data.month)
        .bind(month_data.is_closed)
        .fetch_one(&mut *tx)
        .await?;

        // Restore current account balance
        if let Some(balance) = month_data.current_account_balance {
            sqlx::query("INSERT INTO monthly_current_account (month_id, balance) VALUES (?, ?)")
                .bind(month_id)
                .bind(balance)
                .execute(&mut *tx)
                .await?;
        }

        // Restore monthly savings
        if month_data.monthly_savings_amount.is_some()
            || month_data.monthly_savings_goal.is_some()
            || month_data.monthly_retirement_savings_goal.is_some()
        {
            sqlx::query("INSERT INTO monthly_savings (month_id, savings, savings_goal, retirement_savings) VALUES (?, ?, ?, ?)")
                .bind(month_id)
                .bind(month_data.monthly_savings_amount.unwrap_or(0.0))
                .bind(month_data.monthly_savings_goal.unwrap_or(0.0))
                .bind(month_data.monthly_retirement_savings_goal.unwrap_or(0.0))
                .execute(&mut *tx)
                .await?;
        }

        for income in &month_data.income_entries {
            sqlx::query("INSERT INTO income_entries (month_id, label, amount) VALUES (?, ?, ?)")
                .bind(month_id)
                .bind(&income.label)
                .bind(income.amount)
                .execute(&mut *tx)
                .await?;
        }

        for budget in &month_data.budgets {
            if let Some(&cat_id) = category_map.get(&budget.category_label) {
                sqlx::query(
                    "INSERT INTO monthly_budgets (month_id, category_id, allocated_amount) VALUES (?, ?, ?)",
                )
                .bind(month_id)
                .bind(cat_id)
                .bind(budget.allocated_amount)
                .execute(&mut *tx)
                .await?;
            }
        }

        for item in &month_data.items {
            if let Some(&cat_id) = category_map.get(&item.category_label) {
                sqlx::query(
                    "INSERT INTO items (month_id, category_id, description, amount, spent_on, savings_destination) VALUES (?, ?, ?, ?, ?, ?)",
                )
                .bind(month_id)
                .bind(cat_id)
                .bind(&item.description)
                .bind(item.amount)
                .bind(&item.spent_on)
                .bind(&item.savings_destination)
                .execute(&mut *tx)
                .await?;
            }
        }

        // Restore monthly fixed expenses
        for mfe in &month_data.monthly_fixed_expenses {
            // Try to find matching fixed_expense_id if it exists
            let fe_id = fixed_expense_map.get(&mfe.label).copied();
            sqlx::query(
                "INSERT INTO monthly_fixed_expenses (fixed_expense_id, month_id, label, amount) VALUES (?, ?, ?, ?)",
            )
            .bind(fe_id)
            .bind(month_id)
            .bind(&mfe.label)
            .bind(mfe.amount)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(StatusCode::OK)
}
