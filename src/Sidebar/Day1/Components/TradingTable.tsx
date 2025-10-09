// Trading Table - טבלת מסחר
import * as React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Box,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Remove,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import type { DayTradingData, MarketDirectionScore } from '../Types/DayTradingTypes';
import { GatesLogic } from '../Utils/GatesLogic';

interface TradingTableProps {
  tradingData: DayTradingData[];
  marketDirection: MarketDirectionScore | null;
  loading: boolean;
}

export function TradingTable({ tradingData, marketDirection, loading }: TradingTableProps): React.ReactElement {
  
  // Sort data by score (highest first)
  const sortedData = React.useMemo(() => {
    return [...tradingData].sort((a, b) => {
      // First by direction (LONG > WAIT > SHORT)
      const aDirection = a.trading ? 'LONG' : 'WAIT';
      const bDirection = b.trading ? 'LONG' : 'WAIT';
      
      if (aDirection !== bDirection) {
        if (aDirection === 'LONG') return -1;
        if (bDirection === 'LONG') return 1;
        if (aDirection === 'WAIT') return -1;
        if (bDirection === 'WAIT') return 1;
      }
      
      // Then by score (if trading exists)
      if (a.trading && b.trading) {
        return b.trading.rr_ratio - a.trading.rr_ratio;
      }
      
      return 0;
    });
  }, [tradingData]);

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'LONG': return 'success';
      case 'SHORT': return 'error';
      default: return 'default';
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'LONG': return <TrendingUp />;
      case 'SHORT': return <TrendingDown />;
      default: return <Remove />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'success';
    if (score >= 50) return 'warning';
    if (score <= -70) return 'error';
    if (score <= -50) return 'warning';
    return 'default';
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading trading data...</Typography>
      </Paper>
    );
  }

  if (tradingData.length === 0) {
    // Show loading indicator if loading OR if we just finished loading but don't have data yet
    if (loading) {
      return (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={40} />
            <Typography variant="h6" color="primary">
              מחשב נתוני מסחר...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              אנא המתן, אנו מעבדים את הנתונים
            </Typography>
          </Box>
        </Paper>
      );
    }
    
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No trading data available. Run a scan to see results.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ mb: 3 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">
          📊 Trading Signals ({sortedData.length} symbols)
        </Typography>
      </Box>
      
      <TableContainer>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Symbol</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">SMA3</TableCell>
              <TableCell align="right">SMA12</TableCell>
              <TableCell align="right">MACD</TableCell>
              <TableCell align="right">RSI</TableCell>
              <TableCell align="right">ADX</TableCell>
              <TableCell align="right">VWAP</TableCell>
              <TableCell align="right">RVOL</TableCell>
              <TableCell align="center">Pattern</TableCell>
              <TableCell align="center">Weekly</TableCell>
              <TableCell align="center">Daily</TableCell>
              <TableCell align="center">Score</TableCell>
              <TableCell align="center">Direction</TableCell>
              <TableCell align="center">Gates</TableCell>
              <TableCell align="center">RR</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedData.map((row, index) => {
              const direction = row.trading ? 'LONG' : 'WAIT';
              const score = row.final_score || 0;
              const gatesStatus = GatesLogic.getGatesDisplayStatus(row.gates);
              
              return (
                <TableRow key={row.symbol} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {index + 1}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {row.symbol}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2">
                      ${row.stock.price.toFixed(2)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2" color={row.stock.price > row.stock.sma3 ? 'success.main' : 'error.main'}>
                      ${row.stock.sma3.toFixed(2)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2" color={row.stock.price > row.stock.sma12 ? 'success.main' : 'error.main'}>
                      ${row.stock.sma12.toFixed(2)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2" color={row.stock.macd > 0 ? 'success.main' : 'error.main'}>
                      {row.stock.macd.toFixed(2)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2" color={row.stock.rsi > 70 ? 'error.main' : row.stock.rsi < 30 ? 'success.main' : 'text.primary'}>
                      {row.stock.rsi.toFixed(0)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2" color={row.stock.adx > 25 ? 'success.main' : row.stock.adx > 15 ? 'warning.main' : 'error.main'}>
                      {row.stock.adx}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2" color={row.stock.price > row.stock.vwap ? 'success.main' : 'error.main'}>
                      ${row.stock.vwap.toFixed(2)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2" color={row.stock.rvol > 2 ? 'success.main' : 'text.primary'}>
                      {row.stock.rvol.toFixed(1)}x
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Typography 
                      variant="body2" 
                      fontWeight="bold"
                      sx={{ 
                        backgroundColor: row.stock.pattern && row.stock.pattern !== 'Normal' ? 'success.main' : 'transparent',
                        color: row.stock.pattern && row.stock.pattern !== 'Normal' ? 'white' : 'text.primary',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1
                      }}
                    >
                      {row.stock.pattern || 'Normal'}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={row.weekly?.trend === 'bullish' ? '🟢' : '🔴'}
                      size="small"
                      color={row.weekly?.trend === 'bullish' ? 'success' : 'error'}
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={row.gates.all_passed ? '✅' : '❌'}
                      size="small"
                      color={row.gates.all_passed ? 'success' : 'error'}
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={score}
                      size="small"
                      color={getScoreColor(score)}
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={direction}
                      size="small"
                      color={getDirectionColor(direction)}
                      icon={getDirectionIcon(direction)}
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Tooltip title={gatesStatus.join(' ')}>
                      <Typography variant="body2">
                        {gatesStatus.join('')}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={row.gates.all_passed ? 'READY' : 'FAIL'}
                      size="small"
                      color={row.gates.all_passed ? 'success' : 'error'}
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    <Chip
                      label={row.trading ? `${row.trading.rr_ratio.toFixed(1)}:1` : 'WAIT'}
                      size="small"
                      color={row.trading ? 'success' : 'default'}
                    />
                  </TableCell>
                  
                  <TableCell align="center">
                    {row.trading ? (
                      <Typography variant="body2" fontWeight="bold">
                        1:{row.trading.rr_ratio ? (1/row.trading.rr_ratio).toFixed(1) : 1}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        --
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
