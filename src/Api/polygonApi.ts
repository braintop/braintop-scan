// Polygon API Service
const POLYGON_API_KEY = import.meta.env.VITE_POLYGON_API_KEY;
const BASE_URL = 'https://api.polygon.io';

// Debug: Check if API key is available
// Polygon API Key loaded
if (!POLYGON_API_KEY) {
  console.error('❌ VITE_POLYGON_API_KEY is not set! Please add it to your .env file');
}

export interface PolygonTicker {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  last_updated_utc?: string;
}

export interface PolygonAggs {
  ticker: string;
  adjusted: boolean;
  queryCount: number;
  request_id: string;
  resultsCount: number;
  status: string;
  results: {
    c: number; // close
    h: number; // high
    l: number; // low
    n: number; // number of transactions
    o: number; // open
    t: number; // timestamp
    v: number; // volume
    vw: number; // volume weighted average price
  }[];
}

export interface PolygonTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
  description?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  branding?: {
    logo_url?: string;
    icon_url?: string;
  };
  share_class_shares_outstanding?: number;
  weighted_shares_outstanding?: number;
  market_cap?: number;
}

export interface PolygonPrevClose {
  ticker: string;
  adjusted: boolean;
  results: {
    T: string; // ticker
    v: number; // volume
    vw: number; // volume weighted average price
    o: number; // open
    c: number; // close
    h: number; // high
    l: number; // low
    t: number; // timestamp
    n: number; // number of transactions
  }[];
}

export interface PolygonSnapshot {
  ticker: string;
  last_quote?: {
    bid: number;
    bid_size: number;
    ask: number;
    ask_size: number;
    exchange: number;
    last_updated: number;
  };
  last_trade?: {
    conditions: number[];
    exchange: number;
    price: number;
    sip_timestamp: number;
    size: number;
    timeframe: string;
  };
  // Updated fields based on actual API response
  lastQuote?: {
    P: number;
    S: number;
    p: number;
    s: number;
    t: number;
  };
  lastTrade?: {
    c: number[];
    i: string;
    p: number;
    s: number;
    t: number;
    x: number;
  };
  market_status: string;
  name: string;
  type: string;
  session?: {
    change: number;
    change_percent: number;
    early_trading_change: number;
    early_trading_change_percent: number;
    close: number;
    high: number;
    low: number;
    open: number;
    previous_close: number;
  };
  day?: {
    change: number;
    change_percent: number;
    close: number;
    high: number;
    low: number;
    open: number;
    previous_close: number;
    volume: number;
    vwap: number;
  };
  prev_day?: {
    close: number;
    high: number;
    low: number;
    open: number;
    volume: number;
    vwap: number;
  };
  updated: number;
}

// Helper function to make API calls with retry logic
async function polygonApiCall(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  
  // Add API key and params
  url.searchParams.append('apikey', POLYGON_API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  // Polygon API Call

  try {
    const response = await fetch(url.toString());
    
    // API Response Status
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`Polygon API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'ERROR') {
      throw new Error(`Polygon API error: ${data.error || 'Unknown error'}`);
    }
    
    // API Success
    return data;
  } catch (error) {
    console.error('💥 Polygon API call failed:', error);
    throw error;
  }
}

// Get all active stocks from NASDAQ and NYSE
export async function getAllActiveStocks(): Promise<PolygonTicker[]> {
  try {
    const data = await polygonApiCall('/v3/reference/tickers', {
      market: 'stocks',
      active: true,
      limit: 1000,
      sort: 'ticker'
    });
    
    return data.results || [];
  } catch (error) {
    console.error('Failed to fetch active stocks:', error);
    return [];
  }
}

// Get ticker details including market cap, shares outstanding, etc.
export async function getTickerDetails(ticker: string): Promise<PolygonTickerDetails | null> {
  try {
    const data = await polygonApiCall(`/v3/reference/tickers/${ticker}`);
    return data.results || null;
  } catch (error) {
    console.error(`Failed to fetch ticker details for ${ticker}:`, error);
    return null;
  }
}

// Get historical data for volume analysis
export async function getHistoricalData(
  ticker: string, 
  from: string, 
  to: string,
  timespan: string = 'day',
  multiplier: number = 1
): Promise<PolygonAggs | null> {
  try {
    const data = await polygonApiCall(`/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`, {
      adjusted: true,
      sort: 'asc',
      limit: 50000
    });
    
    return data;
  } catch (error) {
    console.error(`Failed to fetch historical data for ${ticker}:`, error);
    return null;
  }
}

// Get previous day's close
export async function getPreviousClose(ticker: string): Promise<PolygonPrevClose | null> {
  try {
    const data = await polygonApiCall(`/v2/aggs/ticker/${ticker}/prev`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch previous close for ${ticker}:`, error);
    return null;
  }
}

