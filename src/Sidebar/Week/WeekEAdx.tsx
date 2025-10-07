import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    LinearProgress,
    Card,
    CardContent,
    Stack
} from '@mui/material';
import { TrendingUp, Remove, PlayArrow, Save } from '@mui/icons-material';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

// Interfaces

interface WeeklyADXResult {
    symbol: string;
    name: string;
    currentPrice: number;
    adxValue: number;
    diPlus: number;
    diMinus: number;
    trendStrength: 'Strong' | 'Moderate' | 'Weak';
    trendDirection: 'Bullish' | 'Bearish' | 'Neutral';
    LongAdxScore: number; // ציון Long מ-1 עד 100 עבור EAdx שבועי
    analysisDate: string;
    candleDate: string;
}

// Interface עבור נתוני OHLC שבועיים מקומיים
interface WeeklyLocalDataInfo {
    startDate: string;
    endDate: string;
    totalRecords: number;
    symbols: string[];
    frequency: 'weekly';
    lastUpdated: string;
}

// Interface עבור נתוני OHLC שבועיים
interface WeeklyOHLCData {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjusted_close?: number;
}

// פונקציות עזר לחישוב ADX שבועי
const calculateWeeklyTrueRange = (current: WeeklyOHLCData, previous: WeeklyOHLCData): number => {
    const tr1 = current.high - current.low;
    const tr2 = Math.abs(current.high - previous.close);
    const tr3 = Math.abs(current.low - previous.close);
    return Math.max(tr1, tr2, tr3);
};

const calculateWeeklyDM = (current: WeeklyOHLCData, previous: WeeklyOHLCData): { dmPlus: number, dmMinus: number } => {
    const highDiff = current.high - previous.high;
    const lowDiff = previous.low - current.low;
    
    const dmPlus = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    const dmMinus = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;
    
    return { dmPlus, dmMinus };
};

const calculateWeeklyADX = (ohlcData: WeeklyOHLCData[], period: number = 14): { adx: number, diPlus: number, diMinus: number } => {
    if (ohlcData.length < period + 1) return { adx: 0, diPlus: 0, diMinus: 0 };
    
    const trueRanges: number[] = [];
    const dmPlusValues: number[] = [];
    const dmMinusValues: number[] = [];
    
    // Calculate TR, DM+ and DM- for each period
    for (let i = 1; i < ohlcData.length; i++) {
        const tr = calculateWeeklyTrueRange(ohlcData[i], ohlcData[i - 1]);
        const dm = calculateWeeklyDM(ohlcData[i], ohlcData[i - 1]);
        
        trueRanges.push(tr);
        dmPlusValues.push(dm.dmPlus);
        dmMinusValues.push(dm.dmMinus);
    }
    
    if (trueRanges.length < period) return { adx: 0, diPlus: 0, diMinus: 0 };
    
    // Calculate initial smoothed values (SMA)
    let atr = 0;
    let smoothedDMPlus = 0;
    let smoothedDMMinus = 0;
    
    for (let i = 0; i < period; i++) {
        atr += trueRanges[i];
        smoothedDMPlus += dmPlusValues[i];
        smoothedDMMinus += dmMinusValues[i];
    }
    
    atr /= period;
    smoothedDMPlus /= period;
    smoothedDMMinus /= period;
    
    // Calculate DI+ and DI-
    const diPlus = (smoothedDMPlus / atr) * 100;
    const diMinus = (smoothedDMMinus / atr) * 100;
    
    // Calculate DX
    const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
    
    // Calculate ADX (simplified - using current DX as ADX for weekly analysis)
    const adx = dx;
    
    return { adx, diPlus, diMinus };
};

