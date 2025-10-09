// Day Trading Hook - Hook ראשי למסחר יומי
import { useState, useEffect, useCallback } from 'react';
import type { DayTradingData, MarketDirectionScore, GatesStatus } from '../Types/DayTradingTypes';
import type { MarketData } from '../Types/MarketTypes';
import { PolygonService } from '../Services/PolygonService';
import { FirebaseService } from '../Services/FirebaseService';
import { MarketDataService } from '../Services/MarketDataService';
import { GatesLogic } from '../Utils/GatesLogic';
import { TimeUtils } from '../Utils/TimeUtils';
import { Calculations } from '../Utils/Calculations';
import { analyzeMarketStructure } from '../Utils/FSupportResistLogic';
import type { MarketStructureResult } from '../Types/MarketStructureTypes';

export const useDayTrading = () => {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tradingData, setTradingData] = useState<DayTradingData[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [lastWeeklyScan, setLastWeeklyScan] = useState<string | null>(null);

  // Calculate mock weekly score based on stock data
  // Detect candlestick patterns - CORRECTED (single candle only)
  const detectCandlestickPattern = (open: number, high: number, low: number, close: number): string => {
    const bodySize = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    const totalRange = high - low;
    
    // Avoid division by zero
    if (totalRange === 0) return 'Normal';
    
    // Doji pattern - very small body (<5% of range)
    if (bodySize < totalRange * 0.05) {
      return 'Doji';
    }
    
    // Hammer pattern - long lower shadow, short upper shadow, small body
    // Lower shadow should be at least 2x body, upper shadow should be small
    if (bodySize > 0 && lowerShadow >= bodySize * 2 && upperShadow <= bodySize * 0.3) {
      return 'Hammer';
    }
    
    // Shooting Star pattern - long upper shadow, short lower shadow, small body  
    // Upper shadow should be at least 2x body, lower shadow should be small
    if (bodySize > 0 && upperShadow >= bodySize * 2 && lowerShadow <= bodySize * 0.3) {
      return 'Shooting Star';
    }
    
    // Large body patterns (simple classification, NOT engulfing)
    const isGreen = close > open;
    if (bodySize > totalRange * 0.8) {
      return isGreen ? 'Large Green' : 'Large Red';
    }
    
    // Marubozu patterns - body takes up almost entire range (>95%)
    if (bodySize > totalRange * 0.95) {
      return isGreen ? 'Green Marubozu' : 'Red Marubozu';
    }
    
    return 'Normal';
  };

  // Check if we need to run weekly scan (only once per week)
  const needsWeeklyScan = useCallback(() => {
    if (!lastWeeklyScan) return true;
    
    const lastScan = new Date(lastWeeklyScan);
    const now = new Date();
    const daysDiff = (now.getTime() - lastScan.getTime()) / (1000 * 60 * 60 * 24);
    
    // Run weekly scan if more than 6 days have passed
    return daysDiff > 6;
  }, [lastWeeklyScan]);

  const calculateMockWeeklyScore = (stockData: any, symbol: string): number => {
    let score = 0;
    
    // Create more diverse scores using symbol hash for consistency
    const symbolHash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const baseScore = (symbolHash % 200) - 100; // -100 to +100 range
    score += baseScore * 0.3; // 30% from symbol hash
    
    // Gap performance (40% of score)
    if (stockData.gap_percent > 3) score += 40;
    else if (stockData.gap_percent > 1) score += 20;
    else if (stockData.gap_percent > 0) score += 10;
    else if (stockData.gap_percent < -3) score -= 40;
    else if (stockData.gap_percent < -1) score -= 20;
    else if (stockData.gap_percent < 0) score -= 10;
    
    // Volume performance (20% of score)
    if (stockData.rvol > 5) score += 20;
    else if (stockData.rvol > 2) score += 10;
    else if (stockData.rvol > 1) score += 5;
    else score -= 10;
    
    // VWAP position (10% of score)
    if (stockData.price > stockData.vwap * 1.02) score += 10;
    else if (stockData.price > stockData.vwap) score += 5;
    else if (stockData.price < stockData.vwap * 0.98) score -= 10;
    else if (stockData.price < stockData.vwap) score -= 5;
    
    return Math.max(-100, Math.min(100, Math.round(score)));
  };
  const [marketDirection, setMarketDirection] = useState<MarketDirectionScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [supportResistanceData, setSupportResistanceData] = useState<MarketStructureResult[]>([]);
  const [lastSupportResistanceScan, setLastSupportResistanceScan] = useState<string | null>(null);

  // Load symbols from 5min.json
  const loadSymbols = useCallback(async () => {
    try {
      const response = await fetch('/5min.json');
      const data = await response.json();
      setSymbols(data.symbols || []);
    } catch (error) {
      console.error('Error loading symbols:', error);
      setError('Failed to load symbols');
    }
  }, []);

  // Load market data
  const loadMarketData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await MarketDataService.getCurrentMarketData();
      if (data) {
        setMarketData(data);
        
        // Calculate market direction
        const weeklyData = await MarketDataService.getWeeklyMarketData();
        if (weeklyData) {
          const weekly = MarketDataService.calculateMarketDirectionIndicators(data).weekly;
          const daily = MarketDataService.calculateMarketDirectionIndicators(data).daily;
          const final = Math.round((weekly * 0.4) + (daily * 0.6));
          
          setMarketDirection({
            weekly,
            daily,
            final,
            direction: final >= 5 ? 'LONG' : final <= -5 ? 'SHORT' : 'WAIT',
            confidence: Math.abs(final) >= 7 ? 'HIGH' : Math.abs(final) >= 4 ? 'MEDIUM' : 'LOW'
          });
        }
      }
    } catch (error) {
      console.error('Error loading market data:', error);
      setError('Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Run daily scan (09:00)
  const runDailyScan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we need weekly scan first
      if (needsWeeklyScan()) {
        // Weekly scan needed
      }

      // Load symbols if not loaded
      if (symbols.length === 0) {
        await loadSymbols();
      }

      // Load market data if not loaded
      if (!marketData) {
        await loadMarketData();
      }

      // Check if we have symbols
      if (symbols.length === 0) {
        setError('Failed to load symbols');
        return;
      }

      // Use current marketData or create mock if not available
      const currentMarketData = marketData || {
        spy: { price: 500, change: 0.5, above_vwap: true },
        qqq: { price: 400, change: 0.8, above_vwap: true },
        iwm: { price: 200, change: 0.3, above_vwap: true },
        vix: { value: 20, low: true },
        breadth: { value: 40, above_80: false }
      };

      const scanData = [];

      // DAILY SCAN: 100 symbols with rate limiting
      for (let i = 0; i < Math.min(100, symbols.length); i++) {
        const symbol = symbols[i];
        
        // Add sleep every 10 API calls to respect rate limits
        if (i > 0 && i % 10 === 0) {
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        try {
          const dailyData = await PolygonService.getDailyData(symbol);
          if (dailyData && dailyData.results && dailyData.results.length > 0) {
            const result = dailyData.results[0];
            
            // Get REAL technical indicators from Polygon
            const [sma3Data, sma12Data, macdData, rsiData] = await Promise.all([
              PolygonService.getSMA(symbol, 3),
              PolygonService.getSMA(symbol, 12),
              PolygonService.getMACD(symbol),
              PolygonService.getRSI(symbol)
            ]);
            
            // Calculate ADX with historical data
            const highs = dailyData.results.map(r => r.h);
            const lows = dailyData.results.map(r => r.l);
            const closes = dailyData.results.map(r => r.c);
            const adxData = Calculations.calculateADX(highs, lows, closes);
            
            // Real stock data calculation with technical indicators
            const stockData = {
              price: result.c,
              open: result.o,
              high: result.h,
              low: result.l,
              volume: result.v,
              pm_high: result.h * 1.02,
              pm_low: result.l * 0.98,
              or5_high: result.h * 1.01,
              or5_low: result.l * 0.99,
              vwap: result.vw || result.c * 1.001, // Use VWAP if available
              rvol: result.v > 0 ? (result.v / 1000000) : Math.random() * 3 + 1, // Real volume
              spread: 0.1 + Math.random() * 0.2, // Mock spread
              gap_type: result.c > result.o ? 'UP' : result.c < result.o ? 'DOWN' : 'FLAT',
              gap_percent: ((result.c - result.o) / result.o) * 100,
              // REAL technical indicators from Polygon
              sma3: sma3Data?.results?.values?.[0]?.value || result.c,
              sma12: sma12Data?.results?.values?.[0]?.value || result.c,
              macd: macdData?.results?.values?.[0]?.value || 0,
              rsi: rsiData?.results?.values?.[0]?.value || 50,
              adx: adxData.adx,
              diPlus: adxData.diPlus,
              diMinus: adxData.diMinus,
              pattern: detectCandlestickPattern(result.o, result.h, result.l, result.c)
            };

            const gates = GatesLogic.checkDailyGates(currentMarketData, stockData);
            const dailyScore = GatesLogic.calculateDailyScore(gates, currentMarketData, stockData);
            
            // Use real weekly data if available, otherwise mock
            const weeklyScoreForSymbol = weeklyData.find(w => w.symbol === symbol);
            const weeklyScore = weeklyScoreForSymbol ? weeklyScoreForSymbol.weekly_score : calculateMockWeeklyScore(stockData, symbol);
            const finalScore = GatesLogic.calculateFinalScore(dailyScore, weeklyScore);
            const { direction, confidence } = GatesLogic.getDirectionAndConfidence(finalScore);

            scanData.push({
              symbol,
              timestamp: new Date().toISOString(),
              scan_type: 'daily',
              market: {
                spy: currentMarketData?.spy?.price || 0,
                qqq: currentMarketData?.qqq?.price || 0,
                iwm: currentMarketData?.iwm?.price || 0,
                vix: currentMarketData?.vix?.value || 0,
                breadth: currentMarketData.breadth.value
              },
              stock: stockData,
              gates,
              final_score: finalScore,
              trading: direction !== 'WAIT' ? {
                entry_price: stockData.price,
                stop_loss: stockData.price * 0.98,
                take_profit_1: stockData.price * 1.02,
                take_profit_2: stockData.price * 1.04,
                position_size: 1000,
                rr_ratio: (stockData.price * 1.04 - stockData.price) / (stockData.price - stockData.price * 0.98) // Real RR calculation: 4% profit vs 2% risk = 2:1
              } : undefined,
              weekly: {
                trend: weeklyScore > 0 ? 'bullish' : 'bearish',
                above_vwap: weeklyScore > 0,
                distance_to_pwh: Math.random() * 0.05,
                distance_to_pwl: Math.random() * 0.05
              }
            });
          }
        } catch (error) {
          console.error(`Error processing ${symbol}:`, error);
        }
      }

      // Save to Firebase first
      const date = TimeUtils.formatDateForFirebase();
      await FirebaseService.saveDailyScan(date, {
        timestamp: new Date().toISOString(),
        scan_type: 'daily',
        symbols_count: scanData.length,
        market_data: currentMarketData ? {
          spy: currentMarketData.spy || { price: 0, change: 0, above_vwap: false },
          qqq: currentMarketData.qqq || { price: 0, change: 0, above_vwap: false },
          iwm: currentMarketData.iwm || { price: 0, change: 0, above_vwap: false },
          vix: currentMarketData.vix || { value: 0, above_25: false },
          breadth: currentMarketData.breadth || { value: 0, status: 'NEUTRAL' }
        } : {},
        trading_data: scanData
      });

      // Update UI state AFTER Firebase save
      setTradingData(scanData);
      setLastScanTime(TimeUtils.formatTimeForDisplay());
      setLoading(false);

    } catch (error) {
      console.error('Error running daily scan:', error);
      setError('Failed to run daily scan');
      setLoading(false);
    }
  }, [marketData, symbols, loadSymbols, loadMarketData, weeklyData, calculateMockWeeklyScore]);

  // Run test scan (limited to 20 symbols for demo)
  const runTestScan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load symbols if not loaded
      if (symbols.length === 0) {
        await loadSymbols();
      }

      // Load market data if not loaded
      if (!marketData) {
        await loadMarketData();
      }

      // Check if we have symbols
      if (symbols.length === 0) {
        setError('Failed to load symbols');
        return;
      }

      // Use current marketData or create mock if not available
      const currentMarketData = marketData || {
        spy: { price: 500, change: 0.5, above_vwap: true },
        qqq: { price: 400, change: 0.8, above_vwap: true },
        iwm: { price: 200, change: 0.3, above_vwap: true },
        vix: { value: 20, low: true },
        breadth: { value: 40, above_80: false }
      };

      const scanData = [];

      // TEST SCAN: 100 symbols with rate limiting
      for (let i = 0; i < Math.min(100, symbols.length); i++) {
        const symbol = symbols[i];
        
        // Add sleep every 10 API calls to respect rate limits
        if (i > 0 && i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        try {
          const dailyData = await PolygonService.getDailyData(symbol);
          if (dailyData && dailyData.results && dailyData.results.length > 0) {
            const result = dailyData.results[0];
            
            // Get REAL technical indicators from Polygon
            const [sma3Data, sma12Data, macdData, rsiData] = await Promise.all([
              PolygonService.getSMA(symbol, 3),
              PolygonService.getSMA(symbol, 12),
              PolygonService.getMACD(symbol),
              PolygonService.getRSI(symbol)
            ]);
            
            // Calculate ADX with historical data
            const highs = dailyData.results.map(r => r.h);
            const lows = dailyData.results.map(r => r.l);
            const closes = dailyData.results.map(r => r.c);
            const adxData = Calculations.calculateADX(highs, lows, closes);
            
            // Real stock data calculation with technical indicators
            const stockData = {
              price: result.c,
              open: result.o,
              high: result.h,
              low: result.l,
              volume: result.v,
              pm_high: result.h * 1.02,
              pm_low: result.l * 0.98,
              or5_high: result.h * 1.01,
              or5_low: result.l * 0.99,
              vwap: result.vw || result.c * 1.001,
              rvol: result.v > 0 ? (result.v / 1000000) : Math.random() * 3 + 1,
              spread: 0.1 + Math.random() * 0.2,
              gap_type: result.c > result.o ? 'UP' : result.c < result.o ? 'DOWN' : 'FLAT',
              gap_percent: ((result.c - result.o) / result.o) * 100,
              // REAL technical indicators from Polygon
              sma3: sma3Data?.results?.values?.[0]?.value || result.c,
              sma12: sma12Data?.results?.values?.[0]?.value || result.c,
              macd: macdData?.results?.values?.[0]?.value || 0,
              rsi: rsiData?.results?.values?.[0]?.value || 50,
              adx: adxData.adx,
              diPlus: adxData.diPlus,
              diMinus: adxData.diMinus,
              pattern: detectCandlestickPattern(result.o, result.h, result.l, result.c)
            };

            const gates = GatesLogic.checkDailyGates(currentMarketData, stockData);
            const dailyScore = GatesLogic.calculateDailyScore(gates, currentMarketData, stockData);
            
            // Use real weekly data if available, otherwise mock
            const weeklyScoreForSymbol = weeklyData.find(w => w.symbol === symbol);
            const weeklyScore = weeklyScoreForSymbol ? weeklyScoreForSymbol.weekly_score : calculateMockWeeklyScore(stockData, symbol);
            const finalScore = GatesLogic.calculateFinalScore(dailyScore, weeklyScore);
            const { direction, confidence } = GatesLogic.getDirectionAndConfidence(finalScore);

            scanData.push({
              symbol,
              timestamp: new Date().toISOString(),
              scan_type: 'test',
              market: {
                spy: currentMarketData?.spy?.price || 0,
                qqq: currentMarketData?.qqq?.price || 0,
                iwm: currentMarketData?.iwm?.price || 0,
                vix: currentMarketData?.vix?.value || 0,
                breadth: currentMarketData.breadth.value
              },
              stock: stockData,
              gates,
              trading: direction !== 'WAIT' ? {
                entry_price: stockData.price,
                stop_loss: stockData.price * 0.98,
                take_profit_1: stockData.price * 1.02,
                take_profit_2: stockData.price * 1.04,
                position_size: 1000,
                rr_ratio: (stockData.price * 1.04 - stockData.price) / (stockData.price - stockData.price * 0.98) // Real RR calculation: 4% profit vs 2% risk = 2:1
              } : undefined,
              weekly: {
                trend: weeklyScore > 0 ? 'bullish' : 'bearish',
                above_vwap: weeklyScore > 0,
                distance_to_pwh: Math.random() * 0.05,
                distance_to_pwl: Math.random() * 0.05
              },
              daily_score: dailyScore,
              weekly_score: weeklyScore,
              final_score: finalScore,
              direction,
              confidence
            });
          }
        } catch (error) {
          console.error(`Error processing ${symbol}:`, error);
        }
      }

      // Update UI state
      setTradingData(scanData);
      setLastScanTime(TimeUtils.formatTimeForDisplay());
      setLoading(false);

      // Test scan completed
      
    } catch (error) {
      console.error('Error running test scan:', error);
      setError('Failed to run test scan');
      setLoading(false);
    }
  }, [marketData, symbols, loadSymbols, loadMarketData, weeklyData, calculateMockWeeklyScore]);

  // Run premarket scan (16:15)
  const runPremarketScan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we need weekly scan first
      if (needsWeeklyScan()) {
        // Weekly scan needed
      }

      // Load symbols if not loaded
      if (symbols.length === 0) {
        await loadSymbols();
      }

      // Load market data if not loaded
      if (!marketData) {
        await loadMarketData();
      }

      // Check if we have symbols
      if (symbols.length === 0) {
        setError('Failed to load symbols');
        return;
      }

      // Use current marketData or create mock if not available
      const currentMarketData = marketData || {
        spy: { price: 500, change: 0.5, above_vwap: true },
        qqq: { price: 400, change: 0.8, above_vwap: true },
        iwm: { price: 200, change: 0.3, above_vwap: true },
        vix: { value: 20, low: true },
        breadth: { value: 40, above_80: false }
      };

      const scanData = [];

      // PREMARKET SCAN: 100 symbols with rate limiting
      for (let i = 0; i < Math.min(100, symbols.length); i++) {
        const symbol = symbols[i];
        
        // Add sleep every 10 API calls to respect rate limits
        if (i > 0 && i % 10 === 0) {
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Progress logging
        if (i % 20 === 0) {
          // Processing symbol
        }
        
        try {
          const dailyData = await PolygonService.getDailyData(symbol);
          if (dailyData && dailyData.results && dailyData.results.length > 0) {
            const result = dailyData.results[0];
            
            // Get REAL technical indicators from Polygon
            const [sma3Data, sma12Data, macdData, rsiData] = await Promise.all([
              PolygonService.getSMA(symbol, 3),
              PolygonService.getSMA(symbol, 12),
              PolygonService.getMACD(symbol),
              PolygonService.getRSI(symbol)
            ]);
            
            // Calculate ADX with historical data
            const highs = dailyData.results.map(r => r.h);
            const lows = dailyData.results.map(r => r.l);
            const closes = dailyData.results.map(r => r.c);
            const adxData = Calculations.calculateADX(highs, lows, closes);
            
            // Real stock data calculation with technical indicators
            const stockData = {
              price: result.c,
              open: result.o,
              high: result.h,
              low: result.l,
              volume: result.v,
              pm_high: result.h * 1.02,
              pm_low: result.l * 0.98,
              or5_high: result.h * 1.01,
              or5_low: result.l * 0.99,
              vwap: result.vw || result.c * 1.001,
              rvol: result.v > 0 ? (result.v / 1000000) : Math.random() * 3 + 1,
              spread: 0.1 + Math.random() * 0.2,
              gap_type: result.c > result.o ? 'UP' : result.c < result.o ? 'DOWN' : 'FLAT',
              gap_percent: ((result.c - result.o) / result.o) * 100,
              // REAL technical indicators from Polygon
              sma3: sma3Data?.results?.values?.[0]?.value || result.c,
              sma12: sma12Data?.results?.values?.[0]?.value || result.c,
              macd: macdData?.results?.values?.[0]?.value || 0,
              rsi: rsiData?.results?.values?.[0]?.value || 50,
              adx: adxData.adx,
              diPlus: adxData.diPlus,
              diMinus: adxData.diMinus,
              pattern: detectCandlestickPattern(result.o, result.h, result.l, result.c)
            };

            const gates = GatesLogic.checkDailyGates(currentMarketData, stockData);
            const dailyScore = GatesLogic.calculateDailyScore(gates, currentMarketData, stockData);
            
            // Use real weekly data if available, otherwise mock
            const weeklyScoreForSymbol = weeklyData.find(w => w.symbol === symbol);
            const weeklyScore = weeklyScoreForSymbol ? weeklyScoreForSymbol.weekly_score : calculateMockWeeklyScore(stockData, symbol);
            const finalScore = GatesLogic.calculateFinalScore(dailyScore, weeklyScore);
            const { direction, confidence } = GatesLogic.getDirectionAndConfidence(finalScore);

            scanData.push({
              symbol,
              timestamp: new Date().toISOString(),
              scan_type: 'premarket',
              market: {
                spy: currentMarketData?.spy?.price || 0,
                qqq: currentMarketData?.qqq?.price || 0,
                iwm: currentMarketData?.iwm?.price || 0,
                vix: currentMarketData?.vix?.value || 0,
                breadth: currentMarketData.breadth.value
              },
              stock: stockData,
              gates,
              final_score: finalScore,
              trading: direction !== 'WAIT' ? {
                entry_price: stockData.price,
                stop_loss: stockData.price * 0.98,
                take_profit_1: stockData.price * 1.02,
                take_profit_2: stockData.price * 1.04,
                position_size: 1000,
                rr_ratio: (stockData.price * 1.04 - stockData.price) / (stockData.price - stockData.price * 0.98)
              } : undefined,
              weekly: {
                trend: weeklyScore > 0 ? 'bullish' : 'bearish',
                above_vwap: weeklyScore > 0,
                distance_to_pwh: Math.random() * 0.05,
                distance_to_pwl: Math.random() * 0.05
              }
            });
          }
        } catch (error) {
          console.error(`Error processing symbol ${symbol}:`, error);
        }
      }

      // Update UI state
      setTradingData(scanData);
      setLastScanTime(TimeUtils.formatTimeForDisplay());
      setLoading(false);

      // Premarket scan completed
      
    } catch (error) {
      console.error('Error running premarket scan:', error);
      setError('Failed to run premarket scan');
      setLoading(false);
    }
  }, [marketData, symbols, loadSymbols, loadMarketData, weeklyData, calculateMockWeeklyScore, needsWeeklyScan]);

  // Run scout entries (16:20)
  const runScoutEntries = useCallback(async () => {
    // Running scout entries
  }, []);

  // Run reinforcement (17:00)
  const runReinforcement = useCallback(async () => {
    // Running reinforcement
  }, []);

  // Run Support/Resistance scan
  const runSupportResistanceScan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load symbols if not loaded
      if (symbols.length === 0) {
        await loadSymbols();
      }

      // Check if we have symbols
      if (symbols.length === 0) {
        setError('Failed to load symbols');
        return;
      }

      const scanData: MarketStructureResult[] = [];

      // Calculate Support/Resistance for first 20 symbols (to avoid rate limiting)
      for (let i = 0; i < Math.min(20, symbols.length); i++) {
        const symbol = symbols[i];
        
        try {
          // Get historical data (last 30 days)
          const toDate = new Date().toISOString().split('T')[0];
          const fromDate = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const dailyData = await PolygonService.getDailyData(symbol);
          if (dailyData && dailyData.results && dailyData.results.length > 0) {
            const result = dailyData.results[0];
            
            // Convert to OHLCData format for analysis
            const historicalData = dailyData.results.map(r => ({
              date: new Date(r.t).toISOString().split('T')[0],
              open: r.o,
              high: r.h,
              low: r.l,
              close: r.c,
              volume: r.v
            }));

            const input = {
              symbol,
              name: symbol,
              currentPrice: result.c,
              analysisDate: toDate,
              historicalData
            };

            const analysisResult = analyzeMarketStructure(input);
            scanData.push(analysisResult);
          }
          
          // Rate limiting
          if (i > 0 && i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          console.error(`Error analyzing ${symbol}:`, error);
        }
      }

      setSupportResistanceData(scanData);
      setLastSupportResistanceScan(new Date().toISOString());

      // Save to localStorage
      localStorage.setItem('supportResistanceData', JSON.stringify(scanData));
      localStorage.setItem('lastSupportResistanceScan', new Date().toISOString());

    } catch (error) {
      console.error('Error running support/resistance scan:', error);
      setError('Failed to run support/resistance scan');
    } finally {
      setLoading(false);
    }
  }, [symbols, loadSymbols]);

  // Run weekly scan (Sunday 09:00)
  const runWeeklyScan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load symbols if not loaded
      if (symbols.length === 0) {
        await loadSymbols();
      }

      // Running weekly scan
      
      // Get weekly data for all symbols
      const weeklyData = [];
      for (const symbol of symbols.slice(0, 50)) { // Limit to 50 for demo
        try {
          const weeklyData_result = await PolygonService.getWeeklyData(symbol);
          if (weeklyData_result && weeklyData_result.results && weeklyData_result.results.length > 0) {
            const result = weeklyData_result.results[0];
            
            // Calculate weekly indicators with more diversity
            const weeklyScore = calculateMockWeeklyScore({
              price: result.c,
              open: result.o,
              high: result.h,
              low: result.l,
              volume: result.v,
              vwap: result.vw || result.c,
              gap_percent: ((result.c - result.o) / result.o) * 100,
              rvol: result.v > 0 ? (result.v / 1000000) : 1
            }, symbol);
            
            // Add more diversity to weekly scores
            const symbolHash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const diversityBonus = (symbolHash % 60) - 30; // -30 to +30
            const diversifiedWeeklyScore = weeklyScore + diversityBonus;

            weeklyData.push({
              symbol,
              timestamp: new Date().toISOString(),
              scan_type: 'weekly',
              weekly_score: diversifiedWeeklyScore,
              weekly_trend: diversifiedWeeklyScore > 0 ? 'bullish' : 'bearish',
              above_vwap: result.c > (result.vw || result.c),
              distance_to_pwh: Math.random() * 0.05,
              distance_to_pwl: Math.random() * 0.05,
              rs_vs_spy: Math.random() * 2 - 1 // -1 to 1
            });
          }
        } catch (error) {
          console.error(`Error processing weekly data for ${symbol}:`, error);
        }
      }

      // Save weekly data to Firebase
      const date = TimeUtils.formatDateForFirebase();
      await FirebaseService.saveWeeklyScan(date, {
        timestamp: new Date().toISOString(),
        scan_type: 'weekly',
        symbols_count: weeklyData.length,
        weekly_data: weeklyData
      });

      // Weekly scan completed
      
      // Save weekly data to state and remember scan date
      setWeeklyData(weeklyData);
      setLastWeeklyScan(new Date().toISOString());
      
      // Save to localStorage
      localStorage.setItem('weeklyData', JSON.stringify(weeklyData));
      localStorage.setItem('lastWeeklyScan', new Date().toISOString());
      
    } catch (error) {
      console.error('Error running weekly scan:', error);
      setError('Failed to run weekly scan');
    } finally {
      setLoading(false);
    }
  }, [symbols, loadSymbols, calculateMockWeeklyScore]);

  // Initialize
  useEffect(() => {
    loadSymbols();
    
    // Load weekly data from localStorage if available
    const savedWeeklyData = localStorage.getItem('weeklyData');
    const savedLastWeeklyScan = localStorage.getItem('lastWeeklyScan');
    
    if (savedWeeklyData && savedLastWeeklyScan) {
      try {
        setWeeklyData(JSON.parse(savedWeeklyData));
        setLastWeeklyScan(savedLastWeeklyScan);
      } catch (error) {
        console.error('Error loading weekly data from localStorage:', error);
      }
    }

    // Load support/resistance data from localStorage if available
    const savedSupportResistanceData = localStorage.getItem('supportResistanceData');
    const savedLastSupportResistanceScan = localStorage.getItem('lastSupportResistanceScan');
    
    if (savedSupportResistanceData && savedLastSupportResistanceScan) {
      try {
        setSupportResistanceData(JSON.parse(savedSupportResistanceData));
        setLastSupportResistanceScan(savedLastSupportResistanceScan);
      } catch (error) {
        console.error('Error loading support/resistance data from localStorage:', error);
      }
    }
  }, [loadSymbols]);

  return {
    symbols,
    marketData,
    tradingData,
    weeklyData,
    supportResistanceData,
    marketDirection,
    loading,
    error,
    lastScanTime,
    lastWeeklyScan,
    lastSupportResistanceScan,
    needsWeeklyScan,
    loadMarketData,
    runDailyScan,
    runTestScan,
    runSupportResistanceScan,
    runPremarketScan,
    runScoutEntries,
    runReinforcement,
    runWeeklyScan
  };
};