// Get current snapshot with quote data for spread calculation
export async function getSnapshot(ticker: string): Promise<PolygonSnapshot | null> {
  try {
    // First try to get the most recent trade price
    // Getting last trade
    const lastTradeData = await polygonApiCall(`/v1/last/stocks/${ticker}`);
    
    if (lastTradeData && lastTradeData.last && lastTradeData.last.price) {
      // console.log(`✅ Got last trade for ${ticker}: $${lastTradeData.last.price}`);
      
      // Also get the daily snapshot for volume and other data
      const snapshotData = await polygonApiCall(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);
      
      if (snapshotData && snapshotData.ticker) {
        const ticker_data = snapshotData.ticker;
        // console.log(`✅ Got snapshot data for ${ticker}:`, ticker_data);
        
        // Use last trade price as primary, fall back to snapshot data
        const currentPrice = lastTradeData.last.price || ticker_data.lastTrade?.p || ticker_data.day?.c || ticker_data.prevDay?.c;
        const currentVolume = ticker_data.day?.v || ticker_data.prevDay?.v;
      
        return {
          ticker: ticker,
          last_trade: {
            price: currentPrice,
            size: lastTradeData.last.size || currentVolume,
            exchange: lastTradeData.last.exchange || 0,
            conditions: lastTradeData.last.cond1 && lastTradeData.last.cond2 ? [lastTradeData.last.cond1, lastTradeData.last.cond2] : [],
            sip_timestamp: lastTradeData.last.timestamp || ticker_data.updated || Date.now(),
            timeframe: 'REAL-TIME'
          },
          last_quote: ticker_data.lastQuote ? {
          bid: ticker_data.lastQuote.p,
          bid_size: ticker_data.lastQuote.s,
          ask: ticker_data.lastQuote.P,
          ask_size: ticker_data.lastQuote.S,
          exchange: 0,
          last_updated: ticker_data.updated || Date.now()
        } : undefined,
        market_status: 'open',
        name: ticker,
        type: 'stock',
        updated: ticker_data.updated || Date.now(),
        day: {
          close: currentPrice,
          high: ticker_data.day?.h || ticker_data.prevDay?.h || currentPrice,
          low: ticker_data.day?.l || ticker_data.prevDay?.l || currentPrice,
          open: ticker_data.day?.o || ticker_data.prevDay?.o || currentPrice,
          previous_close: ticker_data.prevDay?.c || currentPrice,
          volume: currentVolume,
          vwap: ticker_data.day?.vw || ticker_data.prevDay?.vw || currentPrice,
          change: ticker_data.todaysChange || 0,
          change_percent: ticker_data.todaysChangePerc || 0
        }
      } as PolygonSnapshot;
      }
      
      // If we have last trade but no snapshot, create minimal snapshot
      return {
        ticker: ticker,
        last_trade: {
          price: lastTradeData.last.price,
          size: lastTradeData.last.size,
          exchange: lastTradeData.last.exchange || 0,
          conditions: lastTradeData.last.cond1 && lastTradeData.last.cond2 ? [lastTradeData.last.cond1, lastTradeData.last.cond2] : [],
          sip_timestamp: lastTradeData.last.timestamp,
          timeframe: 'REAL-TIME'
        },
        market_status: 'open',
        name: ticker,
        type: 'stock',
        updated: lastTradeData.last.timestamp,
        day: {
          close: lastTradeData.last.price,
          high: lastTradeData.last.price,
          low: lastTradeData.last.price,
          open: lastTradeData.last.price,
          previous_close: lastTradeData.last.price,
          volume: 0,
          vwap: lastTradeData.last.price,
          change: 0,
          change_percent: 0
        }
      } as PolygonSnapshot;
    }
    
    throw new Error('No snapshot data available');
  } catch (error) {
    console.error(`❌ Snapshot failed for ${ticker}:`, error);
    
    // Fallback to previous close endpoint
    try {
      // console.log(`🔄 Falling back to previous close for ${ticker}...`);
      // Try to get data from August 29, 2025 specifically
      const specificDate = '2025-08-29';
      // console.log(`📅 Trying to get ${ticker} data for ${specificDate}`);
      let prevData = await polygonApiCall(`/v2/aggs/ticker/${ticker}/range/1/day/${specificDate}/${specificDate}`);
      
      // If that fails, try the general previous close endpoint
      if (!prevData || !prevData.results || prevData.results.length === 0) {
        // console.log(`🔄 Specific date failed, trying general previous close for ${ticker}...`);
        prevData = await polygonApiCall(`/v2/aggs/ticker/${ticker}/prev`);
      }
      
      if (prevData && prevData.results && prevData.results.length > 0) {
        const result = prevData.results[0];
        // console.log(`✅ Got previous close for ${ticker}:`, result);
        
        // Transform previous close to snapshot format with real data
        return {
          ticker: ticker,
          last_trade: {
            price: result.c,
            size: result.v,
            exchange: 0,
            conditions: [],
            sip_timestamp: result.t,
            timeframe: 'DELAYED'
          },
          market_status: 'closed',
          name: ticker,
          type: 'stock',
          updated: result.t,
          day: {
            close: result.c,
            high: result.h,
            low: result.l,
            open: result.o,
            previous_close: result.c,
            volume: result.v,
            vwap: result.vw,
            change: 0,
            change_percent: 0
          }
        } as PolygonSnapshot;
      }
      
      throw new Error('No previous close data available');
    } catch (error2) {
      console.error(`❌ Previous close failed for ${ticker}:`, error2);
    }
    
    // Try grouped aggregates for current market day as fallback
    try {
      // console.log(`🔄 Trying grouped aggregates for ${ticker}...`);
      
      // Use September 8, 2025 (Sunday) as the latest trading day
      const lastTradingDay = new Date('2025-09-08');
      const dateStr = lastTradingDay.toISOString().split('T')[0];
      // console.log(`📅 Using specific trading date: ${dateStr} (Sunday, Sep 8, 2025)`);
      
      const groupedData = await polygonApiCall(`/v2/aggs/grouped/locale/us/market/stocks/${dateStr}`);
      
      if (groupedData && groupedData.results) {
        // Find our ticker in the grouped results
        const tickerData = groupedData.results.find((item: any) => item.T === ticker);
        
        if (tickerData) {
          // console.log(`✅ Found ${ticker} in grouped data:`, tickerData);
          
          return {
            ticker: ticker,
            last_trade: {
              price: tickerData.c,
              size: tickerData.v,
              exchange: 0,
              conditions: [],
              sip_timestamp: tickerData.t,
              timeframe: 'DELAYED'
            },
            market_status: 'closed',
            name: ticker,
            type: 'stock',
            updated: tickerData.t,
            day: {
              close: tickerData.c,
              high: tickerData.h,
              low: tickerData.l,
              open: tickerData.o,
              previous_close: tickerData.c,
              volume: tickerData.v,
              vwap: tickerData.vw,
              change: 0,
              change_percent: 0
            }
          } as PolygonSnapshot;
        }
      }
    } catch (error2) {
      console.error(`❌ Grouped aggregates also failed for ${ticker}:`, error2);
    }
    
    console.error(`💥 All API attempts failed for ${ticker}`);
    return null;
  }
}

