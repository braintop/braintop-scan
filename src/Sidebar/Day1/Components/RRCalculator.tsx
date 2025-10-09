// RR Calculator - מחשבון Risk/Reward
import * as React from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  TextField,
  Button,
  Chip,
  Divider
} from '@mui/material';
import {
  Calculate,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';

export function RRCalculator(): React.ReactElement {
  const [entryPrice, setEntryPrice] = React.useState<number>(100);
  const [stopLoss, setStopLoss] = React.useState<number>(98);
  const [takeProfit1, setTakeProfit1] = React.useState<number>(102);
  const [takeProfit2, setTakeProfit2] = React.useState<number>(104);
  const [positionSize, setPositionSize] = React.useState<number>(1000);
  const [direction, setDirection] = React.useState<'LONG' | 'SHORT'>('LONG');

  const calculateRR = () => {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward1 = Math.abs(takeProfit1 - entryPrice);
    const reward2 = Math.abs(takeProfit2 - entryPrice);
    
    const rr1 = risk > 0 ? reward1 / risk : 0;
    const rr2 = risk > 0 ? reward2 / risk : 0;
    
    const riskAmount = risk * positionSize;
    const reward1Amount = reward1 * positionSize;
    const reward2Amount = reward2 * positionSize;
    
    return {
      risk,
      reward1,
      reward2,
      rr1,
      rr2,
      riskAmount,
      reward1Amount,
      reward2Amount
    };
  };

  const rr = calculateRR();

  const handleDirectionChange = () => {
    setDirection(prev => prev === 'LONG' ? 'SHORT' : 'LONG');
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        🧮 Risk/Reward Calculator
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Box sx={{ mb: 2 }}>
            <Button
              variant={direction === 'LONG' ? 'contained' : 'outlined'}
              color={direction === 'LONG' ? 'success' : 'primary'}
              startIcon={<TrendingUp />}
              onClick={handleDirectionChange}
              sx={{ mr: 1 }}
            >
              LONG
            </Button>
            <Button
              variant={direction === 'SHORT' ? 'contained' : 'outlined'}
              color={direction === 'SHORT' ? 'error' : 'primary'}
              startIcon={<TrendingDown />}
              onClick={handleDirectionChange}
            >
              SHORT
            </Button>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Entry Price"
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Position Size"
                type="number"
                value={positionSize}
                onChange={(e) => setPositionSize(Number(e.target.value))}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Stop Loss"
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                fullWidth
                size="small"
                color={direction === 'LONG' ? 'error' : 'success'}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Take Profit 1"
                type="number"
                value={takeProfit1}
                onChange={(e) => setTakeProfit1(Number(e.target.value))}
                fullWidth
                size="small"
                color="success"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Take Profit 2"
                type="number"
                value={takeProfit2}
                onChange={(e) => setTakeProfit2(Number(e.target.value))}
                fullWidth
                size="small"
                color="success"
              />
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              📊 Risk/Reward Analysis
            </Typography>
            
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Risk per Share:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" fontWeight="bold">
                  ${rr.risk.toFixed(2)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Reward 1 per Share:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" fontWeight="bold">
                  ${rr.reward1.toFixed(2)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Reward 2 per Share:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" fontWeight="bold">
                  ${rr.reward2.toFixed(2)}
                </Typography>
              </Grid>
              
              <Divider sx={{ my: 1, width: '100%' }} />
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  R:R Ratio 1:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Chip
                  label={`1:${rr.rr1.toFixed(1)}`}
                  color={rr.rr1 >= 2 ? 'success' : rr.rr1 >= 1 ? 'warning' : 'error'}
                  size="small"
                />
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  R:R Ratio 2:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Chip
                  label={`1:${rr.rr2.toFixed(1)}`}
                  color={rr.rr2 >= 2 ? 'success' : rr.rr2 >= 1 ? 'warning' : 'error'}
                  size="small"
                />
              </Grid>
              
              <Divider sx={{ my: 1, width: '100%' }} />
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Total Risk:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" fontWeight="bold" color="error.main">
                  ${rr.riskAmount.toFixed(2)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Total Reward 1:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" fontWeight="bold" color="success.main">
                  ${rr.reward1Amount.toFixed(2)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Total Reward 2:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" fontWeight="bold" color="success.main">
                  ${rr.reward2Amount.toFixed(2)}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
