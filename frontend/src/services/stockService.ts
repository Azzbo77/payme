// Stock price service for fetching stock and crypto prices
// Uses backend proxy to securely fetch from Alpha Vantage API

const BASE_URL = "/api";

interface StockPrice {
  ticker: string;
  price: number;
  timestamp: number;
}

interface StockCache {
  [ticker: string]: StockPrice;
}

const CACHE_KEY = "stockPriceCache";
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

// Get cached stock prices
function getCachedPrices(): StockCache {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

// Save stock prices to cache
function setCachedPrices(cache: StockCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    console.error("Failed to cache stock prices");
  }
}

// Check if cached price is still valid (less than a week old)
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < WEEK_IN_MS;
}

// Fetch stock price from backend proxy
async function fetchStockPriceFromAPI(ticker: string): Promise<number> {
  try {
    const response = await fetch(`${BASE_URL}/stocks/price?ticker=${encodeURIComponent(ticker)}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.price || data.price <= 0) {
      throw new Error("Invalid price received from server");
    }

    return data.price;
  } catch (error) {
    console.error(`Failed to fetch ${ticker}:`, error);
    throw error;
  }
}

// Get stock price with caching logic
export async function getStockPrice(ticker: string, forceRefresh = false): Promise<number> {
  const cache = getCachedPrices();
  const cachedPrice = cache[ticker.toUpperCase()];

  // Return cached price if valid and not forcing refresh
  if (cachedPrice && !forceRefresh && isCacheValid(cachedPrice.timestamp)) {
    return cachedPrice.price;
  }

  // Fetch fresh price from API
  const price = await fetchStockPriceFromAPI(ticker);

  // Update cache
  cache[ticker.toUpperCase()] = {
    ticker: ticker.toUpperCase(),
    price,
    timestamp: Date.now(),
  };
  setCachedPrices(cache);

  return price;
}

// Get multiple stock prices efficiently
export async function getStockPrices(
  tickers: string[],
  forceRefresh = false
): Promise<{ [ticker: string]: number }> {
  const results: { [ticker: string]: number } = {};
  const tickersToFetch: string[] = [];

  const cache = getCachedPrices();

  // Check cache first
  for (const ticker of tickers) {
    const upperTicker = ticker.toUpperCase();
    const cachedPrice = cache[upperTicker];

    if (cachedPrice && !forceRefresh && isCacheValid(cachedPrice.timestamp)) {
      results[upperTicker] = cachedPrice.price;
    } else {
      tickersToFetch.push(upperTicker);
    }
  }

  // Fetch remaining tickers
  for (const ticker of tickersToFetch) {
    try {
      const price = await getStockPrice(ticker, true);
      results[ticker] = price;
      // Add small delay to respect API rate limits
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Failed to fetch price for ${ticker}:`, error);
      results[ticker] = 0;
    }
  }

  return results;
}

// Clear old cache entries (optional cleanup)
export function clearExpiredCache(): void {
  const cache = getCachedPrices();
  const validCache: StockCache = {};

  for (const [ticker, data] of Object.entries(cache)) {
    if (isCacheValid(data.timestamp)) {
      validCache[ticker] = data;
    }
  }

  setCachedPrices(validCache);
}

// Get all cached stock prices
export function getCachedStockPrices(): StockCache {
  return getCachedPrices();
}

// Convert USD price to another currency
export async function convertUSDPrice(usdPrice: number, toCurrency: string): Promise<number> {
  if (toCurrency === "USD") {
    return usdPrice;
  }

  try {
    // Use backend exchange rate conversion
    const response = await fetch(
      `${BASE_URL}/stocks/exchange-rate?from=USD&to=${encodeURIComponent(toCurrency)}`
    );

    if (!response.ok) {
      console.warn(`Failed to fetch exchange rate (HTTP ${response.status}), using USD`);
      return usdPrice;
    }

    const data = await response.json();
    const rate = data.rate || 1;

    if (rate <= 0) {
      console.warn(`Invalid exchange rate received, using USD`);
      return usdPrice;
    }

    const converted = usdPrice * rate;
    console.log(`Converted ${usdPrice} USD to ${converted} ${toCurrency} (rate: ${rate})`);
    return converted;
  } catch (error) {
    console.warn(`Exchange rate conversion failed, using USD:`, error);
    return usdPrice;
  }
}