// Get market status
export async function getMarketStatus(): Promise<any> {
  try {
    const data = await polygonApiCall('/v1/marketstatus/now');
    return data;
  } catch (error) {
    console.error('Failed to fetch market status:', error);
    return null;
  }
}

// Batch function to get multiple snapshots at once
export async function getBatchSnapshots(tickers: string[]): Promise<PolygonSnapshot[]> {
  try {
    const tickerString = tickers.join(',');
    
    // Try different Polygon API endpoints for pre-market data
    // console.log('🔍 Trying pre-market data endpoint...');
    
    // Try multiple endpoints to get pre-market data
    let data;
    
    try {
      // First try: Get current market data with detailed session info
      data = await polygonApiCall(`/v2/snapshot/locale/us/markets/stocks/tickers`, {
        'tickers': tickerString
      });
      // console.log('✅ Got data from main snapshot endpoint');
    } catch (error) {
      // console.log('❌ Main snapshot endpoint failed, trying alternative...');
      
      // Alternative: Try individual ticker snapshots
      const individualSnapshots = [];
      for (const ticker of tickers) {
        try {
          const tickerData = await polygonApiCall(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);
          if (tickerData && tickerData.ticker) {
            individualSnapshots.push(tickerData.ticker);
          }
        } catch (tickerError) {
          // console.log(`❌ Failed to get data for ${ticker}:`, tickerError);
        }
      }
      data = { tickers: individualSnapshots };
      // console.log(`✅ Got ${individualSnapshots.length} individual snapshots`);
    }
    
    // console.log('🔍 Batch snapshots response structure:', Object.keys(data || {}));
    // console.log('🔍 Batch snapshots data:', data);
    
    // Debug: Log first ticker structure if available
    if (data.tickers && data.tickers.length > 0) {
        // console.log('🔍 First ticker structure:', data.tickers[0]);
        // console.log('🔍 First ticker keys:', Object.keys(data.tickers[0] || {}));
        
        // Check if we have pre-market data
        const firstTicker = data.tickers[0];
        // console.log('🔍 Pre-market data check:');
        // console.log('  - last_trade:', firstTicker.last_trade);
        // console.log('  - last_quote:', firstTicker.last_quote);
        // console.log('  - day:', firstTicker.day);
        // console.log('  - prev_day:', firstTicker.prev_day);
        // console.log('  - session:', firstTicker.session);
        // console.log('  - market_status:', firstTicker.market_status);
    }
    
    // Polygon API returns 'tickers' array, not 'results'
    return data.tickers || data.results || [];
  } catch (error) {
    console.error('Failed to fetch batch snapshots:', error);
    return [];
  }
}

