// Market Direction Indicators - אינדיקטורי כיוון שוק
import * as React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Remove
} from '@mui/icons-material';
import type { MarketDirectionScore } from '../Types/DayTradingTypes';
import { MarketDirectionUtils } from '../Utils/MarketDirectionUtils';

interface MarketDirectionIndicatorsProps {
  marketDirection: MarketDirectionScore | null;
}

export function MarketDirectionIndicators({ marketDirection }: MarketDirectionIndicatorsProps): React.ReactElement {
  if (!marketDirection) {
    return (
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip label="Weekly: --" size="small" />
        <Chip label="Daily: --" size="small" />
      </Box>
    );
  }

  const weeklyStyle = MarketDirectionUtils.getIndicatorStyle(marketDirection.weekly);
  const dailyStyle = MarketDirectionUtils.getIndicatorStyle(marketDirection.daily);

  const getDirectionIcon = (value: number) => {
    if (value >= 5) return <TrendingUp />;
    if (value <= -5) return <TrendingDown />;
    return <Remove />;
  };

  const getDirectionColor = (value: number) => {
    if (value >= 5) return 'success';
    if (value <= -5) return 'error';
    return 'default';
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Tooltip title={`Weekly Market Direction: ${weeklyStyle.text}`}>
        <Chip
          label={`Weekly: ${weeklyStyle.text}`}
          size="small"
          color={getDirectionColor(marketDirection.weekly)}
          icon={getDirectionIcon(marketDirection.weekly)}
          sx={{
            backgroundColor: weeklyStyle.color === 'green' ? '#e8f5e8' : 
                           weeklyStyle.color === 'red' ? '#ffebee' : '#f5f5f5',
            color: weeklyStyle.color === 'green' ? '#2e7d32' : 
                   weeklyStyle.color === 'red' ? '#d32f2f' : '#666'
          }}
        />
      </Tooltip>

      <Tooltip title={`Daily Market Direction: ${dailyStyle.text}`}>
        <Chip
          label={`Daily: ${dailyStyle.text}`}
          size="small"
          color={getDirectionColor(marketDirection.daily)}
          icon={getDirectionIcon(marketDirection.daily)}
          sx={{
            backgroundColor: dailyStyle.color === 'green' ? '#e8f5e8' : 
                           dailyStyle.color === 'red' ? '#ffebee' : '#f5f5f5',
            color: dailyStyle.color === 'green' ? '#2e7d32' : 
                   dailyStyle.color === 'red' ? '#d32f2f' : '#666'
          }}
        />
      </Tooltip>

      <Tooltip title={`Final Direction: ${marketDirection.direction} (${marketDirection.confidence} Confidence)`}>
        <Chip
          label={`Final: ${marketDirection.direction}`}
          size="small"
          color={marketDirection.direction === 'LONG' ? 'success' : 
                 marketDirection.direction === 'SHORT' ? 'error' : 'default'}
          sx={{
            fontWeight: 'bold',
            backgroundColor: marketDirection.direction === 'LONG' ? '#e8f5e8' : 
                           marketDirection.direction === 'SHORT' ? '#ffebee' : '#f5f5f5',
            color: marketDirection.direction === 'LONG' ? '#2e7d32' : 
                   marketDirection.direction === 'SHORT' ? '#d32f2f' : '#666'
          }}
        />
      </Tooltip>
    </Box>
  );
}
