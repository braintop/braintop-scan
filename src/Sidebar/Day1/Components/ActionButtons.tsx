// Action Buttons - כפתורי פעולה
import * as React from 'react';
import {
  Box,
  Button,
  Typography,
  Chip,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  PlayArrow,
  Schedule,
  MilitaryTech,
  Add,
  Assessment,
  Update,
  Architecture
} from '@mui/icons-material';
import { TimeUtils } from '../Utils/TimeUtils';

interface ActionButtonsProps {
  loading: boolean;
  onDailyScan: () => void;
  onTestScan: () => void;
  onSupportResistance: () => void;
  onPremarketScan: () => void;
  onScoutEntries: () => void;
  onReinforcement: () => void;
  onWeeklyScan: () => void;
  lastScanTime: string;
  lastWeeklyScan?: string;
  lastSupportResistanceScan?: string;
  loadingMessage?: string;
}

export function ActionButtons({
  loading,
  onDailyScan,
  onTestScan,
  onSupportResistance,
  onPremarketScan,
  onScoutEntries,
  onReinforcement,
  onWeeklyScan,
  lastScanTime,
  lastWeeklyScan,
  lastSupportResistanceScan,
  loadingMessage
}: ActionButtonsProps): React.ReactElement {
  
  const getCurrentScanType = () => {
    return TimeUtils.getCurrentScanType();
  };

  const isTimeForScan = (scanType: string) => {
    return TimeUtils.isTimeForScan(scanType);
  };

  const getButtonColor = (scanType: string) => {
    if (isTimeForScan(scanType)) return 'primary';
    return 'default';
  };

  const getButtonVariant = (scanType: string) => {
    if (isTimeForScan(scanType)) return 'contained';
    return 'outlined';
  };

  const formatWeeklyScanDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSupportResistanceScanDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box sx={{ mb: 2 }}>
      {/* Loading Indicator */}
      {loading && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          mb: 2, 
          p: 1, 
          backgroundColor: 'primary.light', 
          borderRadius: 1,
          color: 'white'
        }}>
          <CircularProgress size={16} color="inherit" />
          <Typography variant="body2">
            {loadingMessage || 'מעבד נתונים...'}
          </Typography>
        </Box>
      )}
      
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Tooltip title="1️⃣ ראשון: Run weekly scan on Sunday 09:00 IL">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Button
              variant={getButtonVariant('weekly')}
              color={getButtonColor('weekly')}
              startIcon={<Update />}
              onClick={onWeeklyScan}
              disabled={loading}
              sx={{ minWidth: 120, fontSize: '0.8rem' }}
            >
              1️⃣ Weekly Scan
            </Button>
            {lastWeeklyScan && (
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.5 }}>
                אחרון: {formatWeeklyScanDate(lastWeeklyScan)}
              </Typography>
            )}
          </Box>
        </Tooltip>

        <Tooltip title="2️⃣ שני: Run daily scan (20 symbols)">
          <Button
            variant={getButtonVariant('daily')}
            color={getButtonColor('daily')}
            startIcon={<Assessment />}
            onClick={onDailyScan}
            disabled={loading}
            sx={{ minWidth: 120, fontSize: '0.8rem' }}
          >
            2️⃣ Daily Scan
          </Button>
        </Tooltip>

        <Tooltip title="2.5️⃣ Support/Resistance: Calculate levels for all stocks">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Button
              variant={getButtonVariant('supportResistance')}
              color={getButtonColor('supportResistance')}
              startIcon={<Architecture />}
              onClick={onSupportResistance}
              disabled={loading}
              sx={{ minWidth: 140, fontSize: '0.8rem' }}
            >
              2.5️⃣ S/R Levels
            </Button>
            {lastSupportResistanceScan && (
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.5 }}>
                אחרון: {formatSupportResistanceScanDate(lastSupportResistanceScan)}
              </Typography>
            )}
          </Box>
        </Tooltip>

        <Tooltip title="3️⃣ שלישי: Run premarket scan at 16:15 IL">
          <Button
            variant={getButtonVariant('premarket')}
            color={getButtonColor('premarket')}
            startIcon={<Schedule />}
            onClick={onPremarketScan}
            disabled={loading}
            sx={{ minWidth: 120, fontSize: '0.8rem' }}
          >
            3️⃣ Premarket 16:15
          </Button>
        </Tooltip>

        <Tooltip title="4️⃣ רביעי: Execute scout entries at 16:20 IL">
          <Button
            variant={getButtonVariant('scout')}
            color={getButtonColor('scout')}
            startIcon={<MilitaryTech />}
            onClick={onScoutEntries}
            disabled={loading}
            sx={{ minWidth: 120, fontSize: '0.8rem' }}
          >
            4️⃣ Scout 16:20
          </Button>
        </Tooltip>

        <Tooltip title="5️⃣ חמישי: Execute reinforcement at 17:00 IL">
          <Button
            variant={getButtonVariant('reinforcement')}
            color={getButtonColor('reinforcement')}
            startIcon={<Add />}
            onClick={onReinforcement}
            disabled={loading}
            sx={{ minWidth: 120, fontSize: '0.8rem' }}
          >
            5️⃣ Reinforce 17:00
          </Button>
        </Tooltip>
      </Box>

      {lastScanTime && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`Last Scan: ${lastScanTime}`}
            size="small"
            color="info"
            icon={<Update />}
          />
          <Typography variant="body2" color="text.secondary">
            Current Time: {TimeUtils.formatTimeForDisplay()}
          </Typography>
        </Box>
      )}

    </Box>
  );
}
