use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

mod migrations;
pub use migrations::*;

pub async fn create_pool(database_url: &str) -> Result<SqlitePool, sqlx::Error> {
    create_pool_with_size(database_url, 10).await
}

pub async fn create_pool_with_size(
    database_url: &str,
    pool_size: u32,
) -> Result<SqlitePool, sqlx::Error> {
    let pool = SqlitePoolOptions::new()
        .max_connections(pool_size)
        .connect(database_url)
        .await?;
    Ok(pool)
}

/// Run database migrations
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Create all tables
    for sql in get_table_creation_statements() {
        sqlx::query(sql).execute(pool).await?;
    }

    // Run ALTER TABLE and UPDATE statements for backward compatibility
    for sql in get_alter_and_update_statements() {
        let _ = sqlx::query(sql).execute(pool).await;
    }

    // Create all indexes
    for sql in get_index_statements() {
        let _ = sqlx::query(sql).execute(pool).await;
    }

    // Migration: Backfill existing months with current fixed expenses and savings
    // This ensures existing data is preserved when upgrading
    let existing_months: Vec<(i64, i64)> = sqlx::query_as(
        "SELECT id, user_id FROM months WHERE id NOT IN (SELECT DISTINCT month_id FROM monthly_fixed_expenses)",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for (month_id, user_id) in existing_months {
        // Copy current fixed expenses to this month
        let fixed_expenses: Vec<(i64, String, f64)> =
            sqlx::query_as("SELECT id, label, amount FROM fixed_expenses WHERE user_id = ?")
                .bind(user_id)
                .fetch_all(pool)
                .await
                .unwrap_or_default();

        for (expense_id, label, amount) in fixed_expenses {
            let _ = sqlx::query(
                "INSERT INTO monthly_fixed_expenses (month_id, fixed_expense_id, label, amount) VALUES (?, ?, ?, ?)",
            )
            .bind(month_id)
            .bind(expense_id)
            .bind(&label)
            .bind(amount)
            .execute(pool)
            .await;
        }

        // Copy current savings values to this month
        let user_savings: Option<(f64, f64, f64)> = sqlx::query_as(
            "SELECT savings, retirement_savings, savings_goal FROM users WHERE id = ?",
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

        if let Some((savings, retirement_savings, savings_goal)) = user_savings {
            let _ = sqlx::query(
                "INSERT INTO monthly_savings (month_id, savings, retirement_savings, savings_goal) VALUES (?, ?, ?, ?)",
            )
            .bind(month_id)
            .bind(savings)
            .bind(retirement_savings)
            .bind(savings_goal)
            .execute(pool)
            .await;
        }
    }

    Ok(())
}