// Calculate 20-day average volume
export function calculateAverageVolume(results: PolygonAggs['results']): number {
  if (!results || results.length === 0) return 0;
  
  const totalVolume = results.reduce((sum, day) => sum + day.v, 0);
  return totalVolume / results.length;
}

// Calculate spread percentage
export function calculateSpread(bid: number, ask: number): number {
  if (!bid || !ask || bid <= 0 || ask <= 0) return 0;
  return ((ask - bid) / ask) * 100;
}

// Calculate dollar volume
export function calculateDollarVolume(volume: number, price: number): number {
  return volume * price;
}

// Get pre-market data using Aggregates API for specific date and time
export async function getPreMarketData(
  ticker: string, 
  date: string, 
  targetTimeET: string = '09:15'
): Promise<{price: number, volume: number, timestamp: number} | null> {
  try {
    // console.log(`🔍 Getting pre-market data for ${ticker} on ${date} at ${targetTimeET} ET...`);
    
    // Convert target time to timestamp
    // 09:15 ET = 14:15 UTC (EST = UTC-5 in winter, EDT = UTC-4 in summer)
    // For October, we use EST (UTC-5)
    const [hours, minutes] = targetTimeET.split(':').map(Number);
    const targetDateTime = new Date(`${date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000-05:00`);
    const targetTimestamp = targetDateTime.getTime();
    
    // console.log(`⏰ Target timestamp: ${targetTimestamp} (${targetDateTime.toISOString()})`);
    
    // Get minute-by-minute data for the entire day with pre/post market
    const data = await polygonApiCall(`/v2/aggs/ticker/${ticker}/range/1/minute/${date}/${date}`, {
      adjusted: true,
      include_prepost: true,
      sort: 'asc'
    });
    
    if (!data || !data.results || data.results.length === 0) {
      // console.log(`❌ No data found for ${ticker} on ${date}`);
      return null;
    }
    
    // console.log(`📊 Found ${data.results.length} minute bars for ${ticker} on ${date}`);
    
    // Find the closest minute bar to our target time
    let closestBar = null;
    let minTimeDiff = Infinity;
    
    for (const bar of data.results) {
      const timeDiff = Math.abs(bar.t - targetTimestamp);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestBar = bar;
      }
    }
    
    if (closestBar) {
      const actualTime = new Date(closestBar.t).toISOString();
      // Found closest bar
      
      return {
        price: closestBar.c,
        volume: closestBar.v,
        timestamp: closestBar.t
      };
    }
    
    // console.log(`❌ No suitable bar found for ${ticker} at ${targetTimeET} ET`);
    return null;
    
  } catch (error) {
    console.error(`❌ Failed to get pre-market data for ${ticker}:`, error);
    return null;
  }
}

