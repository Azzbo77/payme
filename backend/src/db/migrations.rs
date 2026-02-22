/// Database migration SQL statements
/// Single source of truth for all migrations used in both production and tests

pub const CREATE_USERS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    savings REAL NOT NULL DEFAULT 0,
    savings_goal REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
"#;

pub const CREATE_FIXED_EXPENSES_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS fixed_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
"#;

pub const CREATE_BUDGET_CATEGORIES_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS budget_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    default_amount REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
"#;

pub const CREATE_MONTHS_TABLE: &str = r#"
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
"#;

pub const CREATE_INCOME_ENTRIES_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS income_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
)
"#;

pub const CREATE_MONTHLY_BUDGETS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS monthly_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    allocated_amount REAL NOT NULL,
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE CASCADE,
    UNIQUE(month_id, category_id)
)
"#;

pub const CREATE_ITEMS_TABLE: &str = r#"
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
"#;

pub const CREATE_MONTHLY_SNAPSHOTS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS monthly_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL UNIQUE,
    pdf_data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
)
"#;

pub const CREATE_MONTHLY_FIXED_EXPENSES_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS monthly_fixed_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL,
    fixed_expense_id INTEGER,
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE,
    FOREIGN KEY (fixed_expense_id) REFERENCES fixed_expenses(id) ON DELETE SET NULL
)
"#;

pub const CREATE_MONTHLY_SAVINGS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS monthly_savings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL UNIQUE,
    savings REAL NOT NULL DEFAULT 0,
    retirement_savings REAL NOT NULL DEFAULT 0,
    savings_goal REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
)
"#;

pub const CREATE_RECURRING_WAGES_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS recurring_wages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    label TEXT NOT NULL DEFAULT 'Wages',
    effective_from TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
"#;

pub const CREATE_MONTHLY_CURRENT_ACCOUNT_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS monthly_current_account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id INTEGER NOT NULL UNIQUE,
    balance REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE
)
"#;

pub const CREATE_RECURRING_ITEMS_TABLE: &str = r#"
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
"#;

pub const CREATE_RETIREMENT_BREAKDOWN_ITEMS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS retirement_breakdown_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'custom',
    ticker TEXT,
    quantity REAL,
    current_price REAL,
    last_updated INTEGER,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
"#;

// ALTER TABLE statements for backward compatibility
pub const ALTER_USERS_ADD_SAVINGS: &str = "ALTER TABLE users ADD COLUMN savings REAL NOT NULL DEFAULT 0";
pub const ALTER_USERS_ADD_RETIREMENT_SAVINGS: &str = "ALTER TABLE users ADD COLUMN retirement_savings REAL NOT NULL DEFAULT 0";
pub const ALTER_USERS_ADD_SAVINGS_GOAL: &str = "ALTER TABLE users ADD COLUMN savings_goal REAL NOT NULL DEFAULT 0";
pub const ALTER_USERS_ADD_RECURRING_WAGES_ENABLED: &str = "ALTER TABLE users ADD COLUMN recurring_wages_enabled INTEGER NOT NULL DEFAULT 1";
pub const ALTER_USERS_ADD_CURRENT_ACCOUNT_ENABLED: &str = "ALTER TABLE users ADD COLUMN current_account_enabled INTEGER NOT NULL DEFAULT 1";
pub const ALTER_USERS_ADD_CUSTOM_SAVINGS_GOALS_ENABLED: &str = "ALTER TABLE users ADD COLUMN custom_savings_goals_enabled INTEGER NOT NULL DEFAULT 1";
pub const ALTER_USERS_ADD_FIXED_EXPENSES_ENABLED: &str = "ALTER TABLE users ADD COLUMN fixed_expenses_enabled INTEGER NOT NULL DEFAULT 0";
pub const ALTER_USERS_ADD_PAYDAY: &str = "ALTER TABLE users ADD COLUMN payday INTEGER NOT NULL DEFAULT 21";
pub const ALTER_USERS_ADD_PAYDAY_MODE_ENABLED: &str = "ALTER TABLE users ADD COLUMN payday_mode_enabled INTEGER NOT NULL DEFAULT 1";
pub const UPDATE_USERS_RETIREMENT_SAVINGS: &str = "UPDATE users SET retirement_savings = roth_ira WHERE retirement_savings = 0 AND roth_ira IS NOT NULL AND roth_ira > 0";

