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
// interface WeeklyFavoriteStock {
//     symbol: string;
//     name: string;
//     price: number;
//     market: string;
//     volume: number;
//     dollarVolume: number;
//     float: number;
//     spread: number;
//     marketCap?: number;
//     avgVolume20?: number;
// }

interface WeeklyMomentumResult {
    symbol: string;
    name: string;
    currentPrice: number;
    sma3Current: number;
    sma3Previous: number;
    sma12Current: number;
    sma12Previous: number;
    crossoverType: 'Bullish' | 'Bearish' | 'None';
    macdHistogram: number;
    LongMomentumScore: number; // ציון Long מ-1 עד 100 עבור DSignals שבועי
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

// פונקציות עזר לחישוב MACD שבועי
const calculateWeeklyEMA = (values: number[], period: number): number[] => {
    if (values.length === 0) return [];
    
    const multiplier = 2 / (period + 1);
    const ema: number[] = [];
    
    // First EMA value is SMA
    let sum = 0;
    for (let i = 0; i < Math.min(period, values.length); i++) {
        sum += values[i];
    }
    ema[period - 1] = sum / period;
    
    // Calculate subsequent EMA values
    for (let i = period; i < values.length; i++) {
        ema[i] = (values[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
};

const calculateWeeklyMACD = (closes: number[]): { macdLine: number[], signalLine: number[], histogram: number[] } => {
    if (closes.length < 26) return { macdLine: [], signalLine: [], histogram: [] };
    
    // Dynamic parameters based on data length
    let fastPeriod = 8, slowPeriod = 16, signalPeriod = 6;
    
    if (closes.length >= 25) {
        fastPeriod = 8;
        slowPeriod = 16;
        signalPeriod = 6;
    } else if (closes.length >= 20) {
        fastPeriod = 6;
        slowPeriod = 12;
        signalPeriod = 4;
    } else {
        fastPeriod = 5;
        slowPeriod = 10;
        signalPeriod = 3;
    }
    
    const fastEMA = calculateWeeklyEMA(closes, fastPeriod);
    const slowEMA = calculateWeeklyEMA(closes, slowPeriod);
    
    const macdLine: number[] = [];
    for (let i = slowPeriod - 1; i < closes.length; i++) {
        macdLine.push(fastEMA[i] - slowEMA[i]);
    }
    
    if (macdLine.length < signalPeriod) {
        return { macdLine: [], signalLine: [], histogram: [] };
    }
    
    const signalLine = calculateWeeklyEMA(macdLine, signalPeriod);
    
    const histogram: number[] = [];
    for (let i = signalPeriod - 1; i < macdLine.length; i++) {
        histogram.push(macdLine[i] - signalLine[i - (signalPeriod - 1)]);
    }
    
    return { macdLine, signalLine, histogram };
};

const calculateWeeklySMA = (values: number[], period: number): number[] => {
    const sma: number[] = [];
    
    for (let i = period - 1; i < values.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += values[i - j];
        }
        sma.push(sum / period);
    }
    
    return sma;
};

export default function WeekDSignals() {
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStock, setCurrentStock] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<WeeklyMomentumResult[]>([]);
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
            
            if (weeklyData && weeklyData.metadata && weeklyData.data) {
                const info: WeeklyLocalDataInfo = {
                    startDate: weeklyData.metadata.startDate,
                    endDate: weeklyData.metadata.endDate,
                    totalRecords: weeklyData.metadata.totalRecords,
                    symbols: weeklyData.metadata.symbols,
                    frequency: 'weekly',
                    lastUpdated: weeklyData.metadata.lastUpdated
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

    // פונקציה לחישוב מומנטום שבועי למניה
    const calculateWeeklyMomentum = (ohlcData: WeeklyOHLCData[]): WeeklyMomentumResult | null => {
        if (ohlcData.length < 15) {
            return null;
        }

        const closes = ohlcData.map(candle => candle.close);
        const currentPrice = closes[closes.length - 1];
        const currentDate = ohlcData[ohlcData.length - 1].date;
        const symbol = ohlcData[ohlcData.length - 1].symbol;

        // חישוב SMA שבועי
        const sma3 = calculateWeeklySMA(closes, 3);
        const sma12 = calculateWeeklySMA(closes, 12);
        
        if (sma3.length < 2 || sma12.length < 2) {
            return null;
        }

        const sma3Current = sma3[sma3.length - 1];
        const sma3Previous = sma3[sma3.length - 2];
        const sma12Current = sma12[sma12.length - 1];
        const sma12Previous = sma12[sma12.length - 2];

        // חישוב MACD שבועי
        const macd = calculateWeeklyMACD(closes);
        const macdHistogram = macd.histogram.length > 0 ? macd.histogram[macd.histogram.length - 1] : 0;

        // זיהוי crossover
        let crossoverType: 'Bullish' | 'Bearish' | 'None' = 'None';
        
        if (sma3Previous <= sma12Previous && sma3Current > sma12Current) {
            crossoverType = 'Bullish';
        } else if (sma3Previous >= sma12Previous && sma3Current < sma12Current) {
            crossoverType = 'Bearish';
        }

        // חישוב ציון LongMomentum שבועי
        let LongMomentumScore = 50; // נקודת התחלה נייטרלית
        
        // SMA Crossover scoring
        if (crossoverType === 'Bullish') {
            LongMomentumScore += 25; // Strong bullish signal
        } else if (crossoverType === 'Bearish') {
            LongMomentumScore -= 25; // Strong bearish signal
        }

        // MACD Histogram scoring
        if (macdHistogram > 0) {
            LongMomentumScore += 15; // Positive momentum
        } else if (macdHistogram < 0) {
            LongMomentumScore -= 15; // Negative momentum
        }

        // SMA trend scoring (3 vs 12)
        const sma3vs12 = ((sma3Current - sma12Current) / sma12Current) * 100;
        if (sma3vs12 > 2) {
            LongMomentumScore += 10; // Strong upward trend
        } else if (sma3vs12 < -2) {
            LongMomentumScore -= 10; // Strong downward trend
        }

        // Normalize score to 0-100 range
        LongMomentumScore = Math.max(0, Math.min(100, LongMomentumScore));

        return {
            symbol: symbol,
            name: symbol,
            currentPrice: currentPrice,
            sma3Current: sma3Current,
            sma3Previous: sma3Previous,
            sma12Current: sma12Current,
            sma12Previous: sma12Previous,
            crossoverType: crossoverType,
            macdHistogram: Math.round(macdHistogram * 1000) / 1000,
            LongMomentumScore: Math.round(LongMomentumScore * 10) / 10,
            analysisDate: new Date().toISOString().split('T')[0],
            candleDate: currentDate
        };
    };

    // הרצת ניתוח DSignals שבועי
    const runWeeklyDSignalsAnalysis = async () => {
        if (!localDataInfo) {
            setError('נתונים שבועיים לא נטענו');
            return;
        }

        setIsAnalyzing(true);
        setProgress(0);
        setError(null);
        setResults([]);

        try {
            console.log('🚀 Starting weekly DSignals analysis...');
            
            // טעינת נתונים שבועיים
            const weeklyData = await import('../../Stocks/Util/weekly_stock_data.json');
            const allWeeklyData: WeeklyOHLCData[] = weeklyData.data || [];

            // קבלת רשימת מניות (ללא SPY)
            const stockSymbols = localDataInfo.symbols.filter(symbol => symbol !== 'SPY');
            
            const analysisResults: WeeklyMomentumResult[] = [];

            // ניתוח כל מניה
            for (let i = 0; i < stockSymbols.length; i++) {
                const symbol = stockSymbols[i];
                setCurrentStock(`${symbol} (${i + 1}/${stockSymbols.length})`);
                
                // קבלת נתוני המניה
                const stockData = allWeeklyData.filter(item => item.symbol === symbol);
                
                if (stockData.length >= 15) {
                    const result = calculateWeeklyMomentum(stockData);
                    if (result) {
                        analysisResults.push(result);
                    }
                }
                
                setProgress(((i + 1) / stockSymbols.length) * 100);
                
                // השהיה קצרה
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            console.log(`✅ Weekly DSignals analysis completed: ${analysisResults.length} stocks analyzed`);
            setResults(analysisResults);
            setProgress(100);

        } catch (error) {
            console.error('❌ Error in weekly DSignals analysis:', error);
            setError(`שגיאה בניתוח DSignals שבועי: ${error}`);
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
            console.log('💾 Saving weekly DSignals results to Firebase...');

            const firebaseData = {
                candleDate: results[0].candleDate,
                calculationDate: new Date().toISOString().split('T')[0],
                totalStocks: results.length,
                analysisType: 'weekly_dsignals',
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
            
            console.log(`✅ Saved weekly DSignals results to Firebase: ${documentId}`);
            
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
                    Weekly DSignals Analysis
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
                Weekly DSignals Analysis
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
                ניתוח מומנטום שבועי למניות (SMA + MACD)
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
                        🎯 Weekly DSignals Analysis
                    </Typography>
                    
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        ינתח מומנטום שבועי לכל המניות (SMA + MACD)
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
                            onClick={runWeeklyDSignalsAnalysis}
                            disabled={isAnalyzing || !localDataInfo}
                        >
                            {isAnalyzing ? 'מנתח...' : 'הרץ ניתוח DSignals שבועי'}
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
                            📊 Weekly DSignals Results ({results.length} stocks)
                        </Typography>

                        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Stock</TableCell>
                                        <TableCell>Current Price</TableCell>
                                        <TableCell>SMA 3</TableCell>
                                        <TableCell>SMA 12</TableCell>
                                        <TableCell>Crossover</TableCell>
                                        <TableCell>MACD Histogram</TableCell>
                                        <TableCell>Momentum Score</TableCell>
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
                                                    ${result.sma3Current.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${result.sma12Current.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.crossoverType}
                                                    color={
                                                        result.crossoverType === 'Bullish' ? 'success' :
                                                        result.crossoverType === 'Bearish' ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2" 
                                                    color={result.macdHistogram >= 0 ? 'success.main' : 'error.main'}
                                                >
                                                    {result.macdHistogram.toFixed(3)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongMomentumScore.toFixed(1)}
                                                    color={
                                                        result.LongMomentumScore >= 70 ? 'success' :
                                                        result.LongMomentumScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {result.LongMomentumScore >= 70 ? (
                                                    <TrendingUp color="success" />
                                                ) : result.LongMomentumScore <= 30 ? (
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