// Technical Indicators - SMA
export async function getSMA(ticker: string, window: number = 20, timespan: string = 'day'): Promise<any> {
  try {
    const url = `${BASE_URL}/v1/indicators/sma/${ticker}?timespan=${timespan}&window=${window}&series_type=close&apikey=${POLYGON_API_KEY}`;
    // console.log('📊 SMA API Call:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok && data.status === 'OK') {
      // console.log('✅ SMA Success:', data);
      return data;
    } else {
      console.error('❌ SMA Error:', data);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to fetch SMA for ${ticker}:`, error);
    return null;
  }
}

// Technical Indicators - EMA
export async function getEMA(ticker: string, window: number = 12, timespan: string = 'day'): Promise<any> {
  try {
    const url = `${BASE_URL}/v1/indicators/ema/${ticker}?timespan=${timespan}&window=${window}&series_type=close&apikey=${POLYGON_API_KEY}`;
    // console.log('📊 EMA API Call:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok && data.status === 'OK') {
      // console.log('✅ EMA Success:', data);
      return data;
    } else {
      console.error('❌ EMA Error:', data);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to fetch EMA for ${ticker}:`, error);
    return null;
  }
}

// Technical Indicators - MACD
export async function getMACD(ticker: string, shortWindow: number = 12, longWindow: number = 26, signalWindow: number = 9, timespan: string = 'day'): Promise<any> {
  try {
    const url = `${BASE_URL}/v1/indicators/macd/${ticker}?timespan=${timespan}&short_window=${shortWindow}&long_window=${longWindow}&signal_window=${signalWindow}&series_type=close&apikey=${POLYGON_API_KEY}`;
    // console.log('📊 MACD API Call:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok && data.status === 'OK') {
      // console.log('✅ MACD Success:', data);
      return data;
    } else {
      console.error('❌ MACD Error:', data);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to fetch MACD for ${ticker}:`, error);
    return null;
  }
}

// Technical Indicators - RSI
export async function getRSI(ticker: string, window: number = 14, timespan: string = 'day'): Promise<any> {
  try {
    const url = `${BASE_URL}/v1/indicators/rsi/${ticker}?timespan=${timespan}&window=${window}&series_type=close&apikey=${POLYGON_API_KEY}`;
    // console.log('📊 RSI API Call:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok && data.status === 'OK') {
      // console.log('✅ RSI Success:', data);
      return data;
    } else {
      console.error('❌ RSI Error:', data);
      return null;
    }
  } catch (error) {
    console.error(`❌ Failed to fetch RSI for ${ticker}:`, error);
    return null;
  }
}

export default {
  getAllActiveStocks,
  getTickerDetails,
  getHistoricalData,
  getPreviousClose,
  getSnapshot,
  getMarketStatus,
  getBatchSnapshots,
  calculateAverageVolume,
  calculateSpread,
  calculateDollarVolume,
  getSMA,
  getEMA,
  getMACD,
  getRSI
};
