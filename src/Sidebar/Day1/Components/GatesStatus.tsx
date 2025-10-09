// Gates Status - סטטוס שערים
import * as React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Grid,
  Tooltip
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Warning
} from '@mui/icons-material';
import type { MarketData } from '../Types/MarketTypes';
import { GatesLogic } from '../Utils/GatesLogic';

interface GatesStatusProps {
  marketData: MarketData | null;
}

export function GatesStatus({ marketData }: GatesStatusProps): React.ReactElement {
  
  if (!marketData) {
    return (
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          🚪 Gates Status
        </Typography>
        <Typography color="text.secondary">
          No market data available
        </Typography>
      </Paper>
    );
  }

  // Mock gates status for demonstration
  const mockGates = {
    breadth_80: marketData.breadth.value >= 80,
    spy_above_vwap: marketData.spy.above_vwap,
    qqq_above_vwap: marketData.qqq.above_vwap,
    iwm_above_vwap: marketData.iwm.above_vwap,
    vix_low: marketData.vix.value <= 25,
    rvol_high: true, // Mock
    spread_low: true, // Mock
    weekly_context: true, // Mock
    all_passed: false
  };

  mockGates.all_passed = mockGates.breadth_80 && 
                        mockGates.spy_above_vwap && 
                        mockGates.qqq_above_vwap && 
                        mockGates.iwm_above_vwap && 
                        mockGates.vix_low && 
                        mockGates.rvol_high && 
                        mockGates.spread_low && 
                        mockGates.weekly_context;

  const gates = [
    {
      name: 'Market Breadth ≥ 80%',
      status: mockGates.breadth_80,
      value: `${marketData.breadth.value}%`,
      description: 'Percentage of stocks above SMA20'
    },
    {
      name: 'SPY Above VWAP',
      status: mockGates.spy_above_vwap,
      value: marketData.spy.above_vwap ? 'Above' : 'Below',
      description: 'SPY position relative to VWAP'
    },
    {
      name: 'QQQ Above VWAP',
      status: mockGates.qqq_above_vwap,
      value: marketData.qqq.above_vwap ? 'Above' : 'Below',
      description: 'QQQ position relative to VWAP'
    },
    {
      name: 'IWM Above VWAP',
      status: mockGates.iwm_above_vwap,
      value: marketData.iwm.above_vwap ? 'Above' : 'Below',
      description: 'IWM position relative to VWAP'
    },
    {
      name: 'VIX ≤ 25',
      status: mockGates.vix_low,
      value: marketData.vix.value.toFixed(1),
      description: 'Volatility index level'
    },
    {
      name: 'RVOL ≥ 2.0',
      status: mockGates.rvol_high,
      value: '2.5x', // Mock
      description: 'Relative volume'
    },
    {
      name: 'Spread ≤ 0.2%',
      status: mockGates.spread_low,
      value: '0.1%', // Mock
      description: 'Bid-ask spread'
    },
    {
      name: 'Weekly Context',
      status: mockGates.weekly_context,
      value: 'OK', // Mock
      description: 'Weekly trend and VWAP'
    }
  ];

  const passedGates = gates.filter(gate => gate.status).length;
  const totalGates = gates.length;

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          🚪 Gates Status
        </Typography>
        <Chip
          label={`${passedGates}/${totalGates} Gates Passed`}
          color={mockGates.all_passed ? 'success' : passedGates >= 6 ? 'warning' : 'error'}
          icon={mockGates.all_passed ? <CheckCircle /> : passedGates >= 6 ? <Warning /> : <Cancel />}
        />
      </Box>

      <Grid container spacing={2}>
        {gates.map((gate, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Tooltip title={gate.description}>
              <Box
                sx={{
                  p: 1,
                  border: 1,
                  borderColor: gate.status ? 'success.main' : 'error.main',
                  borderRadius: 1,
                  backgroundColor: gate.status ? 'success.light' : 'error.light',
                  textAlign: 'center'
                }}
              >
                <Typography variant="body2" fontWeight="bold">
                  {gate.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {gate.value}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {gate.status ? (
                    <CheckCircle color="success" fontSize="small" />
                  ) : (
                    <Cancel color="error" fontSize="small" />
                  )}
                </Box>
              </Box>
            </Tooltip>
          </Grid>
        ))}
      </Grid>

      {mockGates.all_passed && (
        <Box sx={{ mt: 2, p: 2, backgroundColor: 'success.light', borderRadius: 1 }}>
          <Typography variant="body1" color="success.dark" fontWeight="bold" textAlign="center">
            🎯 All Gates Passed! Ready for Entry
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