export default function WeekEAdx() {
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStock, setCurrentStock] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<WeeklyADXResult[]>([]);
    const [localDataInfo, setLocalDataInfo] = useState<WeeklyLocalDataInfo | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // טעינת מידע על נתונים מקומיים שבועיים
    const loadWeeklyLocalDataInfo = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            console.log('🔍 Loading weekly local data info...');
            
            // Dynamic import of weekly data
            const weeklyData = await import('../../Stocks/Util/weekly_stock_data.json');
            const data = weeklyData as any;
            
            if (data && data.metadata && data.data) {
                const info: WeeklyLocalDataInfo = {
                    startDate: data.metadata.startDate,
                    endDate: data.metadata.endDate,
                    totalRecords: data.metadata.totalRecords,
                    symbols: data.metadata.symbols,
                    frequency: 'weekly',
                    lastUpdated: data.metadata.lastUpdated
                };
                
                console.log('✅ Weekly local data loaded:', info);
                setLocalDataInfo(info);
            } else {
                throw new Error('Invalid weekly data structure');
            }
            
        } catch (error) {
            console.error('❌ Error loading weekly local data:', error);
            setError(`שגיאה בטעינת נתונים שבועיים: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadWeeklyLocalDataInfo();
    }, []);

    // פונקציה לחישוב ADX שבועי למניה
    const calculateWeeklyADXAnalysis = (ohlcData: WeeklyOHLCData[]): WeeklyADXResult | null => {
        if (ohlcData.length < 15) {
            return null;
        }

        const currentPrice = ohlcData[ohlcData.length - 1].close;
        const currentDate = ohlcData[ohlcData.length - 1].date;
        const symbol = ohlcData[ohlcData.length - 1].symbol;

        // חישוב ADX שבועי
        const adxData = calculateWeeklyADX(ohlcData, 14);
        
        if (adxData.adx === 0) {
            return null;
        }

        // זיהוי חוזק מגמה
        let trendStrength: 'Strong' | 'Moderate' | 'Weak' = 'Weak';
        if (adxData.adx >= 25) {
            trendStrength = 'Strong';
        } else if (adxData.adx >= 15) {
            trendStrength = 'Moderate';
        }

        // זיהוי כיוון מגמה
        let trendDirection: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
        if (adxData.diPlus > adxData.diMinus) {
            trendDirection = 'Bullish';
        } else if (adxData.diMinus > adxData.diPlus) {
            trendDirection = 'Bearish';
        }

        // חישוב ציון LongAdx שבועי
        let LongAdxScore = 50; // נקודת התחלה נייטרלית
        
        // ADX strength scoring
        if (trendStrength === 'Strong') {
            LongAdxScore += 20; // Strong trend
        } else if (trendStrength === 'Moderate') {
            LongAdxScore += 10; // Moderate trend
        } else {
            LongAdxScore -= 10; // Weak trend
        }

        // Direction scoring for long positions
        if (trendDirection === 'Bullish') {
            LongAdxScore += 25; // Bullish trend is good for long
        } else if (trendDirection === 'Bearish') {
            LongAdxScore -= 25; // Bearish trend is bad for long
        }

        // DI+ vs DI- difference scoring
        const diDifference = Math.abs(adxData.diPlus - adxData.diMinus);
        if (diDifference > 10) {
            LongAdxScore += 10; // Clear directional bias
        } else if (diDifference < 5) {
            LongAdxScore -= 10; // Unclear direction
        }

        // Normalize score to 0-100 range
        LongAdxScore = Math.max(0, Math.min(100, LongAdxScore));

        return {
            symbol: symbol,
            name: symbol,
            currentPrice: currentPrice,
            adxValue: Math.round(adxData.adx * 100) / 100,
            diPlus: Math.round(adxData.diPlus * 100) / 100,
            diMinus: Math.round(adxData.diMinus * 100) / 100,
            trendStrength: trendStrength,
            trendDirection: trendDirection,
            LongAdxScore: Math.round(LongAdxScore * 10) / 10,
            analysisDate: new Date().toISOString().split('T')[0],
            candleDate: currentDate
        };
    };

    // הרצת ניתוח EAdx שבועי
    const runWeeklyEAdxAnalysis = async () => {
        if (!localDataInfo) {
            setError('נתונים שבועיים לא נטענו');
            return;
        }

        setIsAnalyzing(true);
        setProgress(0);
        setError(null);
        setResults([]);

        try {
            console.log('🚀 Starting weekly EAdx analysis...');
            
            // טעינת נתונים שבועיים
            const weeklyData = await import('../../Stocks/Util/weekly_stock_data.json');
            const data = weeklyData as any;
            const allWeeklyData: WeeklyOHLCData[] = data.data || [];

            // קבלת רשימת מניות (ללא SPY)
            const stockSymbols = localDataInfo.symbols.filter(symbol => symbol !== 'SPY');
            
            const analysisResults: WeeklyADXResult[] = [];

            // ניתוח כל מניה
            for (let i = 0; i < stockSymbols.length; i++) {
                const symbol = stockSymbols[i];
                setCurrentStock(`${symbol} (${i + 1}/${stockSymbols.length})`);
                
                // קבלת נתוני המניה
                const stockData = allWeeklyData.filter(item => item.symbol === symbol);
                
                if (stockData.length >= 15) {
                    const result = calculateWeeklyADXAnalysis(stockData);
                    if (result) {
                        analysisResults.push(result);
                    }
                }
                
                setProgress(((i + 1) / stockSymbols.length) * 100);
                
                // השהיה קצרה
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            console.log(`✅ Weekly EAdx analysis completed: ${analysisResults.length} stocks analyzed`);
            setResults(analysisResults);
            setProgress(100);

        } catch (error) {
            console.error('❌ Error in weekly EAdx analysis:', error);
            setError(`שגיאה בניתוח EAdx שבועי: ${error}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // שמירה ל-Firebase
    const saveToFirebase = async () => {
        if (results.length === 0) {
            setError('אין תוצאות לשמירה');
            return;
        }

        setIsSaving(true);
        try {
            console.log('💾 Saving weekly EAdx results to Firebase...');

            const firebaseData = {
                candleDate: results[0].candleDate,
                calculationDate: new Date().toISOString().split('T')[0],
                totalStocks: results.length,
                analysisType: 'weekly_eadx',
                frequency: 'weekly',
                results: results,
                metadata: {
                    startDate: localDataInfo?.startDate,
                    endDate: localDataInfo?.endDate,
                    totalRecords: localDataInfo?.totalRecords,
                    lastUpdated: new Date().toISOString()
                }
            };

            const documentId = `${results[0].candleDate}_weekly_relative_strength`;
            await updateDoc(doc(getFirestore(), 'week_relative-strength', documentId), firebaseData);
            
            console.log(`✅ Saved weekly EAdx results to Firebase: ${documentId}`);
            
        } catch (error) {
            console.error('❌ Error saving to Firebase:', error);
            setError(`שגיאה בשמירה ל-Firebase: ${error}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Weekly EAdx Analysis
                </Typography>
                <LinearProgress />
                <Typography variant="body1" sx={{ mt: 2 }}>
                    טוען נתונים שבועיים...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Weekly EAdx Analysis
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
                ניתוח חוזק מגמה שבועי למניות (ADX + DI+ + DI-)
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Weekly Data Info */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        📊 Weekly Data Available
                    </Typography>
                    
                    {localDataInfo ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                📊 <strong>Weekly Data Available</strong><br/>
                                📅 <strong>Date Range:</strong> {localDataInfo.startDate} - {localDataInfo.endDate}<br/>
                                📈 <strong>Total Records:</strong> {localDataInfo.totalRecords.toLocaleString()}<br/>
                                🏢 <strong>Stocks:</strong> {localDataInfo.symbols.length}<br/>
                                📁 <strong>Location:</strong> src/Stocks/Util/weekly_stock_data.json
                            </Typography>
                        </Alert>
                    ) : (
                        <Alert severity="warning">
                            <Typography variant="body2">
                                ⚠️ <strong>No Weekly Data Found</strong><br/>
                                Make sure there's a file at src/Stocks/Util/weekly_stock_data.json
                            </Typography>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Analysis Controls */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🎯 Weekly EAdx Analysis
                    </Typography>
                    
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        ינתח חוזק מגמה שבועי לכל המניות (ADX + DI+ + DI-)
                    </Typography>

                    {isAnalyzing && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                {currentStock}
                            </Typography>
                            <LinearProgress 
                                variant="determinate" 
                                value={progress} 
                                sx={{ mb: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                {Math.round(progress)}% completed
                            </Typography>
                        </Box>
                    )}

                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<PlayArrow />}
                            onClick={runWeeklyEAdxAnalysis}
                            disabled={isAnalyzing || !localDataInfo}
                        >
                            {isAnalyzing ? 'מנתח...' : 'הרץ ניתוח EAdx שבועי'}
                        </Button>

                        {results.length > 0 && (
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<Save />}
                                onClick={saveToFirebase}
                                disabled={isSaving}
                            >
                                {isSaving ? 'שומר...' : 'שמור ל-Firebase'}
                            </Button>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* Results */}
            {results.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            📊 Weekly EAdx Results ({results.length} stocks)
                        </Typography>

                        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Stock</TableCell>
                                        <TableCell>Current Price</TableCell>
                                        <TableCell>ADX</TableCell>
                                        <TableCell>DI+</TableCell>
                                        <TableCell>DI-</TableCell>
                                        <TableCell>Trend Strength</TableCell>
                                        <TableCell>Trend Direction</TableCell>
                                        <TableCell>ADX Score</TableCell>
                                        <TableCell>Signal</TableCell>
                                        <TableCell>Date</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {results.map((result, index) => (
                                        <TableRow key={`${result.symbol}-${index}`}>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                    {result.symbol}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${result.currentPrice.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {result.adxValue.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {result.diPlus.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {result.diMinus.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.trendStrength}
                                                    color={
                                                        result.trendStrength === 'Strong' ? 'success' :
                                                        result.trendStrength === 'Moderate' ? 'warning' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.trendDirection}
                                                    color={
                                                        result.trendDirection === 'Bullish' ? 'success' :
                                                        result.trendDirection === 'Bearish' ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongAdxScore.toFixed(1)}
                                                    color={
                                                        result.LongAdxScore >= 70 ? 'success' :
                                                        result.LongAdxScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {result.LongAdxScore >= 70 ? (
                                                    <TrendingUp color="success" />
                                                ) : result.LongAdxScore <= 30 ? (
                                                    <Remove color="error" />
                                                ) : (
                                                    <Remove color="disabled" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {result.candleDate}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}