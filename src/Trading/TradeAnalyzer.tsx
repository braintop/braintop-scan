import React, { useState } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    TextField,
    Button,
    Stack,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip
} from '@mui/material';
// Using Box instead of Grid to avoid Grid2 compatibility issues
import { 
    TrendingUp, 
    TrendingDown, 
    Calculate,
    CheckCircle,
    Cancel,
    Info
} from '@mui/icons-material';
import { 
    calculateSimpleRR, 
    calculateRiskReward, 
    approveTradeWithRR
} from './RiskRewardCalculator';
import type { 
    RiskRewardResult,
    TradeSetup,
    OHLCData 
} from './RiskRewardCalculator';

interface TradeAnalyzerProps {
    symbol?: string;
    currentPrice?: number;
    direction?: 'Long' | 'Short';
    score?: number;
    ohlcData?: OHLCData[];
}

const TradeAnalyzer: React.FC<TradeAnalyzerProps> = ({
    symbol = '',
    currentPrice = 0,
    direction = 'Long',
    score = 0,
    ohlcData = []
}) => {
    // State for manual inputs
    const [manualEntry, setManualEntry] = useState<string>(currentPrice.toString());
    const [manualStop, setManualStop] = useState<string>('');
    const [manualTarget, setManualTarget] = useState<string>('');
    const [tradeDirection, setTradeDirection] = useState<'Long' | 'Short'>(direction);
    
    // Results
    const [simpleResult, setSimpleResult] = useState<any>(null);
    const [advancedResult, setAdvancedResult] = useState<RiskRewardResult | null>(null);
    const [tradeSetup, setTradeSetup] = useState<TradeSetup | null>(null);

    // Calculate simple R:R with manual inputs
    const calculateSimple = () => {
        const entry = parseFloat(manualEntry);
        const stop = parseFloat(manualStop);
        const target = parseFloat(manualTarget);

        if (!entry || !stop || !target) {
            alert('נא למלא את כל השדות');
            return;
        }

        const result = calculateSimpleRR(entry, stop, target);
        setSimpleResult({
            ...result,
            entry,
            stop,
            target,
            riskPercent: (result.risk / entry) * 100,
            rewardPercent: (result.reward / entry) * 100
        });
    };

    // Calculate advanced R:R with OHLC data
    const calculateAdvanced = () => {
        const entry = parseFloat(manualEntry) || currentPrice;
        
        if (!entry || ohlcData.length === 0) {
            alert('נדרש מחיר כניסה ונתוני OHLC');
            return;
        }

        const result = calculateRiskReward(entry, tradeDirection, ohlcData);
        setAdvancedResult(result);
    };

    // Calculate full trade setup
    const calculateTradeSetup = () => {
        const entry = parseFloat(manualEntry) || currentPrice;
        
        if (!entry || !symbol || ohlcData.length === 0) {
            alert('נדרש סמל מניה, מחיר כניסה ונתוני OHLC');
            return;
        }

        const setup = approveTradeWithRR(symbol, tradeDirection, entry, score, ohlcData);
        setTradeSetup(setup);
    };

    // Helper function to get color for R:R ratio
    const getRRColor = (ratio: number): string => {
        if (ratio >= 3) return '#4caf50'; // Green
        if (ratio >= 2) return '#ff9800'; // Orange
        return '#f44336'; // Red
    };

    return (
        <Box sx={{ p: 3 }}>
            <Stack spacing={3}>
                {/* Header */}
                <Card>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Calculate color="primary" sx={{ fontSize: 30 }} />
                            <Typography variant="h4">
                                🎯 מחשבון R:R (Risk/Reward)
                            </Typography>
                        </Stack>
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                            חישוב יחס סיכון-רווח עבור טריידים. מינימום נדרש: 2:1
                        </Typography>
                    </CardContent>
                </Card>

                {/* Input Section */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            📝 נתוני הטרייד
                        </Typography>
                        
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <TextField
                                label="מחיר כניסה"
                                type="number"
                                value={manualEntry}
                                onChange={(e) => setManualEntry(e.target.value)}
                                InputProps={{ startAdornment: '$' }}
                                sx={{ flex: 1 }}
                            />
                            <TextField
                                label="Stop Loss"
                                type="number"
                                value={manualStop}
                                onChange={(e) => setManualStop(e.target.value)}
                                InputProps={{ startAdornment: '$' }}
                                sx={{ flex: 1 }}
                            />
                            <TextField
                                label="Target"
                                type="number"
                                value={manualTarget}
                                onChange={(e) => setManualTarget(e.target.value)}
                                InputProps={{ startAdornment: '$' }}
                                sx={{ flex: 1 }}
                            />
                            <Button
                                variant="contained"
                                onClick={calculateSimple}
                                startIcon={<Calculate />}
                                sx={{ height: '56px', minWidth: '120px' }}
                            >
                                חשב R:R
                            </Button>
                        </Stack>

                        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                            <Button
                                variant={tradeDirection === 'Long' ? 'contained' : 'outlined'}
                                color="success"
                                startIcon={<TrendingUp />}
                                onClick={() => setTradeDirection('Long')}
                            >
                                Long
                            </Button>
                            <Button
                                variant={tradeDirection === 'Short' ? 'contained' : 'outlined'}
                                color="error"
                                startIcon={<TrendingDown />}
                                onClick={() => setTradeDirection('Short')}
                            >
                                Short
                            </Button>
                            {ohlcData.length > 0 && (
                                <>
                                    <Button
                                        variant="outlined"
                                        onClick={calculateAdvanced}
                                        startIcon={<Info />}
                                    >
                                        חישוב אוטומטי
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={calculateTradeSetup}
                                        startIcon={<CheckCircle />}
                                    >
                                        אישור טרייד מלא
                                    </Button>
                                </>
                            )}
                        </Stack>
                    </CardContent>
                </Card>

                {/* Simple R:R Result */}
                {simpleResult && (
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                📊 תוצאות R:R בסיסי
                            </Typography>
                            
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                                <Box sx={{ flex: 1 }}>
                                    <Stack spacing={1}>
                                        <Typography variant="body2">
                                            <strong>כניסה:</strong> ${simpleResult.entry.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Stop Loss:</strong> ${simpleResult.stop.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Target:</strong> ${simpleResult.target.toFixed(2)}
                                        </Typography>
                                    </Stack>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Stack spacing={1}>
                                        <Typography variant="body2">
                                            <strong>סיכון:</strong> ${simpleResult.risk.toFixed(2)} ({simpleResult.riskPercent.toFixed(2)}%)
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>רווח פוטנציאלי:</strong> ${simpleResult.reward.toFixed(2)} ({simpleResult.rewardPercent.toFixed(2)}%)
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>יחס R:R:</strong> 
                                            <Chip 
                                                label={`${simpleResult.ratio.toFixed(2)}:1`}
                                                sx={{ 
                                                    ml: 1,
                                                    backgroundColor: getRRColor(simpleResult.ratio),
                                                    color: 'white'
                                                }}
                                            />
                                        </Typography>
                                    </Stack>
                                </Box>
                            </Stack>

                            <Alert 
                                severity={simpleResult.isApproved ? "success" : "error"} 
                                sx={{ mt: 2 }}
                                icon={simpleResult.isApproved ? <CheckCircle /> : <Cancel />}
                            >
                                {simpleResult.isApproved 
                                    ? `✅ טרייד מאושר! יחס R:R של ${simpleResult.ratio.toFixed(2)}:1 עובר את המינימום של 2:1`
                                    : `❌ טרייד לא מאושר! יחס R:R של ${simpleResult.ratio.toFixed(2)}:1 נמוך מהמינימום של 2:1`
                                }
                            </Alert>
                        </CardContent>
                    </Card>
                )}

                {/* Advanced R:R Result */}
                {advancedResult && (
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                🔬 ניתוח R:R מתקדם (אוטומטי)
                            </Typography>
                            
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                                <Box sx={{ flex: 1 }}>
                                    <Stack spacing={1}>
                                        <Typography variant="body2">
                                            <strong>כניסה:</strong> ${advancedResult.entry.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Stop Loss:</strong> ${advancedResult.stopLoss.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Target:</strong> ${advancedResult.target.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>שיטה:</strong> {advancedResult.method}
                                        </Typography>
                                    </Stack>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Stack spacing={1}>
                                        <Typography variant="body2">
                                            <strong>סיכון:</strong> ${advancedResult.risk.toFixed(2)} ({advancedResult.riskPercent.toFixed(2)}%)
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>רווח פוטנציאלי:</strong> ${advancedResult.reward.toFixed(2)} ({advancedResult.rewardPercent.toFixed(2)}%)
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>יחס R:R:</strong> 
                                            <Chip 
                                                label={`${advancedResult.ratio.toFixed(2)}:1`}
                                                sx={{ 
                                                    ml: 1,
                                                    backgroundColor: getRRColor(advancedResult.ratio),
                                                    color: 'white'
                                                }}
                                            />
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>רמת ביטחון:</strong> {advancedResult.confidence}%
                                        </Typography>
                                    </Stack>
                                </Box>
                            </Stack>

                            <Alert 
                                severity={advancedResult.isApproved ? "success" : "error"} 
                                sx={{ mt: 2 }}
                                icon={advancedResult.isApproved ? <CheckCircle /> : <Cancel />}
                            >
                                {advancedResult.isApproved 
                                    ? `✅ ניתוח אוטומטי מאושר! יחס R:R של ${advancedResult.ratio.toFixed(2)}:1`
                                    : `❌ ניתוח אוטומטי לא מאושר! יחס R:R של ${advancedResult.ratio.toFixed(2)}:1 נמוך מהמינימום`
                                }
                            </Alert>
                        </CardContent>
                    </Card>
                )}

                {/* Full Trade Setup */}
                {tradeSetup && (
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                🚀 הגדרת טרייד מלאה
                            </Typography>
                            
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>פרמטר</strong></TableCell>
                                            <TableCell><strong>ערך</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>סמל</TableCell>
                                            <TableCell>{tradeSetup.symbol}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>כיוון</TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={tradeSetup.direction}
                                                    color={tradeSetup.direction === 'Long' ? 'success' : 'error'}
                                                    size="small"
                                                />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>ציון טכני</TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={`${tradeSetup.score}/100`}
                                                    sx={{ 
                                                        backgroundColor: getRRColor(tradeSetup.score / 25),
                                                        color: 'white'
                                                    }}
                                                    size="small"
                                                />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>R:R יחס</TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={`${tradeSetup.riskReward.ratio.toFixed(2)}:1`}
                                                    sx={{ 
                                                        backgroundColor: getRRColor(tradeSetup.riskReward.ratio),
                                                        color: 'white'
                                                    }}
                                                    size="small"
                                                />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>אישור סופי</TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={tradeSetup.finalApproval ? 'מאושר ✅' : 'לא מאושר ❌'}
                                                    color={tradeSetup.finalApproval ? 'success' : 'error'}
                                                    size="small"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Alert 
                                severity={tradeSetup.finalApproval ? "success" : "warning"} 
                                sx={{ mt: 2 }}
                            >
                                {tradeSetup.finalApproval 
                                    ? `🎯 טרייד מאושר לביצוע! גם הציון הטכני (${tradeSetup.score}) וגם יחס ה-R:R (${tradeSetup.riskReward.ratio.toFixed(2)}:1) עוברים את הסף המינימלי.`
                                    : `⚠️ טרייד לא מאושר. ${tradeSetup.score < 60 ? 'ציון טכני נמוך מדי. ' : ''}${!tradeSetup.riskReward.isApproved ? 'יחס R:R נמוך מ-2:1.' : ''}`
                                }
                            </Alert>
                        </CardContent>
                    </Card>
                )}

                {/* Info Box */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            💡 הסבר על R:R
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            <strong>Risk/Reward Ratio</strong> הוא כלי קריטי לניהול סיכונים בטריידינג:
                        </Typography>
                        <ul style={{ marginTop: '8px', color: '#666' }}>
                            <li><strong>2:1</strong> - עבור כל $1 סיכון, פוטנציאל רווח של $2</li>
                            <li><strong>מינימום נדרש:</strong> 2:1 (כדי להיות רווחי ארוך טווח)</li>
                            <li><strong>אידיאלי:</strong> 3:1 או יותר</li>
                            <li><strong>חישוב אוטומטי:</strong> מבוסס על רמות תמיכה/התנגדות ו-ATR</li>
                        </ul>
                    </CardContent>
                </Card>
            </Stack>
        </Box>
    );
};

export default TradeAnalyzer;
