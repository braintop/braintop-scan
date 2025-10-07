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
import { PlayArrow, Save, TrendingUp, TrendingDown, Remove } from '@mui/icons-material';
import { db } from '../../Api/api';
import { setDoc, doc } from 'firebase/firestore';

// Interface עבור מניה מתוצאות AScan
// interface StockFromScan {
//     candleDate: string;
//     scanDate: string;
//     symbol: string;
//     name: string;
//     price: number;
//     market: string;
//     volume: number;
//     dollarVolume: number;
//     float: number;
//     spread: number;
//     passed: boolean;
//     marketCap?: number;
//     avgVolume20?: number;
// }

// Interface עבור תוצאות חוזק יחסי שבועי
interface WeeklyRelativeStrengthResult {
    symbol: string;
    name: string;
    currentPrice: number;
    previousPrice: number;
    stockReturn: number;
    spyReturn: number;
    relativeStrength: number;
    bSpyScore: number;
    candleDate: string;
    calculationDate: string;
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

export default function WeekBSpy() {
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStock, setCurrentStock] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<WeeklyRelativeStrengthResult[]>([]);
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

    // פונקציה לחישוב יחס חוזק שבועי למניה
    const calculateWeeklyRelativeStrength = (stockData: WeeklyOHLCData[], spyData: WeeklyOHLCData[]): WeeklyRelativeStrengthResult | null => {
        if (stockData.length < 2 || spyData.length < 2) {
            return null;
        }

        // נתונים שבועיים - נשתמש בשבוע הנוכחי והשבוע הקודם
        const currentStockWeek = stockData[stockData.length - 1];
        const previousStockWeek = stockData[stockData.length - 2];
        const currentSpyWeek = spyData[spyData.length - 1];
        const previousSpyWeek = spyData[spyData.length - 2];

        // חישוב תשואות שבועיות
        const stockReturn = ((currentStockWeek.close - previousStockWeek.close) / previousStockWeek.close) * 100;
        const spyReturn = ((currentSpyWeek.close - previousSpyWeek.close) / previousSpyWeek.close) * 100;

        // חישוב יחס חוזק שבועי
        const relativeStrength = stockReturn - spyReturn;

        // חישוב ציון BSpy שבועי (0-100)
        let bSpyScore = 50; // נקודת התחלה נייטרלית
        
        if (relativeStrength > 2) {
            bSpyScore = Math.min(100, 50 + (relativeStrength * 10));
        } else if (relativeStrength < -2) {
            bSpyScore = Math.max(0, 50 + (relativeStrength * 10));
        }

        return {
            symbol: currentStockWeek.symbol,
            name: currentStockWeek.symbol,
            currentPrice: currentStockWeek.close,
            previousPrice: previousStockWeek.close,
            stockReturn: stockReturn,
            spyReturn: spyReturn,
            relativeStrength: relativeStrength,
            bSpyScore: Math.round(bSpyScore * 10) / 10,
            candleDate: currentStockWeek.date,
            calculationDate: new Date().toISOString().split('T')[0]
        };
    };

    // הרצת ניתוח BSpy שבועי
    const runWeeklyBSpyAnalysis = async () => {
        if (!localDataInfo) {
            setError('נתונים שבועיים לא נטענו');
            return;
        }

        setIsAnalyzing(true);
        setProgress(0);
        setError(null);
        setResults([]);

        try {
            console.log('🚀 Starting weekly BSpy analysis...');
            
            // טעינת נתונים שבועיים
            const weeklyData = await import('../../Stocks/Util/weekly_stock_data.json');
            const allWeeklyData: WeeklyOHLCData[] = weeklyData.data || [];

            // הפרדת נתוני SPY
            const spyData = allWeeklyData.filter(item => item.symbol === 'SPY');
            
            if (spyData.length < 2) {
                throw new Error('לא מספיק נתוני SPY שבועיים');
            }

            // קבלת רשימת מניות (ללא SPY)
            const stockSymbols = localDataInfo.symbols.filter(symbol => symbol !== 'SPY');
            
            const analysisResults: WeeklyRelativeStrengthResult[] = [];

            // ניתוח כל מניה
            for (let i = 0; i < stockSymbols.length; i++) {
                const symbol = stockSymbols[i];
                setCurrentStock(`${symbol} (${i + 1}/${stockSymbols.length})`);
                
                // קבלת נתוני המניה
                const stockData = allWeeklyData.filter(item => item.symbol === symbol);
                
                if (stockData.length >= 2) {
                    const result = calculateWeeklyRelativeStrength(stockData, spyData);
                    if (result) {
                        analysisResults.push(result);
                    }
                }
                
                setProgress(((i + 1) / stockSymbols.length) * 100);
                
                // השהיה קצרה
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            console.log(`✅ Weekly BSpy analysis completed: ${analysisResults.length} stocks analyzed`);
            setResults(analysisResults);
            setProgress(100);

        } catch (error) {
            console.error('❌ Error in weekly BSpy analysis:', error);
            setError(`שגיאה בניתוח BSpy שבועי: ${error}`);
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
            console.log('💾 Saving weekly BSpy results to Firebase...');

            const firebaseData = {
                candleDate: results[0].candleDate,
                calculationDate: new Date().toISOString().split('T')[0],
                totalStocks: results.length,
                analysisType: 'weekly_bspy',
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
            await setDoc(doc(db, 'week_relative-strength', documentId), firebaseData);
            
            console.log(`✅ Saved weekly BSpy results to Firebase: ${documentId}`);
            
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
                    Weekly BSpy Analysis
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
                Weekly BSpy Analysis
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
                ניתוח יחס חוזק שבועי למניות מול מדד SPY
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
                        🎯 Weekly BSpy Analysis
                    </Typography>
                    
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        ינתח יחס חוזק שבועי לכל המניות מול SPY
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
                            onClick={runWeeklyBSpyAnalysis}
                            disabled={isAnalyzing || !localDataInfo}
                        >
                            {isAnalyzing ? 'מנתח...' : 'הרץ ניתוח BSpy שבועי'}
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
                            📊 Weekly BSpy Results ({results.length} stocks)
                        </Typography>

                        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Stock</TableCell>
                                        <TableCell>Current Price</TableCell>
                                        <TableCell>Stock Return</TableCell>
                                        <TableCell>SPY Return</TableCell>
                                        <TableCell>Relative Strength</TableCell>
                                        <TableCell>BSpy Score</TableCell>
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
                                                <Typography 
                                                    variant="body2" 
                                                    color={result.stockReturn >= 0 ? 'success.main' : 'error.main'}
                                                >
                                                    {result.stockReturn >= 0 ? '+' : ''}{result.stockReturn.toFixed(2)}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2" 
                                                    color={result.spyReturn >= 0 ? 'success.main' : 'error.main'}
                                                >
                                                    {result.spyReturn >= 0 ? '+' : ''}{result.spyReturn.toFixed(2)}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2" 
                                                    color={result.relativeStrength >= 0 ? 'success.main' : 'error.main'}
                                                >
                                                    {result.relativeStrength >= 0 ? '+' : ''}{result.relativeStrength.toFixed(2)}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.bSpyScore.toFixed(1)}
                                                    color={
                                                        result.bSpyScore >= 70 ? 'success' :
                                                        result.bSpyScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {result.bSpyScore >= 70 ? (
                                                    <TrendingUp color="success" />
                                                ) : result.bSpyScore <= 30 ? (
                                                    <TrendingDown color="error" />
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