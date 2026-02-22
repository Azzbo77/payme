#![allow(dead_code)]

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::Router;
use axum_test::TestServer;
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::net::SocketAddr;
use std::sync::Once;

use axum::http::{HeaderName, HeaderValue};
use payme::db::*;

static INIT: Once = Once::new();

/// Initialize test environment (sets JWT_SECRET if not already set)
fn init_test_env() {
    INIT.call_once(|| {
        if std::env::var("JWT_SECRET").is_err() {
            std::env::set_var("JWT_SECRET", "test-secret-key");
        }
    });
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: i64,
    pub username: String,
    pub exp: usize,
}

/// Create an in-memory SQLite pool and run migrations
pub async fn create_test_pool() -> SqlitePool {
    init_test_env();

    let pool = SqlitePool::connect(":memory:")
        .await
        .expect("Failed to create in-memory database");

    run_migrations(&pool).await;
    pool
}

/// Run database migrations
async fn run_migrations(pool: &SqlitePool) {
    // Create all tables
    for sql in get_table_creation_statements() {
        sqlx::query(sql)
            .execute(pool)
            .await
            .expect("Failed to execute table creation migration");
    }

    // Run ALTER TABLE statements for schema consistency with defaults
    for sql in get_alter_and_update_statements().iter().take(9) {
        // Only run the user-related ALTER statements to ensure full schema
        let _ = sqlx::query(sql).execute(pool).await;
    }

    // Create indexes
    for sql in get_index_statements() {
        let _ = sqlx::query(sql).execute(pool).await;
    }
}

/// Create a test user and return their ID
pub async fn create_test_user(pool: &SqlitePool, username: &str, password: &str) -> i64 {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .expect("Failed to hash password")
        .to_string();

    sqlx::query_scalar::<_, i64>(
        "INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id",
    )
    .bind(username)
    .bind(&password_hash)
    .fetch_one(pool)
    .await
    .expect("Failed to create test user")
}

/// Generate a JWT token for a user
pub fn generate_token(user_id: i64, username: &str) -> String {
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());

    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        exp: (Utc::now() + Duration::days(30)).timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("Failed to generate token")
}

/// Generate an expired JWT token for testing
pub fn generate_expired_token(user_id: i64, username: &str) -> String {
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test-secret-key".to_string());

    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        exp: (Utc::now() - Duration::days(1)).timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("Failed to generate token")
}

/// Create a test category and return its ID
pub async fn create_test_category(
    pool: &SqlitePool,
    user_id: i64,
    label: &str,
    default_amount: f64,
) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO budget_categories (user_id, label, default_amount) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(user_id)
    .bind(label)
    .bind(default_amount)
    .fetch_one(pool)
    .await
    .expect("Failed to create test category")
}

/// Create a test month and return its ID
pub async fn create_test_month(pool: &SqlitePool, user_id: i64, year: i32, month: i32) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO months (user_id, year, month) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(user_id)
    .bind(year)
    .bind(month)
    .fetch_one(pool)
    .await
    .expect("Failed to create test month")
}

/// Create a test fixed expense and return its ID
pub async fn create_test_fixed_expense(
    pool: &SqlitePool,
    user_id: i64,
    label: &str,
    amount: f64,
) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO fixed_expenses (user_id, label, amount) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(user_id)
    .bind(label)
    .bind(amount)
    .fetch_one(pool)
    .await
    .expect("Failed to create test fixed expense")
}

/// Create a test income entry and return its ID
pub async fn create_test_income(pool: &SqlitePool, month_id: i64, label: &str, amount: f64) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO income_entries (month_id, label, amount) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(month_id)
    .bind(label)
    .bind(amount)
    .fetch_one(pool)
    .await
    .expect("Failed to create test income")
}

/// Create a test item and return its ID
pub async fn create_test_item(
    pool: &SqlitePool,
    month_id: i64,
    category_id: i64,
    description: &str,
    amount: f64,
    spent_on: &str,
) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO items (month_id, category_id, description, amount, spent_on, savings_destination) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(month_id)
    .bind(category_id)
    .bind(description)
    .bind(amount)
    .bind(spent_on)
    .bind("none")
    .fetch_one(pool)
    .await
    .expect("Failed to create test item")
}

/// Create a test monthly budget and return its ID
pub async fn create_test_budget(
    pool: &SqlitePool,
    month_id: i64,
    category_id: i64,
    allocated_amount: f64,
) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO monthly_budgets (month_id, category_id, allocated_amount) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(month_id)
    .bind(category_id)
    .bind(allocated_amount)
    .fetch_one(pool)
    .await
    .expect("Failed to create test budget")
}

/// Close a month
pub async fn close_test_month(pool: &SqlitePool, month_id: i64) {
    sqlx::query("UPDATE months SET is_closed = 1, closed_at = datetime('now') WHERE id = ?")
        .bind(month_id)
        .execute(pool)
        .await
        .expect("Failed to close test month");
}

/// Authorization header name
pub fn auth_name() -> HeaderName {
    HeaderName::from_static("authorization")
}

/// Authorization header value
pub fn auth_value(token: &str) -> HeaderValue {
    HeaderValue::from_str(&format!("Bearer {}", token)).unwrap()
}

/// Create a test server from a router
pub fn create_test_server(app: Router) -> TestServer {
    TestServer::new(app.into_make_service_with_connect_info::<SocketAddr>()).unwrap()
}
