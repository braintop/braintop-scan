// Gates Hook - Hook לשערים ולוגיקת כניסה
import { useState, useCallback } from 'react';
import type { GatesStatus } from '../Types/DayTradingTypes';
import type { MarketData } from '../Types/MarketTypes';
import { GatesLogic } from '../Utils/GatesLogic';

export const useGates = () => {
  const [gatesStatus, setGatesStatus] = useState<GatesStatus | null>(null);
  const [gatesHistory, setGatesHistory] = useState<GatesStatus[]>([]);

  // Check gates for a specific stock
  const checkGates = useCallback((marketData: MarketData, stockData: any) => {
    const gates = GatesLogic.checkDailyGates(marketData, stockData);
    setGatesStatus(gates);
    
    // Add to history
    setGatesHistory(prev => [...prev.slice(-9), gates]);
    
    return gates;
  }, []);

  // Check if all gates pass
  const areAllGatesPassed = useCallback((gates: GatesStatus) => {
    return gates.all_passed;
  }, []);

  // Get gates display status
  const getGatesDisplayStatus = useCallback((gates: GatesStatus) => {
    return GatesLogic.getGatesDisplayStatus(gates);
  }, []);

  // Calculate score for gates
  const calculateScore = useCallback((gates: GatesStatus, marketData: MarketData, stockData: any) => {
    const dailyScore = GatesLogic.calculateDailyScore(gates, marketData, stockData);
    const weeklyScore = Math.random() * 200 - 100; // Mock weekly score
    const finalScore = GatesLogic.calculateFinalScore(dailyScore, weeklyScore);
    
    return {
      daily: dailyScore,
      weekly: weeklyScore,
      final: finalScore
    };
  }, []);

  // Get direction and confidence
  const getDirectionAndConfidence = useCallback((finalScore: number) => {
    return GatesLogic.getDirectionAndConfidence(finalScore);
  }, []);

  // Check if entry should be executed
  const shouldExecuteEntry = useCallback((gates: GatesStatus, finalScore: number) => {
    return GatesLogic.shouldExecuteEntry(gates, finalScore);
  }, []);

  // Get gates summary
  const getGatesSummary = useCallback((gates: GatesStatus) => {
    const passed = Object.values(gates).filter(Boolean).length - 1; // -1 for all_passed
    const total = Object.keys(gates).length - 1; // -1 for all_passed
    
    return {
      passed,
      total,
      percentage: Math.round((passed / total) * 100)
    };
  }, []);

  // Get failed gates
  const getFailedGates = useCallback((gates: GatesStatus) => {
    const failed = [];
    
    if (!gates.breadth_80) failed.push('Breadth < 80');
    if (!gates.spy_above_vwap) failed.push('SPY below VWAP');
    if (!gates.qqq_above_vwap) failed.push('QQQ below VWAP');
    if (!gates.iwm_above_vwap) failed.push('IWM below VWAP');
    if (!gates.vix_low) failed.push('VIX > 25');
    if (!gates.rvol_high) failed.push('RVOL < 2.0');
    if (!gates.spread_low) failed.push('Spread > 0.2%');
    if (!gates.weekly_context) failed.push('Weekly context failed');
    
    return failed;
  }, []);

  // Get passed gates
  const getPassedGates = useCallback((gates: GatesStatus) => {
    const passed = [];
    
    if (gates.breadth_80) passed.push('Breadth ≥ 80');
    if (gates.spy_above_vwap) passed.push('SPY above VWAP');
    if (gates.qqq_above_vwap) passed.push('QQQ above VWAP');
    if (gates.iwm_above_vwap) passed.push('IWM above VWAP');
    if (gates.vix_low) passed.push('VIX ≤ 25');
    if (gates.rvol_high) passed.push('RVOL ≥ 2.0');
    if (gates.spread_low) passed.push('Spread ≤ 0.2%');
    if (gates.weekly_context) passed.push('Weekly context OK');
    
    return passed;
  }, []);

  // Clear gates history
  const clearGatesHistory = useCallback(() => {
    setGatesHistory([]);
  }, []);

  return {
    gatesStatus,
    gatesHistory,
    checkGates,
    areAllGatesPassed,
    getGatesDisplayStatus,
    calculateScore,
    getDirectionAndConfidence,
    shouldExecuteEntry,
    getGatesSummary,
    getFailedGates,
    getPassedGates,
    clearGatesHistory
  };
};
