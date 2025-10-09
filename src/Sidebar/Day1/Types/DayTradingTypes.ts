// Day Trading Types

// Gates Status Interface
export interface GatesStatusData {
  breadth_80: boolean;
  spy_above_vwap: boolean;
  qqq_above_vwap: boolean;
  iwm_above_vwap: boolean;
  vix_low: boolean;
  rvol_high: boolean;
  spread_low: boolean;
  weekly_context: boolean;
  all_passed: boolean;
}

// Export alias for compatibility
export type GatesStatus = GatesStatusData;

export interface DayTradingData {
  symbol: string;
  timestamp: string;
  scan_type: 'weekly' | 'daily' | 'premarket' | 'scout' | 'reinforcement' | 'end_of_day';
  
  // Market data
  market: {
    spy: number;
    qqq: number;
    iwm: number;
    vix: number;
    breadth: number;
  };
  
  // Stock data
  stock: {
    price: number;
    pm_high: number;
    pm_low: number;
    or5_high: number;
    or5_low: number;
    vwap: number;
    rvol: number;
    spread: number;
  };
  
  // Gates status
  gates: {
    breadth: boolean;
    spy_above_vwap: boolean;
    qqq_above_vwap: boolean;
    iwm_above_vwap: boolean;
    vix_low: boolean;
    rvol_high: boolean;
    spread_low: boolean;
    all_passed: boolean;
  };
  
  // Trading data
  trading?: {
    entry_price: number;
    stop_loss: number;
    take_profit_1: number;
    take_profit_2: number;
    position_size: number;
    rr_ratio: number;
  };
  
  // Weekly context
  weekly?: {
    trend: 'bullish' | 'bearish' | 'neutral';
    above_vwap: boolean;
    distance_to_pwh: number;
    distance_to_pwl: number;
  };
}

export interface MarketDirectionScore {
  weekly: number; // -100 to +100
  daily: number;  // -100 to +100
  final: number;  // -100 to +100
  direction: 'LONG' | 'SHORT' | 'WAIT';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}


export interface TradingEntry {
  symbol: string;
  entry_price: number;
  position_size: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  or5_high: number;
  or5_low: number;
  vwap: number;
  rvol: number;
  spread: number;
  status: 'ENTRY_EXECUTED' | 'REINFORCED' | 'EXITED';
}

export interface DailyPerformance {
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
}
