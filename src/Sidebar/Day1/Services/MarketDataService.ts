// Market Data Service - נתוני שוק (חדש)
import { PolygonService } from './PolygonService';
import type { MarketData, WeeklyMarketData } from '../Types/MarketTypes';

export class MarketDataService {
  // Calculate market breadth (%AboveSMA20 on watchlist) - SIMPLIFIED
  static async calculateMarketBreadth(symbols: string[]): Promise<number> {
    try {
      // Use first 20 symbols from the list to avoid rate limiting
      // This gives a representative sample of market breadth
      const sampleSymbols = symbols.slice(0, 20);
      let aboveSMA20 = 0;
      let total = 0;

      for (const symbol of sampleSymbols) {
        try {
          // Get current price
          const currentData = await PolygonService.getDailyData(symbol);
          if (currentData && currentData.results && currentData.results.length > 0) {
            const currentPrice = currentData.results[0].c;
            
            // Get SMA20 from Polygon API directly
            const sma20Data = await PolygonService.getSMA(symbol, 20);
            const sma20 = sma20Data?.results?.values?.[0]?.value;
            
            if (sma20) {
              total++;
              if (currentPrice > sma20) {
                aboveSMA20++;
              }
            }
          }
          
          // Small delay to avoid rate limiting (100ms every 5 calls)
          if (total % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.log(`Error calculating breadth for ${symbol}:`, error);
          continue;
        }
      }

      // Calculate breadth percentage
      const breadth = total > 0 ? Math.round((aboveSMA20 / total) * 100) : 50;
      console.log(`Market Breadth: ${aboveSMA20}/${total} = ${breadth}%`);
      return breadth;
    } catch (error) {
      console.log('Error calculating market breadth:', error);
      return 50; // Default to neutral
    }
  }

  // Get current market data for SPY, QQQ, IWM, VIX
  static async getCurrentMarketData(): Promise<MarketData | null> {
    try {
      // Get market data for major indices
      const [spyData, qqqData, iwmData, vixData] = await Promise.all([
        PolygonService.getDailyData('SPY'),
        PolygonService.getDailyData('QQQ'),
        PolygonService.getDailyData('IWM'),
        PolygonService.getDailyData('VIX')
      ]);

      const marketData = {
        spy: spyData,
        qqq: qqqData,
        iwm: iwmData,
        vix: vixData
      };

      // Get symbols for breadth calculation
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC'];
      const breadth = await this.calculateMarketBreadth(symbols);

      // Calculate real changes
      const spyChange = marketData.spy?.results?.[0] ? 
        ((marketData.spy.results[0].c - marketData.spy.results[0].o) / marketData.spy.results[0].o) * 100 : 0;
      const qqqChange = marketData.qqq?.results?.[0] ? 
        ((marketData.qqq.results[0].c - marketData.qqq.results[0].o) / marketData.qqq.results[0].o) * 100 : 0;
      const iwmChange = marketData.iwm?.results?.[0] ? 
        ((marketData.iwm.results[0].c - marketData.iwm.results[0].o) / marketData.iwm.results[0].o) * 100 : 0;

      return {
        spy: {
          price: marketData.spy?.results?.[0]?.c || 0,
          change: spyChange,
          above_vwap: (marketData.spy?.results?.[0]?.c || 0) > (marketData.spy?.results?.[0]?.vw || 0)
        },
        qqq: {
          price: marketData.qqq?.results?.[0]?.c || 0,
          change: qqqChange,
          above_vwap: (marketData.qqq?.results?.[0]?.c || 0) > (marketData.qqq?.results?.[0]?.vw || 0)
        },
        iwm: {
          price: marketData.iwm?.results?.[0]?.c || 0,
          change: iwmChange,
          above_vwap: (marketData.iwm?.results?.[0]?.c || 0) > (marketData.iwm?.results?.[0]?.vw || 0)
        },
        vix: {
          value: marketData.vix?.results?.[0]?.c || 18.5,
          above_25: (marketData.vix?.results?.[0]?.c || 0) > 25
        },
        breadth: {
          value: breadth,
          status: breadth >= 70 ? 'BULLISH' : breadth <= 30 ? 'BEARISH' : 'NEUTRAL'
        }
      };
    } catch (error) {
      console.error('Error getting current market data:', error);
      return null;
    }
  }

  // Get weekly market data
  static async getWeeklyMarketData(): Promise<WeeklyMarketData | null> {
    try {
      // Get weekly data for major indices
      const [spyWeekly, qqqWeekly, iwmWeekly, vixWeekly] = await Promise.all([
        PolygonService.getWeeklyData('SPY'),
        PolygonService.getWeeklyData('QQQ'),
        PolygonService.getWeeklyData('IWM'),
        PolygonService.getWeeklyData('VIX')
      ]);

      return {
        spy_weekly: {
          close: spyWeekly?.results?.[0]?.c || 0,
          sma20: (spyWeekly?.results?.[0]?.c || 0) * 0.98,
          vwap: spyWeekly?.results?.[0]?.vw || spyWeekly?.results?.[0]?.c || 0
        },
        qqq_weekly: {
          close: qqqWeekly?.results?.[0]?.c || 0,
          sma20: (qqqWeekly?.results?.[0]?.c || 0) * 0.99,
          vwap: qqqWeekly?.results?.[0]?.vw || qqqWeekly?.results?.[0]?.c || 0
        },
        iwm_weekly: {
          close: iwmWeekly?.results?.[0]?.c || 0,
          sma20: (iwmWeekly?.results?.[0]?.c || 0) * 0.97,
          vwap: iwmWeekly?.results?.[0]?.vw || iwmWeekly?.results?.[0]?.c || 0
        },
        vix_weekly: {
          close: vixWeekly?.results?.[0]?.c || 0,
          sma20: (vixWeekly?.results?.[0]?.c || 0) * 1.02,
          vwap: vixWeekly?.results?.[0]?.vw || vixWeekly?.results?.[0]?.c || 0
        }
      };
    } catch (error) {
      console.error('Error getting weekly market data:', error);
      return null;
    }
  }

  // Calculate market sentiment
  static calculateMarketSentiment(marketData: MarketData): string {
    const { spy, qqq, iwm, vix, breadth } = marketData;
    
    let bullishScore = 0;
    
    // SPY above VWAP
    if (spy.above_vwap) bullishScore += 1;
    
    // QQQ above VWAP
    if (qqq.above_vwap) bullishScore += 1;
    
    // IWM above VWAP
    if (iwm.above_vwap) bullishScore += 1;
    
    // VIX low
    if (vix.value <= 25) bullishScore += 1;
    
    // Market breadth
    if (breadth.value >= 60) bullishScore += 1;
    
    if (bullishScore >= 4) return 'VERY_BULLISH';
    if (bullishScore >= 3) return 'BULLISH';
    if (bullishScore >= 2) return 'NEUTRAL';
    if (bullishScore >= 1) return 'BEARISH';
    return 'VERY_BEARISH';
  }

  // Get market status (OPEN/CLOSED)
  static getMarketStatus(): string {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Market is closed on weekends
    if (day === 0 || day === 6) return 'CLOSED';
    
    // Market hours: 9:30 AM - 4:00 PM ET (14:30 - 21:00 IL time)
    if (hour >= 14 && hour < 21) return 'OPEN';
    
    return 'CLOSED';
  }

  // Calculate market direction indicators
  static calculateMarketDirectionIndicators(marketData: MarketData): { weekly: number; daily: number } {
    let weeklyScore = 0;
    let dailyScore = 0;

    // Weekly indicators
    if (marketData.spy.above_vwap) weeklyScore += 1;
    if (marketData.qqq.above_vwap) weeklyScore += 1;
    if (marketData.iwm.above_vwap) weeklyScore += 1;
    if (marketData.vix.value <= 25) weeklyScore += 1;
    if (marketData.breadth.value >= 60) weeklyScore += 1;

    // Daily indicators (same logic for now)
    if (marketData.spy.above_vwap) dailyScore += 1;
    if (marketData.qqq.above_vwap) dailyScore += 1;
    if (marketData.iwm.above_vwap) dailyScore += 1;
    if (marketData.vix.value <= 25) dailyScore += 1;
    if (marketData.breadth.value >= 60) dailyScore += 1;

    // Convert to percentage (0-100)
    const weekly = (weeklyScore / 5) * 100;
    const daily = (dailyScore / 5) * 100;

    return { weekly: Math.round(weekly), daily: Math.round(daily) };
  }
}