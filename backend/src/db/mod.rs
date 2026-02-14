use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

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
///
/// NOTE: Keep this in sync with the test migrations in backend/tests/common/mod.rs
/// Both should have identical table schemas and ALTER TABLE statements
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            savings REAL NOT NULL DEFAULT 0,
            savings_goal REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("ALTER TABLE users ADD COLUMN savings REAL NOT NULL DEFAULT 0")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE users ADD COLUMN retirement_savings REAL NOT NULL DEFAULT 0")
        .execute(pool)
        .await;

    let _ = sqlx::query("ALTER TABLE users ADD COLUMN savings_goal REAL NOT NULL DEFAULT 0")
        .execute(pool)
        .await;

    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN recurring_wages_enabled INTEGER NOT NULL DEFAULT 1",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN current_account_enabled INTEGER NOT NULL DEFAULT 1",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN custom_savings_goals_enabled INTEGER NOT NULL DEFAULT 1",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN fixed_expenses_enabled INTEGER NOT NULL DEFAULT 0",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query("UPDATE users SET retirement_savings = roth_ira WHERE retirement_savings = 0 AND roth_ira IS NOT NULL AND roth_ira > 0")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS fixed_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            amount REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS budget_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            default_amount REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS months (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            is_closed INTEGER NOT NULL DEFAULT 0,
            closed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, year, month)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS income_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            amount REAL NOT NULL,
            FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS monthly_budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            allocated_amount REAL NOT NULL,
            FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE CASCADE,
            UNIQUE(month_id, category_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            spent_on TEXT NOT NULL,
            savings_destination TEXT NOT NULL DEFAULT 'none',
            FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query(
        "ALTER TABLE items ADD COLUMN savings_destination TEXT NOT NULL DEFAULT 'none'",
    )
    .execute(pool)
    .await;

    sqlx::query("UPDATE items SET savings_destination = 'none' WHERE savings_destination = '' OR savings_destination IS NULL")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS monthly_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_id INTEGER NOT NULL UNIQUE,
            pdf_data BLOB NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS monthly_fixed_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_id INTEGER NOT NULL,
            fixed_expense_id INTEGER,
            label TEXT NOT NULL,
            amount REAL NOT NULL,
            FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE,
            FOREIGN KEY (fixed_expense_id) REFERENCES fixed_expenses(id) ON DELETE SET NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Migration: Add fixed_expense_id column if it doesn't exist (for existing databases)
    let _ = sqlx::query("ALTER TABLE monthly_fixed_expenses ADD COLUMN fixed_expense_id INTEGER REFERENCES fixed_expenses(id) ON DELETE SET NULL")
        .execute(pool)
        .await;

    // Also try without FK (for SQLite compatibility on some versions)
    let _ = sqlx::query("ALTER TABLE monthly_fixed_expenses ADD COLUMN fixed_expense_id INTEGER")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS monthly_savings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_id INTEGER NOT NULL UNIQUE,
            savings REAL NOT NULL DEFAULT 0,
            retirement_savings REAL NOT NULL DEFAULT 0,
            savings_goal REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS recurring_wages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            label TEXT NOT NULL DEFAULT 'Wages',
            effective_from TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ =
        sqlx::query("ALTER TABLE recurring_wages ADD COLUMN label TEXT NOT NULL DEFAULT 'Wages'")
            .execute(pool)
            .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS monthly_current_account (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_id INTEGER NOT NULL UNIQUE,
            balance REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS recurring_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            day_of_month INTEGER NOT NULL,
            savings_destination TEXT NOT NULL DEFAULT 'none',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query(
        "ALTER TABLE fixed_expenses ADD COLUMN auto_generate INTEGER NOT NULL DEFAULT 0",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "ALTER TABLE items ADD COLUMN recurring_item_id INTEGER",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_items_recurring_item_id ON items(recurring_item_id)",
    )
    .execute(pool)
    .await;

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

    // Create indexes for better query performance
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_items_month_id ON items(month_id)")
        .execute(pool)
        .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id)")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_items_month_category ON items(month_id, category_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_budget_categories_user_id ON budget_categories(user_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_id ON fixed_expenses(user_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_months_user_id ON months(user_id)")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_income_entries_month_id ON income_entries(month_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month_id ON monthly_budgets(month_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_monthly_data_month_id ON monthly_data(month_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_monthly_fixed_expenses_month_id ON monthly_fixed_expenses(month_id)")
        .execute(pool)
        .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_monthly_fixed_expenses_fixed_expense_id ON monthly_fixed_expenses(fixed_expense_id)")
        .execute(pool)
        .await;

    Ok(())
}
