// Market Direction Utils - חישוב אינדיקטורי כיוון שוק
export class MarketDirectionUtils {
  // Calculate market direction indicators (-10 to +10)
  static calculateWeeklyIndicator(marketData: any): number {
    let score = 0;

    // SPY weekly trend
    if (marketData.spy_weekly.close > marketData.spy_weekly.sma20) {
      score += 3;
    } else {
      score -= 3;
    }

    // QQQ weekly trend
    if (marketData.qqq_weekly.close > marketData.qqq_weekly.sma20) {
      score += 3;
    } else {
      score -= 3;
    }

    // IWM weekly trend
    if (marketData.iwm_weekly.close > marketData.iwm_weekly.sma20) {
      score += 2;
    } else {
      score -= 2;
    }

    // VIX level
    if (marketData.vix_weekly.close < 20) {
      score += 2;
    } else if (marketData.vix_weekly.close > 30) {
      score -= 2;
    }

    return Math.max(-10, Math.min(10, score));
  }

  static calculateDailyIndicator(marketData: any): number {
    let score = 0;

    // Market breadth
    if (marketData.breadth.value >= 70) {
      score += 4;
    } else if (marketData.breadth.value <= 30) {
      score -= 4;
    }

    // SPY above VWAP
    if (marketData.spy.above_vwap) {
      score += 2;
    } else {
      score -= 2;
    }

    // QQQ above VWAP
    if (marketData.qqq.above_vwap) {
      score += 2;
    } else {
      score -= 2;
    }

    // IWM above VWAP
    if (marketData.iwm.above_vwap) {
      score += 1;
    } else {
      score -= 1;
    }

    // VIX level
    if (marketData.vix.value <= 20) {
      score += 1;
    } else if (marketData.vix.value >= 30) {
      score -= 1;
    }

    return Math.max(-10, Math.min(10, score));
  }

  // Get indicator color and emoji
  static getIndicatorStyle(value: number): {
    color: string;
    emoji: string;
    text: string;
  } {
    if (value >= 5) {
      return { color: 'green', emoji: '🟢', text: `+${value}` };
    } else if (value <= -5) {
      return { color: 'red', emoji: '🔴', text: `${value}` };
    } else {
      return { color: 'gray', emoji: '⚪', text: `${value}` };
    }
  }

  // Calculate market direction for individual stock
  static calculateStockDirection(stockData: any, marketData: any): {
    weekly: number;
    daily: number;
    final: number;
    direction: 'LONG' | 'SHORT' | 'WAIT';
  } {
    let weeklyScore = 0;
    let dailyScore = 0;

    // Weekly factors
    if (stockData.weekly_trend === 'bullish') {
      weeklyScore += 5;
    } else if (stockData.weekly_trend === 'bearish') {
      weeklyScore -= 5;
    }

    if (stockData.above_vwap) {
      weeklyScore += 3;
    } else {
      weeklyScore -= 3;
    }

    if (stockData.distance_to_pwh > 0.02 && stockData.distance_to_pwl > 0.02) {
      weeklyScore += 2;
    }

    // Daily factors
    if (stockData.rs_vs_spy > 0) {
      dailyScore += 4;
    } else {
      dailyScore -= 4;
    }

    if (stockData.rvol >= 2.0) {
      dailyScore += 3;
    } else {
      dailyScore -= 1;
    }

    if (stockData.gap_type === 'UP') {
      dailyScore += 3;
    } else if (stockData.gap_type === 'DOWN') {
      dailyScore -= 3;
    }

    // Final score
    const final = Math.round((weeklyScore * 0.4) + (dailyScore * 0.6));
    const direction = final >= 5 ? 'LONG' : final <= -5 ? 'SHORT' : 'WAIT';

    return {
      weekly: Math.max(-10, Math.min(10, weeklyScore)),
      daily: Math.max(-10, Math.min(10, dailyScore)),
      final: Math.max(-10, Math.min(10, final)),
      direction
    };
  }

  // Get market sentiment
  static getMarketSentiment(weekly: number, daily: number): string {
    const avg = (weekly + daily) / 2;
    
    if (avg >= 6) return 'Very Bullish';
    if (avg >= 3) return 'Bullish';
    if (avg >= 0) return 'Neutral Bullish';
    if (avg >= -3) return 'Neutral Bearish';
    if (avg >= -6) return 'Bearish';
    return 'Very Bearish';
  }

  // Calculate position sizing based on direction confidence
  static calculatePositionSize(baseSize: number, direction: string, confidence: string): number {
    let multiplier = 1;

    if (confidence === 'HIGH') {
      multiplier = 1.0;
    } else if (confidence === 'MEDIUM') {
      multiplier = 0.7;
    } else {
      multiplier = 0.3;
    }

    return Math.round(baseSize * multiplier);
  }
}
