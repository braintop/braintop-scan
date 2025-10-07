import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Stack,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    LinearProgress
} from '@mui/material';
import { PlayArrow, Save, TrendingUp, Remove } from '@mui/icons-material';
import { db } from '../../Api/api';
import { doc, updateDoc } from 'firebase/firestore';

// Interface עבור מניה מועדפת שבועית
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

// Interface עבור תוצאות חישוב תנודתיות שבועי - פישוט ל-Long בלבד
interface WeeklyVolatilityResult {
    symbol: string;
    name: string;
    currentPrice: number;
    atr: number;
    atrRatio: number; // ATR/Price %
    bbWidth: number; // Bollinger Bands Width %
    bbPosition: number; // %b position (0-1)
    LongAtrPriceScore: number; // ציון Long מ-1 עד 100 עבור CAtrPrice שבועי
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

// פונקציות עזר לחישוב תנודתיות שבועי
const calculateWeeklyATR = (ohlcData: WeeklyOHLCData[], period: number = 14): number => {
    if (ohlcData.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < ohlcData.length; i++) {
        const current = ohlcData[i];
        const previous = ohlcData[i - 1];
        
        const tr1 = current.high - current.low;
        const tr2 = Math.abs(current.high - previous.close);
        const tr3 = Math.abs(current.low - previous.close);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
    }
    
    if (trueRanges.length < period) return 0;
    
    // חישוב ATR ממוצע פשוט
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
};

const calculateWeeklyBollingerBands = (ohlcData: WeeklyOHLCData[], period: number = 20, stdDev: number = 2) => {
    if (ohlcData.length < period) return { upper: 0, middle: 0, lower: 0, width: 0, position: 0 };
    
    const closes = ohlcData.slice(-period).map(candle => candle.close);
    const mean = closes.reduce((sum, close) => sum + close, 0) / closes.length;
    
    const variance = closes.reduce((sum, close) => sum + Math.pow(close - mean, 2), 0) / closes.length;
    const standardDeviation = Math.sqrt(variance);
    
    const upper = mean + (stdDev * standardDeviation);
    const lower = mean - (stdDev * standardDeviation);
    const width = ((upper - lower) / mean) * 100;
    
    const currentPrice = ohlcData[ohlcData.length - 1].close;
    const position = (currentPrice - lower) / (upper - lower);
    
    return { upper, middle: mean, lower, width, position: Math.max(0, Math.min(1, position)) };
};

export default function WeekCAtrPrice() {
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStock, setCurrentStock] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<WeeklyVolatilityResult[]>([]);
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

    // פונקציה לחישוב תנודתיות שבועי למניה
    const calculateWeeklyVolatility = (ohlcData: WeeklyOHLCData[]): WeeklyVolatilityResult | null => {
        if (ohlcData.length < 20) {
            return null;
        }

        const currentPrice = ohlcData[ohlcData.length - 1].close;
        const currentDate = ohlcData[ohlcData.length - 1].date;
        const symbol = ohlcData[ohlcData.length - 1].symbol;

        // חישוב ATR שבועי
        const atr = calculateWeeklyATR(ohlcData, 14);
        const atrRatio = (atr / currentPrice) * 100;

        // חישוב Bollinger Bands שבועי
        const bb = calculateWeeklyBollingerBands(ohlcData, 20, 2);

        // חישוב ציון LongAtrPrice שבועי
        let LongAtrPriceScore = 50; // נקודת התחלה נייטרלית
        
        // ATR Ratio scoring (lower ATR ratio = higher score for long positions)
        if (atrRatio <= 2) {
            LongAtrPriceScore += 20; // Very low volatility
        } else if (atrRatio <= 3) {
            LongAtrPriceScore += 10; // Low volatility
        } else if (atrRatio >= 8) {
            LongAtrPriceScore -= 20; // Very high volatility
        } else if (atrRatio >= 6) {
            LongAtrPriceScore -= 10; // High volatility
        }

        // Bollinger Bands position scoring (closer to lower band = higher score for long)
        if (bb.position <= 0.2) {
            LongAtrPriceScore += 15; // Near lower band - good for long
        } else if (bb.position >= 0.8) {
            LongAtrPriceScore -= 15; // Near upper band - risk for long
        }

        // Bollinger Bands width scoring (narrower bands = higher score for long)
        if (bb.width <= 3) {
            LongAtrPriceScore += 10; // Very narrow bands
        } else if (bb.width >= 8) {
            LongAtrPriceScore -= 10; // Very wide bands
        }

        // Normalize score to 0-100 range
        LongAtrPriceScore = Math.max(0, Math.min(100, LongAtrPriceScore));

        return {
            symbol: symbol,
            name: symbol,
            currentPrice: currentPrice,
            atr: atr,
            atrRatio: Math.round(atrRatio * 100) / 100,
            bbWidth: Math.round(bb.width * 100) / 100,
            bbPosition: Math.round(bb.position * 100) / 100,
            LongAtrPriceScore: Math.round(LongAtrPriceScore * 10) / 10,
            analysisDate: new Date().toISOString().split('T')[0],
            candleDate: currentDate
        };
    };

