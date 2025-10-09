// Day Trading Dashboard - הקומפוננטה הראשית
import * as React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh,
  TrendingUp,
  TrendingDown,
  Remove,
  Schedule,
  Assessment
} from '@mui/icons-material';
import { useDayTrading } from '../Hooks/useDayTrading';
import { useMarketData } from '../Hooks/useMarketData';
import { MarketDirectionIndicators } from './MarketDirectionIndicators';
import { ActionButtons } from './ActionButtons';
import { TradingTable } from './TradingTable';
import { GatesStatus } from './GatesStatus';
import { RRCalculator } from './RRCalculator';
import { TimeUtils } from '../Utils/TimeUtils';

export function DayDashboard(): React.ReactElement {
  const {
    symbols,
    marketData,
    tradingData,
    marketDirection,
    loading,
    error,
    lastScanTime,
    lastWeeklyScan,
    lastSupportResistanceScan,
    loadMarketData,
    runDailyScan,
    runTestScan,
    runSupportResistanceScan,
    runPremarketScan,
    runScoutEntries,
    runReinforcement,
    runWeeklyScan
  } = useDayTrading();

  const {
    marketData: marketDataHook,
    loading: marketLoading,
    error: marketError,
    lastUpdate,
    getMarketStatus,
    getMarketSentiment
  } = useMarketData();

  const [currentTime, setCurrentTime] = React.useState(TimeUtils.getCurrentIsraeliTime());

  // Update time every second
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(TimeUtils.getCurrentIsraeliTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const marketStatus = getMarketStatus();
  const marketSentiment = getMarketSentiment();

  return (
    <Box sx={{ p: 3, maxWidth: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Paper elevation={3} sx={{ p: 2, mb: 3, backgroundColor: '#f5f5f5' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="body2" component="h1" sx={{ mb: 1, fontSize: '0.85rem' }}>
              📊 Day Trading | Weekly: <span style={{ color: (marketDirection?.weekly || 0) > 0 ? 'green' : (marketDirection?.weekly || 0) < 0 ? 'red' : 'black' }}>+{marketDirection?.weekly || 0}</span> | Daily: <span style={{ color: (marketDirection?.daily || 0) > 0 ? 'green' : (marketDirection?.daily || 0) < 0 ? 'red' : 'black' }}>{marketDirection?.daily || 0}</span> | Final: <span style={{ color: (marketDirection?.final === 'LONG' || marketDirection?.final === 'SHORT') ? 'green' : 'red' }}>{marketDirection?.final || 'WAIT'}</span> | {lastScanTime || 'No scan yet'} IL | Status: {marketStatus} | Sentiment: {marketSentiment}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={loadMarketData} disabled={loading}>
                <Refresh />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Market Data Summary */}
      {marketData && (
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            <span style={{ color: marketData.spy.above_vwap ? 'green' : 'red' }}>SPY: {marketData.spy.price.toFixed(2)} ({marketData.spy.change > 0 ? '+' : ''}{marketData.spy.change.toFixed(2)}%)</span> | 
            <span style={{ color: marketData.qqq.above_vwap ? 'green' : 'red' }}>QQQ: {marketData.qqq.price.toFixed(2)} ({marketData.qqq.change > 0 ? '+' : ''}{marketData.qqq.change.toFixed(2)}%)</span> | 
            <span style={{ color: marketData.iwm.above_vwap ? 'green' : 'red' }}>IWM: {marketData.iwm.price.toFixed(2)} ({marketData.iwm.change > 0 ? '+' : ''}{marketData.iwm.change.toFixed(2)}%)</span> | 
            <span style={{ color: marketData.vix.above_25 ? 'red' : 'green' }}>VIX: {marketData.vix.value.toFixed(2)} ({marketData.vix.above_25 ? 'High Fear' : 'Low Fear'})</span> | 
            <span style={{ color: marketData.breadth.value >= 80 ? 'green' : marketData.breadth.value >= 50 ? 'orange' : 'red' }}>Market Breadth: {marketData.breadth.value.toFixed(0)}%</span>
          </Typography>
        </Paper>
      )}

      {/* Action Buttons */}
      <ActionButtons
        loading={loading}
        onDailyScan={runDailyScan}
        onTestScan={runTestScan}
        onSupportResistance={runSupportResistanceScan}
        onPremarketScan={runPremarketScan}
        onScoutEntries={runScoutEntries}
        onReinforcement={runReinforcement}
        onWeeklyScan={runWeeklyScan}
        lastScanTime={lastScanTime}
        lastWeeklyScan={lastWeeklyScan}
        lastSupportResistanceScan={lastSupportResistanceScan}
        loadingMessage={loading ? 'סורק מניות ומחשב אינדיקטורים...' : undefined}
      />

      {/* Gates Status */}
      <GatesStatus marketData={marketData} />

      {/* Trading Table */}
      <TradingTable
        tradingData={tradingData}
        marketDirection={marketDirection}
        loading={loading}
      />

      {/* RR Calculator */}
      <RRCalculator />

      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
          }}
        >
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Running Scan...
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
