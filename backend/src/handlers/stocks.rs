use axum::{extract::Query, Extension, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::PaymeError;
use crate::middleware::auth::Claims;
use crate::ratelimit::RateLimitManager;

#[derive(Debug, Serialize, Deserialize)]
pub struct StockPriceRequest {
    ticker: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockPriceResponse {
    ticker: String,
    price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExchangeRateRequest {
    from: String,
    to: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExchangeRateResponse {
    from_currency: String,
    to_currency: String,
    rate: f64,
}

#[derive(Debug, Serialize)]
pub struct StockPriceError {
    error: String,
}

// Common crypto tickers supported by Alpha Vantage
const CRYPTO_TICKERS: &[&str] = &[
    "BTC", "ETH", "XRP", "BCH", "LTC", "EOS", "XLM", "LINK", "DOT", "YFI",
    "DOGE", "ADA", "SOL", "MATIC", "AVAX", "LUNA", "ATOM", "NEAR",
];

fn is_crypto(ticker: &str) -> bool {
    CRYPTO_TICKERS.contains(&ticker.to_uppercase().as_str())
}

fn validate_ticker(ticker: &str) -> Result<String, PaymeError> {
    let ticker_upper = ticker.to_uppercase();
    
    // Validate ticker format: 2-5 alphanumeric chars, optionally with dots
    if ticker_upper.len() < 2 || ticker_upper.len() > 6 {
        return Err(PaymeError::BadRequest("Ticker must be 2-6 characters".to_string()));
    }
    
    for c in ticker_upper.chars() {
        if !c.is_alphanumeric() && c != '.' {
            return Err(PaymeError::BadRequest("Ticker must contain only letters, numbers, and dots".to_string()));
        }
    }
    
    Ok(ticker_upper)
}

pub async fn get_stock_price(
    Extension(claims): Extension<Claims>,
    Extension(rate_limiter): Extension<Arc<RateLimitManager>>,
    Query(req): Query<StockPriceRequest>,
) -> Result<Json<StockPriceResponse>, PaymeError> {
    // Check rate limit
    rate_limiter
        .check_limit(claims.sub)
        .await
        .map_err(|_| PaymeError::RateLimited)?;

    let ticker = validate_ticker(&req.ticker)?;
    let finnhub_key = std::env::var("FINNHUB_API_KEY").ok();
    let alphavantage_key = std::env::var("ALPHAVANTAGE_API_KEY").ok();
    
    let price = fetch_stock_price(
        &ticker,
        finnhub_key.as_deref(),
        alphavantage_key.as_deref(),
    )
    .await?;
    
    Ok(Json(StockPriceResponse {
        ticker,
        price,
    }))
}

pub async fn get_exchange_rate(
    Extension(claims): Extension<Claims>,
    Extension(rate_limiter): Extension<Arc<RateLimitManager>>,
    Query(req): Query<ExchangeRateRequest>,
) -> Result<Json<ExchangeRateResponse>, PaymeError> {
    // Check rate limit
    rate_limiter
        .check_limit(claims.sub)
        .await
        .map_err(|_| PaymeError::RateLimited)?;

    let from = validate_ticker(&req.from)?;
    let to = validate_ticker(&req.to)?;
    let api_key = std::env::var("ALPHAVANTAGE_API_KEY")
        .map_err(|_| PaymeError::Internal("Exchange rate API not configured".to_string()))?;
    
    let rate = fetch_exchange_rate(&from, &to, &api_key).await?;
    
    Ok(Json(ExchangeRateResponse {
        from_currency: from,
        to_currency: to,
        rate,
    }))
}

async fn fetch_stock_price(
    ticker: &str,
    finnhub_key: Option<&str>,
    alphavantage_key: Option<&str>,
) -> Result<f64, PaymeError> {
    let client = reqwest::Client::new();
    
    // Try Finnhub first (better free tier: 60 calls/minute vs Alpha Vantage 25/day)
    if let Some(key) = finnhub_key {
        match fetch_finnhub_price(&client, ticker, key).await {
            Ok(price) => {
                tracing::debug!("Successfully fetched {} price from Finnhub: {}", ticker, price);
                return Ok(price);
            }
            Err(e) => {
                tracing::warn!("Finnhub lookup failed for {}: {}, attempting Alpha Vantage", ticker, e);
                // Fall through to Alpha Vantage as fallback
            }
        }
    }
    
    // Fallback to Alpha Vantage
    if let Some(key) = alphavantage_key {
        let base_url = "https://www.alphavantage.co/query";
        
        // Try crypto first if it's a known crypto ticker
        if is_crypto(ticker) {
            match fetch_crypto_price(&client, ticker, key, base_url).await {
                Ok(price) => return Ok(price),
                Err(e) => {
                    tracing::warn!("Crypto lookup failed for {}: {}, attempting stock lookup", ticker, e);
                    // Fall through to stock lookup
                }
            }
        }
        
        // Try Alpha Vantage stock lookup
        return fetch_stock_quote(&client, ticker, key, base_url).await;
    }
    
    Err(PaymeError::Internal(
        "No API keys configured for stock price lookup".to_string(),
    ))
}

async fn fetch_finnhub_price(
    client: &reqwest::Client,
    ticker: &str,
    api_key: &str,
) -> Result<f64, PaymeError> {
    let response = client
        .get("https://finnhub.io/api/v1/quote")
        .query(&[
            ("symbol", ticker),
            ("token", api_key),
        ])
        .send()
        .await
        .map_err(|e| PaymeError::Internal(format!("Request failed: {}", e)))?;
    
    let status = response.status();
    if !status.is_success() {
        return Err(PaymeError::Internal(format!("API error: {}", status)));
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| PaymeError::Internal(format!("Invalid JSON response: {}", e)))?;
    
    tracing::debug!("Finnhub response for {}: {}", ticker, data);
    
    // Finnhub returns { c: current_price, ... }
    let price = data
        .get("c")
        .and_then(|v| v.as_f64())
        .ok_or_else(|| PaymeError::BadRequest("Could not parse price from Finnhub response".to_string()))?;
    
    if price <= 0.0 {
        return Err(PaymeError::BadRequest("Invalid price value from Finnhub".to_string()));
    }
    
    Ok(price)
}

async fn fetch_crypto_price(
    client: &reqwest::Client,
    ticker: &str,
    api_key: &str,
    base_url: &str,
) -> Result<f64, PaymeError> {
    let response = client
        .get(base_url)
        .query(&[
            ("function", "CURRENCY_EXCHANGE_RATE"),
            ("from_currency", ticker),
            ("to_currency", "USD"),
            ("apikey", api_key),
        ])
        .send()
        .await
        .map_err(|e| PaymeError::Internal(format!("Request failed: {}", e)))?;
    
    let status = response.status();
    if !status.is_success() {
        return Err(PaymeError::Internal(format!("API error: {}", status)));
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| PaymeError::Internal(format!("Invalid JSON response: {}", e)))?;
    
    tracing::debug!("Alpha Vantage crypto response for {}: {}", ticker, data);
    
    // Check for API errors
    if let Some(error) = data.get("Error Message") {
        return Err(PaymeError::BadRequest(format!("Invalid ticker: {}", error)));
    }
    
    if let Some(info) = data.get("Information") {
        tracing::warn!("Alpha Vantage Information message for {}: {}", ticker, info);
        return Err(PaymeError::Internal(
            "API call frequency limit reached. Please try again later.".to_string(),
        ));
    }
    
    // Extract exchange rate
    let rate_obj = data
        .get("Realtime Currency Exchange Rate")
        .ok_or_else(|| PaymeError::BadRequest("No rate data in response".to_string()))?;
    
    let rate_str = rate_obj
        .get("5. Exchange Rate")
        .and_then(|v: &serde_json::Value| v.as_str())
        .ok_or_else(|| PaymeError::BadRequest("Could not parse exchange rate".to_string()))?;
    
    let rate: f64 = rate_str.parse()
        .map_err(|_| PaymeError::BadRequest("Invalid rate format".to_string()))?;
    
    if rate <= 0.0 {
        return Err(PaymeError::BadRequest("Invalid rate value".to_string()));
    }
    
    Ok(rate)
}

async fn fetch_stock_quote(
    client: &reqwest::Client,
    ticker: &str,
    api_key: &str,
    base_url: &str,
) -> Result<f64, PaymeError> {
    let response = client
        .get(base_url)
        .query(&[
            ("function", "GLOBAL_QUOTE"),
            ("symbol", ticker),
            ("apikey", api_key),
        ])
        .send()
        .await
        .map_err(|e| PaymeError::Internal(format!("Request failed: {}", e)))?;
    
    let status = response.status();
    if !status.is_success() {
        return Err(PaymeError::Internal(format!("API error: {}", status)));
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| PaymeError::Internal(format!("Invalid JSON response: {}", e)))?;
    
    tracing::debug!("Alpha Vantage response for {}: {}", ticker, data);
    
    // Check for API errors
    if let Some(error) = data.get("Error Message") {
        return Err(PaymeError::BadRequest(format!("Invalid ticker: {}", error)));
    }
    
    if let Some(info) = data.get("Information") {
        tracing::warn!("Alpha Vantage Information message: {}", info);
        return Err(PaymeError::Internal(
            "API call frequency limit reached. Please try again later.".to_string(),
        ));
    }
    
    // Extract price
    let quote = data
        .get("Global Quote")
        .ok_or_else(|| PaymeError::BadRequest("No quote data in response".to_string()))?;
    
    let price_str = quote
        .get("05. price")
        .and_then(|v: &serde_json::Value| v.as_str())
        .ok_or_else(|| PaymeError::BadRequest("Could not parse price".to_string()))?;
    
    let price: f64 = price_str.parse()
        .map_err(|_| PaymeError::BadRequest("Invalid price format".to_string()))?;
    
    Ok(price)
}

async fn fetch_exchange_rate(
    from: &str,
    to: &str,
    api_key: &str,
) -> Result<f64, PaymeError> {
    let client = reqwest::Client::new();
    let base_url = "https://www.alphavantage.co/query";
    
    let response = client
        .get(base_url)
        .query(&[
            ("function", "CURRENCY_EXCHANGE_RATE"),
            ("from_currency", from),
            ("to_currency", to),
            ("apikey", api_key),
        ])
        .send()
        .await
        .map_err(|e| PaymeError::Internal(format!("Request failed: {}", e)))?;
    
    let status = response.status();
    if !status.is_success() {
        return Err(PaymeError::Internal(format!("API error: {}", status)));
    }
    
    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| PaymeError::Internal(format!("Invalid JSON response: {}", e)))?;
    
    // Check for API errors
    if let Some(error) = data.get("Error Message") {
        return Err(PaymeError::BadRequest(format!("Invalid currency: {}", error)));
    }
    
    if let Some(_info) = data.get("Information") {
        return Err(PaymeError::Internal(
            "API call frequency limit reached. Please try again later.".to_string(),
        ));
    }
    
    // Extract exchange rate
    let rate_obj = data
        .get("Realtime Currency Exchange Rate")
        .ok_or_else(|| PaymeError::BadRequest("No rate data in response".to_string()))?;
    
    let rate_str = rate_obj
        .get("5. Exchange Rate")
        .and_then(|v: &serde_json::Value| v.as_str())
        .ok_or_else(|| PaymeError::BadRequest("Could not parse exchange rate".to_string()))?;
    
    let rate: f64 = rate_str.parse()
        .map_err(|_| PaymeError::BadRequest("Invalid rate format".to_string()))?;
    
    if rate <= 0.0 {
        return Err(PaymeError::BadRequest("Invalid rate value".to_string()));
    }
    
    Ok(rate)
}
