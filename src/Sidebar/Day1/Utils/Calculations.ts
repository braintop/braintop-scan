// Calculations Utils
export class Calculations {
  // Calculate Relative Strength vs SPY
  static calculateRelativeStrength(stockChange: number, spyChange: number): number {
    return stockChange - spyChange;
  }

  // Calculate ATR (Average True Range)
  static calculateATR(high: number[], low: number[], close: number[], period: number = 14): number {
    if (high.length < period || low.length < period || close.length < period) {
      return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < high.length; i++) {
      const tr = Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      );
      trueRanges.push(tr);
    }

    const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    return atr;
  }

  // Calculate SMA (Simple Moving Average)
  static calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    
    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((sum, price) => sum + price, 0) / period;
  }

  // Calculate MACD
  static calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    if (prices.length < 26) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Simplified signal line (9-period EMA of MACD)
    const signal = this.calculateEMA([macd], 9);
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  // Calculate EMA (Exponential Moving Average)
  static calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  // Calculate RSI
  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  // Calculate ADX with DI+ and DI-
  static calculateADX(high: number[], low: number[], close: number[], period: number = 14): { adx: number; diPlus: number; diMinus: number } {
    if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) {
      return { adx: 0, diPlus: 0, diMinus: 0 };
    }

    const dmPlus: number[] = [];
    const dmMinus: number[] = [];
    const trueRanges: number[] = [];

    // Calculate DM+ and DM- and True Range
    for (let i = 1; i < high.length; i++) {
      const highDiff = high[i] - high[i - 1];
      const lowDiff = low[i - 1] - low[i];
      
      dmPlus.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      dmMinus.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
      
      const tr = Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      );
      trueRanges.push(tr);
    }

    // Calculate smoothed values
    const smoothedDMPlus = this.calculateSmoothedAverage(dmPlus, period);
    const smoothedDMMinus = this.calculateSmoothedAverage(dmMinus, period);
    const smoothedTR = this.calculateSmoothedAverage(trueRanges, period);

    // Calculate DI+ and DI-
    const diPlus = smoothedTR > 0 ? (smoothedDMPlus / smoothedTR) * 100 : 0;
    const diMinus = smoothedTR > 0 ? (smoothedDMMinus / smoothedTR) * 100 : 0;

    // Calculate DX
    const dx = (diPlus + diMinus) > 0 ? Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100 : 0;

    // Calculate ADX (smoothed DX)
    const adx = dx; // Simplified - in real implementation, this would be smoothed over multiple periods

    return {
      adx: Math.round(adx),
      diPlus: Math.round(diPlus),
      diMinus: Math.round(diMinus)
    };
  }

  // Helper function for smoothed average
  private static calculateSmoothedAverage(values: number[], period: number): number {
    if (values.length < period) return 0;
    
    // Simple average for now - could be Wilder's smoothing in real implementation
    const recentValues = values.slice(-period);
    return recentValues.reduce((sum, val) => sum + val, 0) / period;
  }

  // Calculate VWAP (Volume Weighted Average Price)
  static calculateVWAP(prices: number[], volumes: number[]): number {
    if (prices.length !== volumes.length || prices.length === 0) return 0;

    let totalVolume = 0;
    let totalPriceVolume = 0;

    for (let i = 0; i < prices.length; i++) {
      totalPriceVolume += prices[i] * volumes[i];
      totalVolume += volumes[i];
    }

    return totalVolume > 0 ? totalPriceVolume / totalVolume : 0;
  }

  // Calculate RVOL (Relative Volume)
  static calculateRVOL(currentVolume: number, averageVolume: number): number {
    return averageVolume > 0 ? currentVolume / averageVolume : 0;
  }

  // Calculate Gap percentage
  static calculateGap(currentPrice: number, previousClose: number): number {
    return previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
  }

  // Calculate Support/Resistance levels
  static calculateSupportResistance(high: number[], low: number[], close: number[]): {
    support: number;
    resistance: number;
    pivot: number;
  } {
    if (high.length === 0 || low.length === 0 || close.length === 0) {
      return { support: 0, resistance: 0, pivot: 0 };
    }

    const recentHigh = Math.max(...high.slice(-20));
    const recentLow = Math.min(...low.slice(-20));
    const recentClose = close[close.length - 1];

    const pivot = (recentHigh + recentLow + recentClose) / 3;
    const support = 2 * pivot - recentHigh;
    const resistance = 2 * pivot - recentLow;

    return { support, resistance, pivot };
  }
}