pub const ALTER_ITEMS_ADD_SAVINGS_DESTINATION: &str = "ALTER TABLE items ADD COLUMN savings_destination TEXT NOT NULL DEFAULT 'none'";
pub const UPDATE_ITEMS_SAVINGS_DESTINATION: &str = "UPDATE items SET savings_destination = 'none' WHERE savings_destination = '' OR savings_destination IS NULL";

pub const ALTER_MONTHLY_FIXED_EXPENSES_ADD_FIXED_EXPENSE_ID_FK: &str = "ALTER TABLE monthly_fixed_expenses ADD COLUMN fixed_expense_id INTEGER REFERENCES fixed_expenses(id) ON DELETE SET NULL";
pub const ALTER_MONTHLY_FIXED_EXPENSES_ADD_FIXED_EXPENSE_ID: &str = "ALTER TABLE monthly_fixed_expenses ADD COLUMN fixed_expense_id INTEGER";

pub const ALTER_FIXED_EXPENSES_ADD_AUTO_GENERATE: &str = "ALTER TABLE fixed_expenses ADD COLUMN auto_generate INTEGER NOT NULL DEFAULT 0";

pub const ALTER_ITEMS_ADD_RECURRING_ITEM_ID: &str = "ALTER TABLE items ADD COLUMN recurring_item_id INTEGER";

pub const ALTER_RECURRING_WAGES_ADD_LABEL: &str = "ALTER TABLE recurring_wages ADD COLUMN label TEXT NOT NULL DEFAULT 'Wages'";

pub const ALTER_RETIREMENT_BREAKDOWN_ADD_CREATED_AT: &str = "ALTER TABLE retirement_breakdown_items ADD COLUMN created_at TEXT";
pub const ALTER_RETIREMENT_BREAKDOWN_ADD_UPDATED_AT: &str = "ALTER TABLE retirement_breakdown_items ADD COLUMN updated_at TEXT";
pub const UPDATE_RETIREMENT_BREAKDOWN_CREATED_AT: &str = "UPDATE retirement_breakdown_items SET created_at = datetime('now') WHERE created_at IS NULL";
pub const UPDATE_RETIREMENT_BREAKDOWN_UPDATED_AT: &str = "UPDATE retirement_breakdown_items SET updated_at = datetime('now') WHERE updated_at IS NULL";

// Index statements
pub const CREATE_INDEX_ITEMS_MONTH_ID: &str = "CREATE INDEX IF NOT EXISTS idx_items_month_id ON items(month_id)";
pub const CREATE_INDEX_ITEMS_CATEGORY_ID: &str = "CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id)";
pub const CREATE_INDEX_ITEMS_MONTH_CATEGORY: &str = "CREATE INDEX IF NOT EXISTS idx_items_month_category ON items(month_id, category_id)";
pub const CREATE_INDEX_ITEMS_RECURRING_ITEM_ID: &str = "CREATE INDEX IF NOT EXISTS idx_items_recurring_item_id ON items(recurring_item_id)";
pub const CREATE_INDEX_BUDGET_CATEGORIES_USER_ID: &str = "CREATE INDEX IF NOT EXISTS idx_budget_categories_user_id ON budget_categories(user_id)";
pub const CREATE_INDEX_FIXED_EXPENSES_USER_ID: &str = "CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_id ON fixed_expenses(user_id)";
pub const CREATE_INDEX_MONTHS_USER_ID: &str = "CREATE INDEX IF NOT EXISTS idx_months_user_id ON months(user_id)";
pub const CREATE_INDEX_INCOME_ENTRIES_MONTH_ID: &str = "CREATE INDEX IF NOT EXISTS idx_income_entries_month_id ON income_entries(month_id)";
pub const CREATE_INDEX_MONTHLY_BUDGETS_MONTH_ID: &str = "CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month_id ON monthly_budgets(month_id)";
pub const CREATE_INDEX_MONTHLY_DATA_MONTH_ID: &str = "CREATE INDEX IF NOT EXISTS idx_monthly_data_month_id ON monthly_data(month_id)";
pub const CREATE_INDEX_MONTHLY_FIXED_EXPENSES_MONTH_ID: &str = "CREATE INDEX IF NOT EXISTS idx_monthly_fixed_expenses_month_id ON monthly_fixed_expenses(month_id)";
pub const CREATE_INDEX_MONTHLY_FIXED_EXPENSES_FIXED_EXPENSE_ID: &str = "CREATE INDEX IF NOT EXISTS idx_monthly_fixed_expenses_fixed_expense_id ON monthly_fixed_expenses(fixed_expense_id)";
pub const CREATE_INDEX_RETIREMENT_BREAKDOWN_USER_ID: &str = "CREATE INDEX IF NOT EXISTS idx_retirement_breakdown_user_id ON retirement_breakdown_items(user_id)";

