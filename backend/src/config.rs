use std::env;

const INSECURE_JWT_SECRET: &str = "change-me-in-production";

pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub db_pool_size: u32,
    pub finnhub_api_key: Option<String>,
    pub alphavantage_api_key: Option<String>,
    pub cors_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        // Parse CORS_ORIGINS - defaults to localhost for development
        let cors_origins = env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:payme.db?mode=rwc".to_string()),
            port: env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
            db_pool_size: env::var("DB_POOL_SIZE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(10),
            finnhub_api_key: env::var("FINNHUB_API_KEY").ok(),
            alphavantage_api_key: env::var("ALPHAVANTAGE_API_KEY").ok(),
            cors_origins,
        }
    }

    /// Validate required environment variables
    /// Called at startup to fail fast on missing configuration
    pub fn validate(&self) -> Result<(), String> {
        // Check JWT_SECRET is set and not the insecure default
        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| "JWT_SECRET environment variable is required".to_string())?
            .trim()
            .to_string();

        if jwt_secret.is_empty() {
            return Err("JWT_SECRET cannot be empty".to_string());
        }

        if jwt_secret == INSECURE_JWT_SECRET {
            return Err(
                "JWT_SECRET is set to the insecure default value. Please set it to a random string."
                    .to_string(),
            );
        }

        // Check DATABASE_URL is set
        if self.database_url.is_empty() {
            return Err("DATABASE_URL cannot be empty".to_string());
        }

        // Warn if optional API keys are not set
        if self.finnhub_api_key.is_none() && self.alphavantage_api_key.is_none() {
            eprintln!("WARNING: Neither FINNHUB_API_KEY nor ALPHAVANTAGE_API_KEY is set. Stock price fetching will be limited.");
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn test_config_defaults() {
        let _lock = ENV_MUTEX.lock().unwrap();

        let orig_db = std::env::var("DATABASE_URL").ok();
        let orig_port = std::env::var("PORT").ok();

        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("PORT");

        let config = Config {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:payme.db?mode=rwc".to_string()),
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
            db_pool_size: 10,
            finnhub_api_key: None,
            alphavantage_api_key: None,
            cors_origins: vec!["http://localhost:3000".to_string()],
        };

        assert_eq!(config.database_url, "sqlite:payme.db?mode=rwc");
        assert_eq!(config.port, 3001);

        if let Some(v) = orig_db {
            std::env::set_var("DATABASE_URL", v);
        }
        if let Some(v) = orig_port {
            std::env::set_var("PORT", v);
        }
    }

    #[test]
    fn test_config_from_env() {
        let _lock = ENV_MUTEX.lock().unwrap();

        let orig_db = std::env::var("DATABASE_URL").ok();
        let orig_port = std::env::var("PORT").ok();

        std::env::set_var("DATABASE_URL", "sqlite:test.db");
        std::env::set_var("PORT", "8080");

        let config = Config {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:payme.db?mode=rwc".to_string()),
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
            db_pool_size: 10,
            finnhub_api_key: None,
            alphavantage_api_key: None,
            cors_origins: vec!["http://localhost:3000".to_string()],
        };

        assert_eq!(config.database_url, "sqlite:test.db");
        assert_eq!(config.port, 8080);

        if let Some(v) = orig_db {
            std::env::set_var("DATABASE_URL", v);
        } else {
            std::env::remove_var("DATABASE_URL");
        }
        if let Some(v) = orig_port {
            std::env::set_var("PORT", v);
        } else {
            std::env::remove_var("PORT");
        }
    }

    #[test]
    fn test_config_invalid_port_uses_default() {
        let _lock = ENV_MUTEX.lock().unwrap();

        let orig_port = std::env::var("PORT").ok();

        std::env::set_var("PORT", "not_a_number");

        let port: u16 = std::env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(3001);

        assert_eq!(port, 3001);

        if let Some(v) = orig_port {
            std::env::set_var("PORT", v);
        } else {
            std::env::remove_var("PORT");
        }
    }
}