    // הרצת ניתוח CAtrPrice שבועי
    const runWeeklyCAtrPriceAnalysis = async () => {
        if (!localDataInfo) {
            setError('נתונים שבועיים לא נטענו');
            return;
        }

        setIsAnalyzing(true);
        setProgress(0);
        setError(null);
        setResults([]);

        try {
            console.log('🚀 Starting weekly CAtrPrice analysis...');
            
            // טעינת נתונים שבועיים
            const weeklyData = await import('../../Stocks/Util/weekly_stock_data.json');
            const allWeeklyData: WeeklyOHLCData[] = weeklyData.data || [];

            // קבלת רשימת מניות (ללא SPY)
            const stockSymbols = localDataInfo.symbols.filter(symbol => symbol !== 'SPY');
            
            const analysisResults: WeeklyVolatilityResult[] = [];

            // ניתוח כל מניה
            for (let i = 0; i < stockSymbols.length; i++) {
                const symbol = stockSymbols[i];
                setCurrentStock(`${symbol} (${i + 1}/${stockSymbols.length})`);
                
                // קבלת נתוני המניה
                const stockData = allWeeklyData.filter(item => item.symbol === symbol);
                
                if (stockData.length >= 20) {
                    const result = calculateWeeklyVolatility(stockData);
                    if (result) {
                        analysisResults.push(result);
                    }
                }
                
                setProgress(((i + 1) / stockSymbols.length) * 100);
                
                // השהיה קצרה
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            console.log(`✅ Weekly CAtrPrice analysis completed: ${analysisResults.length} stocks analyzed`);
            setResults(analysisResults);
            setProgress(100);

        } catch (error) {
            console.error('❌ Error in weekly CAtrPrice analysis:', error);
            setError(`שגיאה בניתוח CAtrPrice שבועי: ${error}`);
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
            console.log('💾 Saving weekly CAtrPrice results to Firebase...');

            const firebaseData = {
                candleDate: results[0].candleDate,
                calculationDate: new Date().toISOString().split('T')[0],
                totalStocks: results.length,
                analysisType: 'weekly_catrprice',
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
            await updateDoc(doc(db, 'week_relative-strength', documentId), firebaseData);
            
            console.log(`✅ Saved weekly CAtrPrice results to Firebase: ${documentId}`);
            
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
                    Weekly CAtrPrice Analysis
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
                Weekly CAtrPrice Analysis
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
                ניתוח תנודתיות שבועי למניות (ATR + Bollinger Bands)
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
                        🎯 Weekly CAtrPrice Analysis
                    </Typography>
                    
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        ינתח תנודתיות שבועי לכל המניות (ATR + Bollinger Bands)
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
                            onClick={runWeeklyCAtrPriceAnalysis}
                            disabled={isAnalyzing || !localDataInfo}
                        >
                            {isAnalyzing ? 'מנתח...' : 'הרץ ניתוח CAtrPrice שבועי'}
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
                            📊 Weekly CAtrPrice Results ({results.length} stocks)
                        </Typography>

                        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Stock</TableCell>
                                        <TableCell>Current Price</TableCell>
                                        <TableCell>ATR</TableCell>
                                        <TableCell>ATR Ratio %</TableCell>
                                        <TableCell>BB Width %</TableCell>
                                        <TableCell>BB Position</TableCell>
                                        <TableCell>CAtrPrice Score</TableCell>
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
                                                    {result.atr.toFixed(3)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {result.atrRatio.toFixed(2)}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {result.bbWidth.toFixed(2)}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {(result.bbPosition * 100).toFixed(1)}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongAtrPriceScore.toFixed(1)}
                                                    color={
                                                        result.LongAtrPriceScore >= 70 ? 'success' :
                                                        result.LongAtrPriceScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {result.LongAtrPriceScore >= 70 ? (
                                                    <TrendingUp color="success" />
                                                ) : result.LongAtrPriceScore <= 30 ? (
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