pub mod backup;
pub mod config;
pub mod db;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod openapi;
pub mod pdf;
pub mod ratelimit;

use axum::{
    middleware::from_fn,
    routing::{delete, get, post, put},
    Extension, Router,
};
use sqlx::SqlitePool;
use tower_http::cors::{Any, CorsLayer};

use handlers::{
    auth, backups, budget, export, fixed_expenses, health, income, items, monthly_data, months,
    savings, stats, stocks,
};
use middleware::auth::auth_middleware;
use ratelimit::{RateLimitManager, IPRateLimiter, STOCK_API_RATE_LIMIT, AUTH_RATE_LIMIT};
use std::sync::Arc;

/// Create the application router with all routes
pub fn create_app(pool: SqlitePool) -> Router {
    let ip_rate_limiter = Arc::new(IPRateLimiter::new(AUTH_RATE_LIMIT));
    
    let public_routes = Router::new()
        .route("/health", get(health::health_check))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .layer(Extension(ip_rate_limiter));

    let rate_limiter = Arc::new(RateLimitManager::new(STOCK_API_RATE_LIMIT));

    let protected_routes = Router::new()
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/change-username", put(auth::change_username))
        .route("/api/auth/change-password", put(auth::change_password))
        .route("/api/auth/clear-data", delete(auth::clear_all_data))
        .route("/api/export", get(auth::export_db))
        .route("/api/months", get(months::list_months))
        .route("/api/months", post(months::create_month))
        .route(
            "/api/months/current",
            get(months::get_or_create_current_month),
        )
        .route("/api/months/{id}", get(months::get_month))
        .route("/api/months/{id}/close", post(months::close_month))
        .route("/api/months/{id}/reopen", post(months::reopen_month))
        .route("/api/months/{id}/pdf", get(months::get_month_pdf))
        .route(
            "/api/months/{month_id}/fixed-expenses",
            post(monthly_data::create_monthly_fixed_expense),
        )
        .route(
            "/api/months/{month_id}/fixed-expenses/{id}",
            put(monthly_data::update_monthly_fixed_expense),
        )
        .route(
            "/api/months/{month_id}/fixed-expenses/{id}",
            delete(monthly_data::delete_monthly_fixed_expense),
        )
        .route(
            "/api/months/{month_id}/available-fixed-expenses",
            get(monthly_data::get_available_fixed_expenses),
        )
        .route(
            "/api/months/{month_id}/savings",
            get(monthly_data::get_monthly_savings),
        )
        .route(
            "/api/months/{month_id}/savings",
            put(monthly_data::update_monthly_savings),
        )
        .route(
            "/api/months/{month_id}/current-account",
            get(monthly_data::get_monthly_current_account),
        )
        .route(
            "/api/months/{month_id}/current-account",
            put(monthly_data::update_monthly_current_account),
        )
        .route(
            "/api/months/{month_id}/transfer",
            post(monthly_data::transfer_from_current_account),
        )
        .route(
            "/api/fixed-expenses",
            get(fixed_expenses::list_fixed_expenses),
        )
        .route(
            "/api/fixed-expenses",
            post(fixed_expenses::create_fixed_expense),
        )
        .route(
            "/api/fixed-expenses/{id}",
            put(fixed_expenses::update_fixed_expense),
        )
        .route(
            "/api/fixed-expenses/{id}",
            delete(fixed_expenses::delete_fixed_expense),
        )
        .route("/api/categories", get(budget::list_categories))
        .route("/api/categories", post(budget::create_category))
        .route("/api/categories/{id}", put(budget::update_category))
        .route("/api/categories/{id}", delete(budget::delete_category))
        .route(
            "/api/months/{id}/budgets",
            get(budget::list_monthly_budgets),
        )
        .route(
            "/api/months/{month_id}/budgets/{id}",
            put(budget::update_monthly_budget),
        )
        .route("/api/months/{id}/income", get(income::list_income))
        .route("/api/months/{id}/income", post(income::create_income))
        .route(
            "/api/months/{month_id}/income/{id}",
            put(income::update_income),
        )
        .route(
            "/api/months/{month_id}/income/{id}",
            delete(income::delete_income),
        )
        .route("/api/months/{id}/items", get(items::list_items))
        .route("/api/months/{id}/items", post(items::create_item))
        .route("/api/months/{month_id}/items/{id}", put(items::update_item))
        .route(
            "/api/months/{month_id}/items/{id}",
            delete(items::delete_item),
        )
        .route("/api/recurring-wages", get(income::list_recurring_wages))
        .route("/api/recurring-wages", post(income::create_recurring_wage))
        .route("/api/recurring-wages/current", get(income::get_current_recurring_wage))
        .route("/api/recurring-wages/preferences/enabled", get(income::get_recurring_wages_enabled))
        .route("/api/recurring-wages/preferences/enabled", put(income::set_recurring_wages_enabled))
        .route("/api/current-account/preferences/enabled", get(monthly_data::get_current_account_enabled))
        .route("/api/current-account/preferences/enabled", put(monthly_data::set_current_account_enabled))
        .route("/api/custom-savings-goals/preferences/enabled", get(monthly_data::get_custom_savings_goals_enabled))
        .route("/api/custom-savings-goals/preferences/enabled", put(monthly_data::set_custom_savings_goals_enabled))
        .route("/api/fixed-expenses/preferences/enabled", get(monthly_data::get_fixed_expenses_enabled))
        .route("/api/fixed-expenses/preferences/enabled", put(monthly_data::set_fixed_expenses_enabled))
        .route("/api/recurring-wages/{id}", put(income::update_recurring_wage))
        .route("/api/recurring-wages/{id}", delete(income::delete_recurring_wage))
        .route("/api/stats", get(stats::get_stats))
        .route("/api/savings", get(savings::get_savings))
        .route("/api/savings", put(savings::update_savings))
        .route("/api/savings/goal", put(savings::update_savings_goal))
        .route(
            "/api/retirement-savings",
            get(savings::get_retirement_savings),
        )
        .route(
            "/api/retirement-savings",
            put(savings::update_retirement_savings),
        )
        .route("/api/export/json", get(export::export_json))
        .route("/api/import/json", post(export::import_json))
        .route("/api/backups/create", post(backups::create_backup))
        .route("/api/backups/list", get(backups::list_backups))
        .route("/api/backups/{filename}", delete(backups::delete_backup))
        .route("/api/backups/{filename}/restore", post(backups::restore_backup))
        .route("/api/stocks/price", get(stocks::get_stock_price))
        .route("/api/stocks/exchange-rate", get(stocks::get_exchange_rate))
        .layer(Extension(rate_limiter))
        .layer(from_fn(auth_middleware));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(false);

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(cors)
        .with_state(pool)
}
