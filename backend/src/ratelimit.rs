use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

/// Simple per-user rate limiter using token bucket algorithm
pub struct RateLimitManager {
    limiters: Arc<RwLock<HashMap<i64, UserRateLimiter>>>,
    requests_per_minute: u32,
}

struct UserRateLimiter {
    tokens: f64,
    last_update: Instant,
    capacity: f64,
}

impl RateLimitManager {
    /// Create a new rate limit manager
    /// 
    /// # Arguments
    /// * `requests_per_minute` - Number of requests allowed per minute per user
    pub fn new(requests_per_minute: u32) -> Self {
        RateLimitManager {
            limiters: Arc::new(RwLock::new(HashMap::new())),
            requests_per_minute,
        }
    }

    /// Check if a user has exceeded their rate limit
    /// Returns Ok(()) if request is allowed, Err if rate limit exceeded
    pub async fn check_limit(&self, user_id: i64) -> Result<(), ()> {
        let mut limiters = self.limiters.write().await;
        let now = Instant::now();
        let capacity = self.requests_per_minute as f64;
        let refill_rate = capacity / 60.0; // tokens per second
        
        let limiter = limiters.entry(user_id).or_insert_with(|| UserRateLimiter {
            tokens: capacity,
            last_update: now,
            capacity,
        });
        
        // Refill tokens based on time passed
        let elapsed = now.duration_since(limiter.last_update);
        limiter.tokens = (limiter.tokens + elapsed.as_secs_f64() * refill_rate).min(limiter.capacity);
        limiter.last_update = now;
        
        // Check if we have tokens available
        if limiter.tokens >= 1.0 {
            limiter.tokens -= 1.0;
            Ok(())
        } else {
            Err(())
        }
    }
}

/// IP-based rate limiter using token bucket algorithm
/// Used for public endpoints like auth to prevent brute force attacks
pub struct IPRateLimiter {
    limiters: Arc<RwLock<HashMap<String, IPLimiter>>>,
    requests_per_minute: u32,
}

struct IPLimiter {
    tokens: f64,
    last_update: Instant,
    capacity: f64,
}

impl IPRateLimiter {
    /// Create a new IP-based rate limit manager
    /// 
    /// # Arguments
    /// * `requests_per_minute` - Number of requests allowed per minute per IP
    pub fn new(requests_per_minute: u32) -> Self {
        IPRateLimiter {
            limiters: Arc::new(RwLock::new(HashMap::new())),
            requests_per_minute,
        }
    }

    /// Check if an IP address has exceeded their rate limit
    /// Returns Ok(()) if request is allowed, Err if rate limit exceeded
    pub async fn check_limit(&self, ip: &str) -> Result<(), ()> {
        let mut limiters = self.limiters.write().await;
        let now = Instant::now();
        let capacity = self.requests_per_minute as f64;
        let refill_rate = capacity / 60.0; // tokens per second
        
        let limiter = limiters.entry(ip.to_string()).or_insert_with(|| IPLimiter {
            tokens: capacity,
            last_update: now,
            capacity,
        });
        
        // Refill tokens based on time passed
        let elapsed = now.duration_since(limiter.last_update);
        limiter.tokens = (limiter.tokens + elapsed.as_secs_f64() * refill_rate).min(limiter.capacity);
        limiter.last_update = now;
        
        // Check if we have tokens available
        if limiter.tokens >= 1.0 {
            limiter.tokens -= 1.0;
            Ok(())
        } else {
            Err(())
        }
    }
}

/// Default rate limit for stock price endpoint: 30 requests per minute per user
pub const STOCK_API_RATE_LIMIT: u32 = 30;

/// Rate limit for auth endpoints: 5 requests per minute per IP (prevents brute force)
pub const AUTH_RATE_LIMIT: u32 = 5;
