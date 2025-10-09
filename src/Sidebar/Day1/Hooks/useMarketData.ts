// Market Data Hook - Hook לנתוני שוק
import { useState, useEffect, useCallback } from 'react';
import type { MarketData, WeeklyMarketData } from '../Types/MarketTypes';
import { MarketDataService } from '../Services/MarketDataService';
import { TimeUtils } from '../Utils/TimeUtils';

export const useMarketData = () => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [weeklyMarketData, setWeeklyMarketData] = useState<WeeklyMarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Load current market data
  const loadMarketData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await MarketDataService.getCurrentMarketData();
      if (data) {
        setMarketData(data);
        setLastUpdate(TimeUtils.formatTimeForDisplay());
      }
    } catch (error) {
      console.error('Error loading market data:', error);
      setError('Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load weekly market data
  const loadWeeklyMarketData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await MarketDataService.getWeeklyMarketData();
      if (data) {
        setWeeklyMarketData(data);
        setLastUpdate(TimeUtils.formatTimeForDisplay());
      }
    } catch (error) {
      console.error('Error loading weekly market data:', error);
      setError('Failed to load weekly market data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh market data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (TimeUtils.isMarketOpen()) {
        loadMarketData();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [loadMarketData]);

  // Load data on mount
  useEffect(() => {
    loadMarketData();
    loadWeeklyMarketData();
  }, [loadMarketData, loadWeeklyMarketData]);

  // Get market status
  const getMarketStatus = useCallback(() => {
    if (!marketData) return 'UNKNOWN';
    
    if (TimeUtils.isMarketOpen()) {
      return 'OPEN';
    } else if (TimeUtils.isPremarketTime()) {
      return 'PREMARKET';
    } else {
      return 'CLOSED';
    }
  }, [marketData]);

  // Get market sentiment
  const getMarketSentiment = useCallback(() => {
    if (!marketData) return 'NEUTRAL';
    
    const breadth = marketData.breadth.value;
    const spyAboveVWAP = marketData.spy.above_vwap;
    const qqqAboveVWAP = marketData.qqq.above_vwap;
    const iwmAboveVWAP = marketData.iwm.above_vwap;
    const vixLow = marketData.vix.value <= 25;
    
    let score = 0;
    
    if (breadth >= 70) score += 2;
    else if (breadth <= 30) score -= 2;
    
    if (spyAboveVWAP) score += 1;
    else score -= 1;
    
    if (qqqAboveVWAP) score += 1;
    else score -= 1;
    
    if (iwmAboveVWAP) score += 1;
    else score -= 1;
    
    if (vixLow) score += 1;
    else score -= 1;
    
    if (score >= 4) return 'VERY_BULLISH';
    if (score >= 2) return 'BULLISH';
    if (score >= 0) return 'NEUTRAL_BULLISH';
    if (score >= -2) return 'NEUTRAL_BEARISH';
    if (score >= -4) return 'BEARISH';
    return 'VERY_BEARISH';
  }, [marketData]);

  // Get market direction indicators
  const getMarketDirectionIndicators = useCallback(() => {
    if (!marketData || !weeklyMarketData) {
      return { weekly: 0, daily: 0 };
    }
    
    return MarketDataService.calculateMarketDirectionIndicators(marketData);
  }, [marketData, weeklyMarketData]);

  return {
    marketData,
    weeklyMarketData,
    loading,
    error,
    lastUpdate,
    loadMarketData,
    loadWeeklyMarketData,
    getMarketStatus,
    getMarketSentiment,
    getMarketDirectionIndicators
  };
};
