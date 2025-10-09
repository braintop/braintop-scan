// Polygon Service - שימוש ב-polygonApi.ts הקיים
import { 
  getTickerDetails,
  getHistoricalData,
  getPreviousClose,
  getSnapshot,
  getMarketStatus,
  getSMA,
  getEMA,
  getMACD,
  getRSI
} from '../../../Api/polygonApi';

export class PolygonService {
  // Daily data for all symbols - get last 20 days for indicators
  static async getDailyData(symbol: string) {
    try {
      const to = new Date().toISOString().split('T')[0];
      const from = new Date(new Date().getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const data = await getHistoricalData(symbol, from, to, 'day', 1);
      return data;
    } catch (error) {
      console.error(`Error fetching daily data for ${symbol}:`, error);
      return null;
    }
  }

  // Intraday data (1-5 minute candles)
  static async getIntradayData(symbol: string, from: string, to: string) {
    try {
      const data = await getHistoricalData(symbol, from, to, 'minute', 1);
      return data;
    } catch (error) {
      console.error(`Error fetching intraday data for ${symbol}:`, error);
      return null;
    }
  }

  // Market data (SPY, QQQ, IWM, VIX)
  static async getMarketData() {
    try {
      const [spy, qqq, iwm, vix] = await Promise.all([
        getPreviousClose('SPY'),
        getPreviousClose('QQQ'),
        getPreviousClose('IWM'),
        getPreviousClose('VIX')
      ]);

      return {
        spy,
        qqq,
        iwm,
        vix
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      return null;
    }
  }

  // Weekly data
  static async getWeeklyData(symbol: string) {
    try {
      // Calculate date range for last week
      const to = new Date();
      const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const data = await getHistoricalData(
        symbol, 
        from.toISOString().split('T')[0], 
        to.toISOString().split('T')[0],
        'week',
        1
      );
      
      return data;
    } catch (error) {
      console.error(`Error fetching weekly data for ${symbol}:`, error);
      return null;
    }
  }

  // Premarket data
  static async getPremarketData(symbol: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await getHistoricalData(symbol, `${today} 04:00:00`, `${today} 16:30:00`, 'minute', 1);
      return data;
    } catch (error) {
      console.error(`Error fetching premarket data for ${symbol}:`, error);
      return null;
    }
  }

  // Market status
  static async getMarketStatus() {
    try {
      const status = await getMarketStatus();
      return status;
    } catch (error) {
      console.error('Error fetching market status:', error);
      return null;
    }
  }

  // Technical Indicators - SMA
  static async getSMA(symbol: string, window: number = 20) {
    try {
      const data = await getSMA(symbol, window, 'day');
      return data;
    } catch (error) {
      console.error(`Error fetching SMA for ${symbol}:`, error);
      return null;
    }
  }

  // Technical Indicators - EMA
  static async getEMA(symbol: string, window: number = 12) {
    try {
      const data = await getEMA(symbol, window, 'day');
      return data;
    } catch (error) {
      console.error(`Error fetching EMA for ${symbol}:`, error);
      return null;
    }
  }

  // Technical Indicators - MACD
  static async getMACD(symbol: string) {
    try {
      const data = await getMACD(symbol, 12, 26, 9, 'day');
      return data;
    } catch (error) {
      console.error(`Error fetching MACD for ${symbol}:`, error);
      return null;
    }
  }

  // Technical Indicators - RSI
  static async getRSI(symbol: string, window: number = 14) {
    try {
      const data = await getRSI(symbol, window, 'day');
      return data;
    } catch (error) {
      console.error(`Error fetching RSI for ${symbol}:`, error);
      return null;
    }
  }
}
