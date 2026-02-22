use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct FixedExpense {
    pub id: i64,
    pub user_id: i64,
    pub label: String,
    pub amount: f64,
    pub auto_generate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct MonthlyFixedExpense {
    pub id: i64,
    pub month_id: i64,
    pub fixed_expense_id: Option<i64>,
    pub label: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct MonthlySavings {
    pub id: i64,
    pub month_id: i64,
    pub savings: f64,
    pub retirement_savings: f64,
    pub savings_goal: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct BudgetCategory {
    pub id: i64,
    pub user_id: i64,
    pub label: String,
    pub default_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Month {
    pub id: i64,
    pub user_id: i64,
    pub year: i32,
    pub month: i32,
    pub is_closed: bool,
    pub closed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct IncomeEntry {
    pub id: i64,
    pub month_id: i64,
    pub label: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct MonthlyBudget {
    pub id: i64,
    pub month_id: i64,
    pub category_id: i64,
    pub allocated_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Item {
    pub id: i64,
    pub month_id: i64,
    pub category_id: i64,
    pub description: String,
    pub amount: f64,
    pub spent_on: NaiveDate,
    pub savings_destination: String,
    pub recurring_item_id: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MonthlyBudgetWithCategory {
    pub id: i64,
    pub month_id: i64,
    pub category_id: i64,
    pub category_label: String,
    pub allocated_amount: f64,
    pub spent_amount: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MonthSummary {
    pub month: Month,
    pub income_entries: Vec<IncomeEntry>,
    pub fixed_expenses: Vec<MonthlyFixedExpense>,
    pub budgets: Vec<MonthlyBudgetWithCategory>,
    pub items: Vec<ItemWithCategory>,
    pub savings: Option<MonthlySavings>,
    pub total_income: f64,
    pub total_fixed: f64,
    pub total_budgeted: f64,
    pub total_spent: f64,
    pub remaining: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct ItemWithCategory {
    pub id: i64,
    pub month_id: i64,
    pub category_id: i64,
    pub category_label: String,
    pub description: String,
    pub amount: f64,
    pub spent_on: NaiveDate,
    pub savings_destination: String,
    pub recurring_item_id: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CategoryStats {
    pub category_id: i64,
    pub category_label: String,
    pub current_month_spent: f64,
    pub previous_month_spent: f64,
    pub change_amount: f64,
    pub change_percent: Option<f64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MonthlyStats {
    pub year: i32,
    pub month: i32,
    pub total_income: f64,
    pub total_spent: f64,
    pub total_fixed: f64,
    pub net: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StatsResponse {
    pub category_comparisons: Vec<CategoryStats>,
    pub monthly_trends: Vec<MonthlyStats>,
    pub average_monthly_spending: f64,
    pub average_monthly_income: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct RecurringWage {
    pub id: i64,
    pub user_id: i64,
    pub amount: f64,
    pub label: String,
    pub effective_from: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct RecurringItem {
    pub id: i64,
    pub user_id: i64,
    pub category_id: i64,
    pub description: String,
    pub amount: f64,
    pub day_of_month: i32,
    pub savings_destination: String,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct CurrentAccountBalance {
    pub id: i64,
    pub month_id: i64,
    pub balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct RetirementBreakdownItem {
    pub id: i64,
    pub user_id: i64,
    pub label: String,
    pub amount: f64,
    #[serde(rename = "type")]
    pub item_type: String,
    pub ticker: Option<String>,
    pub quantity: Option<f64>,
    pub current_price: Option<f64>,
    pub last_updated: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}
