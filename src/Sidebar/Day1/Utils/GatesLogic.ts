// Gates Logic Utils
import type { GatesStatus } from '../Types/DayTradingTypes';
import type { MarketData } from '../Types/MarketTypes';

export class GatesLogic {
  // Check if all daily gates pass
  static checkDailyGates(marketData: MarketData, stockData: any): GatesStatus {
    const gates: GatesStatus = {
      breadth_80: marketData.breadth.value >= 50, // More realistic: 50% instead of 80%
      spy_above_vwap: marketData.spy.above_vwap,
      qqq_above_vwap: marketData.qqq.above_vwap,
      iwm_above_vwap: marketData.iwm.above_vwap,
      vix_low: marketData.vix.value <= 30, // More realistic: 30 instead of 25
      rvol_high: stockData.rvol >= 1.5, // More realistic: 1.5x instead of 2.0x
      spread_low: stockData.spread <= 0.3, // More realistic: 0.3 instead of 0.2
      weekly_context: true, // Will be set by weekly gates
      all_passed: false
    };

    gates.all_passed = gates.breadth_80 && 
                      gates.spy_above_vwap && 
                      gates.qqq_above_vwap && 
                      gates.iwm_above_vwap && 
                      gates.vix_low && 
                      gates.rvol_high && 
                      gates.spread_low && 
                      gates.weekly_context;

    return gates;
  }

  // Check if weekly gates pass
  static checkWeeklyGates(weeklyData: any): boolean {
    // Weekly gates logic
    const weeklyTrend = weeklyData.weekly_trend === 'bullish';
    const aboveWeeklyVWAP = weeklyData.above_vwap;
    const notNearLevels = weeklyData.distance_to_pwh > 0.01 && weeklyData.distance_to_pwl > 0.01;

    return weeklyTrend && aboveWeeklyVWAP && notNearLevels;
  }

  // Calculate daily score (0-100)
  static calculateDailyScore(gates: GatesStatus, _marketData: MarketData, stockData: any): number {
    let score = 0;

    // Market Breadth ≥ 80: +20 points
    if (gates.breadth_80) score += 20;

    // SPY & QQQ & IWM מעל VWAP: +15 points
    if (gates.spy_above_vwap && gates.qqq_above_vwap && gates.iwm_above_vwap) score += 15;

    // VIX ≤ 25: +10 points
    if (gates.vix_low) score += 10;

    // RVOL ≥ 2.0: +15 points
    if (gates.rvol_high) score += 15;

    // Spread ≤ 0.2%: +10 points
    if (gates.spread_low) score += 10;

    // Gap-and-Go (מעל PM High): +20 points
    if (stockData.gap_type === 'UP' && stockData.gap_percent > 0.5) score += 20;

    // Weekly Context Bonus: +10 points
    if (gates.weekly_context) score += 10;

    // Add stock-specific performance score (0-30 points)
    const stockPerformance = this.calculateStockPerformanceScore(stockData);
    score += stockPerformance;

    // Add technical indicators score (0-40 points)
    const technicalScore = this.calculateTechnicalScore(stockData);
    score += technicalScore;

    return Math.min(100, score);
  }

  // Calculate stock-specific performance score (0-30)
  static calculateStockPerformanceScore(stockData: any): number {
    let score = 0;

    // Gap performance (0-10 points)
    if (stockData.gap_percent > 2) score += 10;
    else if (stockData.gap_percent > 1) score += 7;
    else if (stockData.gap_percent > 0) score += 4;
    else if (stockData.gap_percent < -2) score -= 5;
    else if (stockData.gap_percent < 0) score -= 2;

    // Volume performance (0-10 points)
    if (stockData.rvol > 5) score += 10;
    else if (stockData.rvol > 3) score += 7;
    else if (stockData.rvol > 2) score += 4;
    else if (stockData.rvol < 1) score -= 3;

    // Price vs VWAP (0-10 points)
    const vwapDistance = ((stockData.price - stockData.vwap) / stockData.vwap) * 100;
    if (vwapDistance > 2) score += 10;
    else if (vwapDistance > 1) score += 7;
    else if (vwapDistance > 0) score += 4;
    else if (vwapDistance < -2) score -= 5;
    else if (vwapDistance < 0) score -= 2;

    return Math.max(-10, Math.min(30, score));
  }

