// Market Data Types
export interface MarketData {
  spy: {
    price: number;
    change: number;
    above_vwap: boolean;
  };
  qqq: {
    price: number;
    change: number;
    above_vwap: boolean;
  };
  iwm: {
    price: number;
    change: number;
    above_vwap: boolean;
  };
  vix: {
    value: number;
    above_25: boolean;
  };
  breadth: {
    value: number;
    status: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
}

export interface WeeklyMarketData {
  spy_weekly: {
    close: number;
    sma20: number;
    vwap: number;
  };
  qqq_weekly: {
    close: number;
    sma20: number;
    vwap: number;
  };
  iwm_weekly: {
    close: number;
    sma20: number;
    vwap: number;
  };
  vix_weekly: {
    close: number;
    sma20: number;
    vwap: number;
  };
}

export interface StockData {
  symbol: string;
  price: number;
  prev_close: number;
  change: number;
  atr: number;
  rs_vs_spy: number;
  sma20: number;
  sma50: number;
  sma200: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  rsi: number;
  adx: number;
  support_resistance: {
    support: number;
    resistance: number;
    pivot: number;
  };
}

export interface WeeklyStockData {
  symbol: string;
  weekly_close: number;
  weekly_sma20: number;
  weekly_sma50: number;
  weekly_vwap: number;
  pwh: number;
  pwl: number;
  weekly_trend: 'bullish' | 'bearish' | 'neutral';
  above_vwap: boolean;
  distance_to_pwh: number;
  distance_to_pwl: number;
}

export interface PremarketData {
  symbol: string;
  pm_high: number;
  pm_low: number;
  gap_percent: number;
  gap_type: 'UP' | 'DOWN' | 'FLAT';
  rr_calculation: {
    entry: number;
    stop_loss: number;
    take_profit_1: number;
    take_profit_2: number;
    rr_ratio: number;
  };
}
