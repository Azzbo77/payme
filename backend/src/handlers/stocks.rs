use axum::{extract::Query, http::StatusCode, Extension, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::PaymeError;

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
    Query(req): Query<StockPriceRequest>,
) -> Result<Json<StockPriceResponse>, PaymeError> {
    let ticker = validate_ticker(&req.ticker)?;
    let api_key = std::env::var("ALPHA_VANTAGE_API_KEY")
        .map_err(|_| PaymeError::Internal("Stock price API not configured".to_string()))?;
    
    let price = fetch_stock_price(&ticker, &api_key).await?;
    
    Ok(Json(StockPriceResponse {
        ticker,
        price,
    }))
}

pub async fn get_exchange_rate(
    Query(req): Query<ExchangeRateRequest>,
) -> Result<Json<ExchangeRateResponse>, PaymeError> {
    let from = validate_ticker(&req.from)?;
    let to = validate_ticker(&req.to)?;
    let api_key = std::env::var("ALPHA_VANTAGE_API_KEY")
        .map_err(|_| PaymeError::Internal("Exchange rate API not configured".to_string()))?;
    
    let rate = fetch_exchange_rate(&from, &to, &api_key).await?;
    
    Ok(Json(ExchangeRateResponse {
        from_currency: from,
        to_currency: to,
        rate,
    }))
}

async fn fetch_stock_price(ticker: &str, api_key: &str) -> Result<f64, PaymeError> {
    let client = reqwest::Client::new();
    let base_url = "https://www.alphavantage.co/query";
    
    // Try crypto first if it's a known crypto ticker
    if is_crypto(ticker) {
        match fetch_crypto_price(&client, ticker, api_key, base_url).await {
            Ok(price) => return Ok(price),
            Err(e) => {
                tracing::warn!("Crypto lookup failed for {}: {}, attempting stock lookup", ticker, e);
                // Fall through to stock lookup
            }
        }
    }
    
    // Try stock lookup
    fetch_stock_quote(&client, ticker, api_key, base_url).await
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
    
    // Check for API errors
    if let Some(error) = data.get("Error Message") {
        return Err(PaymeError::BadRequest(format!("Invalid ticker: {}", error)));
    }
    
    if let Some(info) = data.get("Information") {
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
    
    // Check for API errors
    if let Some(error) = data.get("Error Message") {
        return Err(PaymeError::BadRequest(format!("Invalid ticker: {}", error)));
    }
    
    if let Some(info) = data.get("Information") {
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
    
    if let Some(info) = data.get("Information") {
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