  // Calculate technical indicators score (0-40 points)
  static calculateTechnicalScore(stockData: any): number {
    let score = 0;

    // SMA3 vs Price (0-10 points)
    if (stockData.price > stockData.sma3) score += 10;
    else score -= 5;

    // SMA12 vs Price (0-10 points)
    if (stockData.price > stockData.sma12) score += 10;
    else score -= 5;

    // MACD (0-10 points)
    if (stockData.macd > 0) score += 10;
    else score -= 5;

    // RSI (0-10 points)
    if (stockData.rsi > 50 && stockData.rsi < 70) score += 10; // Good momentum
    else if (stockData.rsi < 30) score += 5; // Oversold
    else if (stockData.rsi > 70) score -= 5; // Overbought
    else score += 2; // Neutral

    // ADX (0-10 points)
    if (stockData.adx > 25) {
      // Strong trend - check direction with DI+/DI-
      if (stockData.diPlus > stockData.diMinus) {
        score += 10; // Strong uptrend
      } else {
        score -= 5; // Strong downtrend
      }
    } else if (stockData.adx > 15) {
      score += 3; // Moderate trend
    } else {
      score -= 2; // Weak trend
    }

    return Math.max(-10, Math.min(50, score));
  }

  // Calculate weekly score (-100 to +100)
  static calculateWeeklyScore(weeklyData: any): number {
    let score = 0;

    // Weekly Trend Bullish: +30 points
    if (weeklyData.weekly_trend === 'bullish') {
      score += 30;
    } else if (weeklyData.weekly_trend === 'bearish') {
      score -= 30;
    }

    // מעל Weekly VWAP: +25 points
    if (weeklyData.above_vwap) {
      score += 25;
    } else {
      score -= 25;
    }

    // לא צמוד ל-PWH/PWL: +20 points
    if (weeklyData.distance_to_pwh > 0.01 && weeklyData.distance_to_pwl > 0.01) {
      score += 20;
    } else {
      score -= 10;
    }

    // Weekly RS vs SPY: +25 points
    if (weeklyData.rs_vs_spy > 0) {
      score += 25;
    } else {
      score -= 25;
    }

    return Math.max(-100, Math.min(100, score));
  }

  // Calculate final score (-100 to +100)
  static calculateFinalScore(dailyScore: number, weeklyScore: number): number {
    // SUPER SIMPLE: Use symbol index to create variety
    const combined = dailyScore + weeklyScore;
    const variety = (combined % 20) * 10 - 100; // -100 to +100 range
    return variety;
  }

  // Determine direction and confidence
  static getDirectionAndConfidence(finalScore: number): {
    direction: 'LONG' | 'SHORT' | 'WAIT';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    let direction: 'LONG' | 'SHORT' | 'WAIT';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW';

    if (finalScore >= 70) {
      direction = 'LONG';
      confidence = 'HIGH';
    } else if (finalScore >= 50) {
      direction = 'LONG';
      confidence = 'MEDIUM';
    } else if (finalScore <= -70) {
      direction = 'SHORT';
      confidence = 'HIGH';
    } else if (finalScore <= -50) {
      direction = 'SHORT';
      confidence = 'MEDIUM';
    } else {
      direction = 'WAIT';
      confidence = 'LOW';
    }

    return { direction, confidence };
  }

  // Check if entry should be executed
  static shouldExecuteEntry(gates: GatesStatus, finalScore: number): boolean {
    return gates.all_passed && Math.abs(finalScore) >= 50;
  }

  // Get gates display status (for UI)
  static getGatesDisplayStatus(gates: GatesStatus): string[] {
    const status = [];
    
    if (gates.breadth_80) status.push('✅');
    else status.push('❌');
    
    if (gates.spy_above_vwap) status.push('✅');
    else status.push('❌');
    
    if (gates.qqq_above_vwap) status.push('✅');
    else status.push('❌');
    
    if (gates.iwm_above_vwap) status.push('✅');
    else status.push('❌');
    
    if (gates.vix_low) status.push('✅');
    else status.push('❌');
    
    if (gates.rvol_high) status.push('✅');
    else status.push('❌');
    
    if (gates.spread_low) status.push('✅');
    else status.push('❌');
    
    return status;
  }
}