/// Get all table creation statements in order
pub fn get_table_creation_statements() -> Vec<&'static str> {
    vec![
        CREATE_USERS_TABLE,
        CREATE_FIXED_EXPENSES_TABLE,
        CREATE_BUDGET_CATEGORIES_TABLE,
        CREATE_MONTHS_TABLE,
        CREATE_INCOME_ENTRIES_TABLE,
        CREATE_MONTHLY_BUDGETS_TABLE,
        CREATE_ITEMS_TABLE,
        CREATE_MONTHLY_SNAPSHOTS_TABLE,
        CREATE_MONTHLY_FIXED_EXPENSES_TABLE,
        CREATE_MONTHLY_SAVINGS_TABLE,
        CREATE_RECURRING_WAGES_TABLE,
        CREATE_MONTHLY_CURRENT_ACCOUNT_TABLE,
        CREATE_RECURRING_ITEMS_TABLE,
        CREATE_RETIREMENT_BREAKDOWN_ITEMS_TABLE,
    ]
}

/// Get all ALTER TABLE and UPDATE statements for backward compatibility
pub fn get_alter_and_update_statements() -> Vec<&'static str> {
    vec![
        ALTER_USERS_ADD_SAVINGS,
        ALTER_USERS_ADD_RETIREMENT_SAVINGS,
        ALTER_USERS_ADD_SAVINGS_GOAL,
        ALTER_USERS_ADD_RECURRING_WAGES_ENABLED,
        ALTER_USERS_ADD_CURRENT_ACCOUNT_ENABLED,
        ALTER_USERS_ADD_CUSTOM_SAVINGS_GOALS_ENABLED,
        ALTER_USERS_ADD_FIXED_EXPENSES_ENABLED,
        ALTER_USERS_ADD_PAYDAY,
        ALTER_USERS_ADD_PAYDAY_MODE_ENABLED,
        UPDATE_USERS_RETIREMENT_SAVINGS,
        ALTER_ITEMS_ADD_SAVINGS_DESTINATION,
        UPDATE_ITEMS_SAVINGS_DESTINATION,
        ALTER_MONTHLY_FIXED_EXPENSES_ADD_FIXED_EXPENSE_ID_FK,
        ALTER_MONTHLY_FIXED_EXPENSES_ADD_FIXED_EXPENSE_ID,
        ALTER_FIXED_EXPENSES_ADD_AUTO_GENERATE,
        ALTER_ITEMS_ADD_RECURRING_ITEM_ID,
        ALTER_RECURRING_WAGES_ADD_LABEL,
        ALTER_RETIREMENT_BREAKDOWN_ADD_CREATED_AT,
        ALTER_RETIREMENT_BREAKDOWN_ADD_UPDATED_AT,
        UPDATE_RETIREMENT_BREAKDOWN_CREATED_AT,
        UPDATE_RETIREMENT_BREAKDOWN_UPDATED_AT,
    ]
}

/// Get all index creation statements
pub fn get_index_statements() -> Vec<&'static str> {
    vec![
        CREATE_INDEX_ITEMS_MONTH_ID,
        CREATE_INDEX_ITEMS_CATEGORY_ID,
        CREATE_INDEX_ITEMS_MONTH_CATEGORY,
        CREATE_INDEX_ITEMS_RECURRING_ITEM_ID,
        CREATE_INDEX_BUDGET_CATEGORIES_USER_ID,
        CREATE_INDEX_FIXED_EXPENSES_USER_ID,
        CREATE_INDEX_MONTHS_USER_ID,
        CREATE_INDEX_INCOME_ENTRIES_MONTH_ID,
        CREATE_INDEX_MONTHLY_BUDGETS_MONTH_ID,
        CREATE_INDEX_MONTHLY_DATA_MONTH_ID,
        CREATE_INDEX_MONTHLY_FIXED_EXPENSES_MONTH_ID,
        CREATE_INDEX_MONTHLY_FIXED_EXPENSES_FIXED_EXPENSE_ID,
        CREATE_INDEX_RETIREMENT_BREAKDOWN_USER_ID,
    ]
}
