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
import { db } from '../../../Api/api';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
// polygonApi removed - using only local data
import * as CAtrPriceLogic from '../Logic/CAtrPriceLogic';

// Interface עבור מניה מועדפת
interface FavoriteStock {
    symbol: string;
    name: string;
    price: number;
    market: string;
    volume: number;
    dollarVolume: number;
    float: number;
    spread: number;
    marketCap?: number;
    avgVolume20?: number;
}

// Interface עבור תוצאות חישוב תנודתיות - פישוט ל-Long בלבד
interface VolatilityResult {
    symbol: string;
    name: string;
    currentPrice: number;
    atr: number;
    atrRatio: number; // ATR/Price %
    bbWidth: number; // Bollinger Bands Width %
    bbPosition: number; // %b position (0-1)
    LongAtrPriceScore: number; // ציון Long מ-1 עד 100 עבור CAtrPrice
    analysisDate: string;
    calculationDate: string;
}

// Interface עבור נתונים מקומיים
interface LocalStockData {
    metadata: {
        symbols: string[];
        totalRecords: number;
        startDate: string;
        endDate: string;
        lastUpdate: string;
    };
    data: Array<{
        date: string;
        symbol: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        adjusted_close: number;
    }>;
}

const CAtrPrice = () => {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [favoriteStocks, setFavoriteStocks] = useState<FavoriteStock[]>([]);
    const [volatilityResults, setVolatilityResults] = useState<VolatilityResult[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [currentStock, setCurrentStock] = useState<string>('');
    const [localData, setLocalData] = useState<LocalStockData | null>(null);
    const [dataIndex, setDataIndex] = useState<{[symbol: string]: {[date: string]: any}}>({});
    // dataSource removed - using only local data
    
    // State for sorting
    const [sortConfig, setSortConfig] = useState<{
        key: string;
        direction: 'asc' | 'desc' | null;
    }>({ key: 'LongAtrPriceScore', direction: 'desc' });

    useEffect(() => {
        loadFavoriteStocks();
        loadLocalData();
    }, []);

    // פונקציות מיון
    const handleSort = (key: string) => {
        setSortConfig(prevConfig => {
            if (prevConfig.key === key) {
                return {
                    key,
                    direction: prevConfig.direction === 'asc' ? 'desc' : 
                              prevConfig.direction === 'desc' ? null : 'asc'
                };
            }
            return { key, direction: 'asc' };
        });
    };

    const getSortIcon = (key: string) => {
        if (sortConfig.key !== key) return '↕️';
        if (sortConfig.direction === 'asc') return '↑';
        if (sortConfig.direction === 'desc') return '↓';
        return '↕️';
    };

    const sortData = (data: VolatilityResult[]) => {
        if (!sortConfig.key || !sortConfig.direction) {
            return data;
        }

        return [...data].sort((a, b) => {
            let aValue = a[sortConfig.key as keyof VolatilityResult];
            let bValue = b[sortConfig.key as keyof VolatilityResult];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                aValue = aValue.toLowerCase() as any;
                bValue = bValue.toLowerCase() as any;
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    };

    // טעינת מניות מועדפות מFirebase
    const loadFavoriteStocks = async () => {
        try {
            console.log('🔍 Loading favorite stocks for CAtrPrice...');
            setError(null);
            
            const docSnap = await getDocs(collection(db, 'favorite'));
            
            let foundStocks: FavoriteStock[] = [];
            docSnap.forEach((doc) => {
                if (doc.id === 'my-favorites') {
                    const data = doc.data();
                    if (data.stocks && Array.isArray(data.stocks)) {
                        foundStocks = data.stocks.map((stock: any) => ({
                            symbol: stock.symbol,
                            name: stock.name,
                            price: stock.price || 0,
                            market: stock.market || 'NASDAQ',
                            volume: stock.volume || 0,
                            dollarVolume: stock.dollarVolume || 0,
                            float: stock.float || 0,
                            spread: stock.spread || 0,
                            marketCap: stock.marketCap,
                            avgVolume20: stock.avgVolume20
                        }));
                    }
                }
            });
            
            setFavoriteStocks(foundStocks);
            console.log(`✅ Loaded ${foundStocks.length} favorite stocks for CAtrPrice`);
            
        } catch (error) {
            console.error('❌ Error loading favorite stocks:', error);
            setError('שגיאה בטעינת מניות מועדפות');
        }
    };

    // טעינת נתונים מקומיים מהקובץ הגדול
    const loadLocalData = async () => {
        try {
            console.log('📁 Loading local data from single large file for CAtrPrice...');
            const startTime = Date.now();
            
            // טעינת הקובץ הגדול
            const timestamp = new Date().getTime();
            const localDataModule = await import(/* @vite-ignore */ `../../../Stocks/Util/local_stock_data.json?t=${timestamp}`);
            const localStockData = localDataModule.default;
            
            if (localStockData && localStockData.data && Array.isArray(localStockData.data)) {
                setLocalData(localStockData);
                
                // יצירת אינדקס מהיר O(1) lookup
                console.log('🔧 Creating data index for fast lookup...');
                const indexStartTime = Date.now();
                
                const index: {[symbol: string]: {[date: string]: any}} = {};
                localStockData.data.forEach((item: any) => {
                    if (!index[item.symbol]) {
                        index[item.symbol] = {};
                    }
                    index[item.symbol][item.date] = item;
                });
                
                setDataIndex(index);
                // dataSource is always 'local' now
                
                const indexTime = Date.now() - indexStartTime;
                const totalTime = Date.now() - startTime;
                
                console.log('✅ Local data loaded and indexed for CAtrPrice:', {
                    symbols: localStockData.metadata.symbols.length,
                    records: localStockData.metadata.totalRecords,
                    dateRange: `${localStockData.metadata.startDate} to ${localStockData.metadata.endDate}`,
                    indexTime: `${indexTime}ms`,
                    totalTime: `${totalTime}ms`,
                    indexedSymbols: Object.keys(index).length
                });
            } else {
                throw new Error('Invalid local data structure');
            }
        } catch (error) {
            console.error('❌ Error loading local data:', error);
            // dataSource is always 'local' now
        }
    };

    // פונקציה לקבלת נתונים היסטוריים מקומיים
    const getLocalHistoricalData = (symbol: string, targetDate: string, days: number) => {
        if (!dataIndex[symbol]) return [];
        
        // קבלת כל התאריכים הזמינים עבור המניה
        const availableDates = Object.keys(dataIndex[symbol]).sort();
        
        // מציאת התאריך הקרוב ביותר לתאריך המטרה (או לפניו)
        const targetDateObj = new Date(targetDate);
        let closestDate = null;
        let closestIndex = -1;
        
        for (let i = availableDates.length - 1; i >= 0; i--) {
            const dateObj = new Date(availableDates[i]);
            if (dateObj <= targetDateObj) {
                closestDate = availableDates[i];
                closestIndex = i;
                break;
            }
        }
        
        if (!closestDate || closestIndex === -1) return [];
        
        // קבלת הימים האחרונים (עד התאריך הקרוב ביותר)
        const startIndex = Math.max(0, closestIndex - days + 1);
        const endIndex = closestIndex + 1;
        
        const results = availableDates.slice(startIndex, endIndex).map(date => dataIndex[symbol][date]);
        
        console.log(`📊 ${symbol} historical data:`, {
            targetDate,
            closestDate,
            availableDates: availableDates.length,
            requestedDays: days,
            actualDays: results.length,
            dateRange: results.length > 0 ? `${results[0].date} to ${results[results.length - 1].date}` : 'none',
            allAvailableDates: availableDates.slice(-10) // 10 התאריכים האחרונים
        });
        
        return results;
    };

    // בדיקת תקינות תאריכים
    const validateInputs = () => {
        if (!selectedDate) {
            setError('אנא בחר תאריך לניתוח');
            return false;
        }
        
        if (favoriteStocks.length === 0) {
            setError('אין מניות מועדפות לניתוח');
            return false;
        }
        
        return true;
    };

    // חישוב תנודתיות
    const calculateVolatility = async () => {
        if (!validateInputs()) return;
        
        setIsCalculating(true);
        setProgress(0);
        setError(null);
        setVolatilityResults([]);

        const calculationStartTime = Date.now();
        console.log(`🚀 Starting LongAtrPriceScore calculation for ${selectedDate} using local data...`);

        try {
            const results: VolatilityResult[] = [];
            const totalStocks = favoriteStocks.length;
            let localLookupTime = 0;

            for (let i = 0; i < totalStocks; i++) {
                const stock = favoriteStocks[i];
                setCurrentStock(stock.symbol);

                try {
                    console.log(`🔍 Processing ${stock.symbol} (${i + 1}/${totalStocks}) for date ${selectedDate}`);

                    let currentPrice: number;
                    let stockHistoricalData: any;
                    
                    // שימוש בנתונים מקומיים בלבד - מהיר O(1)
                    const lookupStartTime = Date.now();
                    
                    if (!dataIndex[stock.symbol]) {
                        console.warn(`⚠️ No data index for ${stock.symbol} - skipping`);
                        continue;
                    }
                    
                    stockHistoricalData = { results: getLocalHistoricalData(stock.symbol, selectedDate, 35) };
                    if (!stockHistoricalData.results || stockHistoricalData.results.length < 21) {
                        console.warn(`⚠️ Not enough local data for ${stock.symbol} (need 21+ days, got ${stockHistoricalData.results?.length || 0})`);
                        continue;
                    }
                    currentPrice = stockHistoricalData.results[stockHistoricalData.results.length - 1].close;
                    
                    const lookupTime = Date.now() - lookupStartTime;
                    localLookupTime += lookupTime;

                                         // המרת נתונים לפורמט OHLC הנדרש
                     let ohlcData = stockHistoricalData.results;
                     // נתונים מקומיים - המרה מ-high,low,close,open ל-h,l,c,o
                     ohlcData = stockHistoricalData.results.map((item: any) => ({
                         h: item.high,
                         l: item.low,
                         c: item.close,
                         o: item.open
                     }));
                     
                     // חישוב מתקדם עם ATR אמיתי ו-Bollinger Bands כמו ChatGPT
                     const advancedCalc = await CAtrPriceLogic.calculateLongAtrPriceScore(stock.symbol, currentPrice, ohlcData);

                     const result: VolatilityResult = {
                         symbol: stock.symbol,
                         name: stock.name,
                         currentPrice,
                         atr: (advancedCalc.atrRatio * currentPrice) / 100, // ATR אמיתי
                         atrRatio: advancedCalc.atrRatio, // ATR/Price מדויק
                         bbWidth: advancedCalc.bbWidth, // Bollinger Bands Width אמיתי
                         bbPosition: advancedCalc.bbPosition, // %b מדויק
                         LongAtrPriceScore: advancedCalc.score, // ציון Long מ-1 עד 100
                         analysisDate: selectedDate,
                         calculationDate: new Date().toISOString().split('T')[0]
                     };

                     results.push(result);

                                         console.log(`✅ ${stock.symbol} LongAtrPriceScore analysis complete:`, {
                         currentPrice: `$${currentPrice}`,
                         atrRatio: `${advancedCalc.atrRatio.toFixed(2)}%`,
                         bbWidth: `${advancedCalc.bbWidth.toFixed(2)}%`,
                         bbPosition: advancedCalc.bbPosition.toFixed(3),
                         score: advancedCalc.score
                     });

                } catch (stockError) {
                    console.error(`❌ Error processing ${stock.symbol}:`, stockError);
                }

                // עדכון התקדמות
                const newProgress = ((i + 1) / totalStocks) * 100;
                setProgress(newProgress);

                // אין צורך בהשהייה כי הנתונים מקומיים (O(1) lookup)
            }

            // מיון תוצאות לפי ציון LongAtrPriceScore (מהגבוה לנמוך)
            results.sort((a, b) => b.LongAtrPriceScore - a.LongAtrPriceScore);
            
            setVolatilityResults(results);
            
            // סיכום ביצועים
            const totalTime = Date.now() - calculationStartTime;
            const avgLookupTime = localLookupTime / results.length;
            
            console.log(`🎉 LongAtrPriceScore calculation completed!`, {
                totalStocks: results.length,
                totalTime: `${totalTime}ms`,
                dataSource: 'local',
                avgLookupTime: `${avgLookupTime.toFixed(2)}ms per stock`,
                totalLookupTime: `${localLookupTime}ms`,
                performance: '🚀 ULTRA FAST'
            });
            
        } catch (error) {
            console.error('❌ Error in volatility calculation:', error);
            setError('שגיאה בחישוב התנודתיות');
        } finally {
            setIsCalculating(false);
            setCurrentStock('');
        }
    };

    // שמירה ל-Firebase
    const saveToFirebase = async () => {
        if (volatilityResults.length === 0) {
            setError('אין תוצאות לשמירה');
            return;
        }

        try {
            // עדכון קולקציית relative-strength עם ציוני CAtrPrice
            const relativeStrengthDocId = `${selectedDate}_relative_strength`;
            console.log(`🔄 Updating relative-strength document with CAtrPrice: ${relativeStrengthDocId}`);
            
            try {
                // קריאת המסמך הקיים
                const relativeStrengthRef = doc(db, 'relative-strength', relativeStrengthDocId);
                const docSnap = await getDoc(relativeStrengthRef);
                
                if (!docSnap.exists()) {
                    throw new Error(`לא נמצא מסמך relative-strength עבור תאריך ${selectedDate}. רוץ תחילה BSpy`);
                }
                
                const existingData = docSnap.data();

                if (existingData?.results) {
                    // עדכון המניות הקיימות עם ציוני CAtrPrice
                    const updatedResults = existingData.results.map((stock: any) => {
                        const volatilityResult = volatilityResults.find(v => v.symbol === stock.symbol);
                        if (volatilityResult) {
                            return {
                                ...stock,
                                LongAtrPriceScore: volatilityResult.LongAtrPriceScore,
                                atrRatio: volatilityResult.atrRatio,
                                atrValue: volatilityResult.atr,
                                bbWidth: volatilityResult.bbWidth,
                                bbPosition: volatilityResult.bbPosition,
                                volatilityAnalysisDate: selectedDate,
                                lastCAtrUpdate: new Date().toISOString()
                            };
                        }
                        return stock;
                    });

                    // עדכון המסמך
                    await updateDoc(relativeStrengthRef, {
                        results: updatedResults,
                        lastCAtrUpdate: new Date().toISOString(),
                        catrAnalysisCompleted: true
                    });
                    console.log(`✅ Updated relative-strength with CAtrPrice values`);
                } else {
                    console.warn(`⚠️ No existing relative-strength data found for ${selectedDate}`);
                }
            } catch (relativeError) {
                console.warn('⚠️ Could not update relative-strength collection:', relativeError);
            }

            // חישוב סטטיסטיקות לתצוגה - Long בלבד
            const avgScore = volatilityResults.reduce((sum, r) => sum + r.LongAtrPriceScore, 0) / volatilityResults.length;
            const maxScore = Math.max(...volatilityResults.map(r => r.LongAtrPriceScore));
            const minScore = Math.min(...volatilityResults.map(r => r.LongAtrPriceScore));
            const excellentScores = volatilityResults.filter(r => r.LongAtrPriceScore >= 80).length;
            const goodScores = volatilityResults.filter(r => r.LongAtrPriceScore >= 60 && r.LongAtrPriceScore < 80).length;
            const weakScores = volatilityResults.filter(r => r.LongAtrPriceScore < 60).length;

            alert(`תוצאות ניתוח תנודתיות עודכנו ב-relative-strength בהצלחה! 📊\n\n` +
                  `📅 תאריך: ${selectedDate}\n` +
                  `🔍 מניות שנותחו: ${volatilityResults.length}\n\n` +
                  `🔥 מעולה (80+): ${excellentScores}\n` +
                  `✅ טוב (60-79): ${goodScores}\n` +
                  `❄️ חלש (<60): ${weakScores}\n\n` +
                  `🎯 ציונים LongAtrPriceScore:\n` +
                  `• ממוצע: ${avgScore.toFixed(1)}\n` +
                  `• מקסימום: ${maxScore}\n` +
                  `• מינימום: ${minScore}\n\n` +
                  `💾 עודכן ב-relative-strength/${relativeStrengthDocId}`);

        } catch (error) {
            console.error('❌ Error saving to Firebase:', error);
            setError(`שגיאה בשמירה: ${error}`);
        }
    };

    // טיפול בשינוי תאריך
    const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedDate(event.target.value);
        setVolatilityResults([]);
        setError(null);
    };

    return (
        <Box sx={{ padding: 3, maxWidth: 1200, margin: '0 auto' }}>
            {/* כותרת */}
            <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="primary" />
                ניתוח תנודתיות ללונג (CAtrPrice)
            </Typography>

            {/* הסבר */}
            <Alert severity="info" sx={{ mb: 3 }}>
                🚀 <strong>ניתוח תנודתיות מתקדם ללונג:</strong><br/>
                🔹 <strong>ATR:</strong> Average True Range - מדד תנודתיות אמיתי<br/>
                🔹 <strong>Bollinger Bands:</strong> רצועות בולינגר לזיהוי דחיסות/התרחבות<br/>
                🔹 <strong>%b Position:</strong> מיקום המחיר ברצועות (0.2-0.3 = מעולה ללונג)<br/>
                📏 <strong>BB Width:</strong> מדד דחיסות/התרחבות (אידיאל: 3%-6%) | 
                📍 <strong>%b Position:</strong> מיקום המחיר ברצועות (0.2-0.3 = מעולה ללונג, מעל 0.7 = לא טוב ללונג)
            </Alert>
            <Typography variant="body2" fontWeight="bold" sx={{ mt: 1 }}>
                📊 מקור נתונים: 📁 מקומי (מהיר O(1))
                {localData && (
                    <span> | 📅 טווח: {localData.metadata.startDate} עד {localData.metadata.endDate} | 🚀 אינדקס: {Object.keys(dataIndex).length} מניות</span>
                )}
            </Typography>

            {/* הודעת שגיאה */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* בחירת תאריך */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        📅 בחירת תאריך לניתוח
                    </Typography>
                    
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={handleDateChange}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '16px'
                            }}
                        />
                        
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setError(null);
                            }}
                            color="success"
                        >
                            📁 מקומי בלבד
                        </Button>
                    </Stack>

                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="contained"
                            startIcon={<PlayArrow />}
                            onClick={calculateVolatility}
                            disabled={isCalculating || !selectedDate}
                            size="large"
                        >
                            🚀 נתח תנודתיות ({favoriteStocks.length} מניות) - 📁 מקומי בלבד
                        </Button>
                        
                        {volatilityResults.length > 0 && (
                            <Button
                                variant="contained"
                                startIcon={<Save />}
                                onClick={saveToFirebase}
                                sx={{ backgroundColor: '#4caf50' }}
                            >
                                💾 שמור ל-Firebase ({volatilityResults.length})
                            </Button>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* מעקב התקדמות */}
            {isCalculating && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            🔄 מחשב תנודתיות...
                        </Typography>
                        <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                            {currentStock && `מעבד: ${currentStock}`} ({progress.toFixed(1)}%)
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {/* תוצאות */}
            {volatilityResults.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            📊 תוצאות ניתוח תנודתיות ללונג (מיון לפי ציון LongAtrPriceScore)
                        </Typography>

                        {/* סיכום תוצאות */}
                        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                            <Chip 
                                icon={<TrendingUp />} 
                                label={`מעולה (+80): ${volatilityResults.filter(r => r.LongAtrPriceScore >= 80).length}`}
                                color="success" 
                            />
                            <Chip 
                                icon={<Remove />} 
                                label={`טוב (60-79): ${volatilityResults.filter(r => r.LongAtrPriceScore >= 60 && r.LongAtrPriceScore < 80).length}`}
                                color="primary" 
                            />
                            <Chip 
                                icon={<Remove />} 
                                label={`חלש (<60): ${volatilityResults.filter(r => r.LongAtrPriceScore < 60).length}`}
                                color="default" 
                            />
                        </Stack>

                        {/* טבלת תוצאות */}
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('symbol')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5
                                                }}
                                            >
                                                <strong>סימבול</strong>
                                                {getSortIcon('symbol')}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('name')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5
                                                }}
                                            >
                                                <strong>שם</strong>
                                                {getSortIcon('name')}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('currentPrice')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5
                                                }}
                                            >
                                                <strong>מחיר</strong>
                                                {getSortIcon('currentPrice')}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('atrRatio')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5
                                                }}
                                            >
                                                <strong>תנודתיות יומית %</strong>
                                                {getSortIcon('atrRatio')}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('LongAtrPriceScore')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5
                                                }}
                                            >
                                                <strong>ציון LongAtrPriceScore</strong>
                                                {getSortIcon('LongAtrPriceScore')}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('bbPosition')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5
                                                }}
                                            >
                                                <strong>מיקום BB</strong>
                                                {getSortIcon('bbPosition')}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sortData(volatilityResults).map((result, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {result.symbol}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" noWrap>
                                                    {result.name}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">
                                                    ${result.currentPrice.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2" 
                                                    style={{ 
                                                        color: result.atrRatio >= 2 && result.atrRatio <= 5 ? 'green' : 
                                                               result.atrRatio < 1 || result.atrRatio > 10 ? 'red' : 'orange',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {result.atrRatio.toFixed(2)}%
                                                </Typography>
                                            </TableCell>
                                                                                         <TableCell>
                                                 <Typography 
                                                     variant="body1" 
                                                     fontWeight="bold"
                                                     style={{
                                                         color: result.LongAtrPriceScore >= 80 ? 'green' : 
                                                                result.LongAtrPriceScore >= 60 ? 'blue' : 'orange'
                                                     }}
                                                 >
                                                     {result.LongAtrPriceScore} - 
                                                     {result.LongAtrPriceScore >= 80 ? '🔥 מעולה' : 
                                                      result.LongAtrPriceScore >= 60 ? '✅ טוב' : '❄️ חלש'}
                                                 </Typography>
                                             </TableCell>
                                             <TableCell>
                                                 <Typography 
                                                     variant="body2" 
                                                     style={{
                                                         color: result.bbPosition <= 0.3 ? 'green' : 
                                                                result.bbPosition >= 0.7 ? 'red' : 'orange'
                                                     }}
                                                 >
                                                     {result.bbPosition <= 0.3 ? '📈 טוב ללונג' : 
                                                      result.bbPosition >= 0.7 ? '📉 לא טוב ללונג' : '😐 ניטרלי'}
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

            {/* הודעה אם אין תוצאות */}
            {!isCalculating && volatilityResults.length === 0 && (
                <Alert severity="info" sx={{ mt: 3 }}>
                    ℹ️ <strong>גרסה מתקדמת:</strong> מחשב ציון LongAtrPriceScore מ-1 עד 100 עבור לונג בלבד
                    <br />
                    📝 <strong>מבוסס על:</strong> ATR מדויק, Bollinger Bands ו-%b Position מותאם ללונג
                </Alert>
            )}
        </Box>
    );
};

export default CAtrPrice;
