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
import { db } from '../../../Api/api';
import { collection, getDocs, setDoc, doc, query } from 'firebase/firestore';
import * as BSpyTypes from '../Types/BSpyTypes';
import { 
    calculateBSpyForStock, 
    getSPYData
} from '../Logic/ShortBSpyLogic';
// polygonApi removed - using only local data

// Interfaces are now imported from Types

export default function ShorthBSpy() {
    const [selectedDate, setSelectedDate] = useState<string>(''); // תאריך ידני
    const [favoriteStocks, setFavoriteStocks] = useState<BSpyTypes.FavoriteStock[]>([]); // מניות מועדפות
    const [relativeStrengthResults, setRelativeStrengthResults] = useState<BSpyTypes.RelativeStrengthResult[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [spyData, setSPYData] = useState<BSpyTypes.SPYData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentStock, setCurrentStock] = useState<string>('');
    const [localData, setLocalData] = useState<BSpyTypes.LocalStockData | null>(null);
    const [dataIndex, setDataIndex] = useState<{[symbol: string]: {[date: string]: any}}>({});
    // dataSource removed - using only local data
    const [sortConfig, setSortConfig] = useState<{
        key: string;
        direction: 'asc' | 'desc' | null;
    }>({ key: 'ShortSpyScore', direction: 'asc' }); // Short: מיון לפי ציון נמוך (חלש) למעלה

    useEffect(() => {
        loadFavoriteStocks();
        loadLocalData();
    }, []);

    // טעינת נתונים מקומיים מהקובץ הגדול
    const loadLocalData = async () => {
        try {
            console.log('📁 Loading local data from single large file...');
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
                
                console.log('✅ Local data loaded and indexed:', {
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

    // טעינת מניות מועדפות מFirebase
    const loadFavoriteStocks = async () => {
        try {
            console.log('🔍 Loading favorite stocks from Firebase...');
            setError(null);
            
            const docSnap = await getDocs(query(collection(db, 'favorite')));
            
            let foundStocks: BSpyTypes.FavoriteStock[] = [];
            docSnap.forEach((doc) => {
                if (doc.id === 'my-favorites') {
                    const data = doc.data();
                    console.log('📄 Favorite data:', data);
                    if (data.stocks && Array.isArray(data.stocks)) {
                        foundStocks = data.stocks.map((stock: any) => ({
                            ...stock,
                            candleDate: '', // נוסיף אותו ב-ShorthBSpy
                            scanDate: data.scanDate || '',
                            passed: true // כל המניות במועדפות עברו את הקריטריונים
                        }));
                        console.log(`✅ Found ${foundStocks.length} favorite stocks`);
                    } else {
                        console.warn(`⚠️ No stocks array found in favorites`);
                    }
                }
            });
            
            if (foundStocks.length === 0) {
                setError('לא נמצאו מניות מועדפות. אנא רוץ AScan תחילה לשמירת מניות');
            } else {
                console.log(`🌟 Loaded ${foundStocks.length} favorite stocks successfully`);
            }
            
            setFavoriteStocks(foundStocks);
            
        } catch (error) {
            console.error('❌ Error loading favorite stocks:', error);
            setError(`שגיאה בטעינת מניות מועדפות: ${error}`);
        }
    };

    // וידוא שיש תאריך ומניות מועדפות
    const validateInputs = (): boolean => {
        if (!selectedDate) {
            setError('אנא בחר תאריך לחישוב');
            return false;
        }
        
        if (favoriteStocks.length === 0) {
            setError('אין מניות מועדפות. אנא רוץ AScan תחילה לשמירת מניות');
            return false;
        }
        
        return true;
    };

    // Functions are now imported from ShortBSpyLogic

    // getSPYData is now imported from ShortBSpyLogic

    // calculateShortSpyScore - Short logic: ככל שהמניה חלשה יותר מ-SPY, הציון גבוה יותר (טוב ל-Short)
    const calculateShortSpyScore = (stockReturn: number, spyReturn: number): number => {
        console.log(`🧮 Calculating ShortSpy Score:`, {
            stockReturn: `${stockReturn.toFixed(3)}%`,
            spyReturn: `${spyReturn.toFixed(3)}%`,
            difference: `${(stockReturn - spyReturn).toFixed(3)}%`
        });

        // חישוב ציון ShortSpy: ככל שהמניה חלשה יותר מ-SPY, הציון גבוה יותר (טוב ל-Short)
        const relativePerformance = stockReturn - spyReturn;
        
        // Short logic: ציון בסיס 50 - בונוס/עונש לפי ביצוע יחסי (הפוך מ-Long)
        let shortSpyScore = 50 - (relativePerformance * 2); // מכפיל 2, אבל הפוך
        
        // הגבלה לטווח 0-100
        shortSpyScore = Math.max(0, Math.min(100, shortSpyScore));
        
        // עיגול למספר שלם
        const finalScore = Math.round(shortSpyScore);
        
        console.log(`📊 ShortSpy Score calculation:`, {
            relativePerformance: `${relativePerformance.toFixed(3)}%`,
            calculatedScore: shortSpyScore.toFixed(1),
            finalScore: finalScore
        });
        
        return finalScore;
    };



    // חישוב חוזק יחסי לכל המניות - פישוט ל-Short בלבד
    const calculateRelativeStrength = async () => {
        if (!validateInputs()) {
            return;
        }

        setIsCalculating(true);
        setProgress(0);
        setError(null);
        setRelativeStrengthResults([]);

        const calculationStartTime = Date.now();
        console.log(`🚀 Starting ShortSpy calculation for ${selectedDate} using local data...`);

        try {
            // קבלת נתוני SPY
            const spyStartTime = Date.now();
            const spy = await getSPYData(selectedDate, 'local', localData, dataIndex);
            if (!spy) {
                throw new Error('Failed to get SPY data');
            }
            const spyTime = Date.now() - spyStartTime;
            console.log(`⏱️ SPY data loaded in ${spyTime}ms`);
            setSPYData(spy);

            const results: BSpyTypes.RelativeStrengthResult[] = [];
            const totalStocks = favoriteStocks.length;
            let localLookupTime = 0;

            for (let i = 0; i < totalStocks; i++) {
                const stock = favoriteStocks[i];
                setCurrentStock(stock.symbol);

                try {
                    console.log(`🔍 Processing ${stock.symbol} (${i + 1}/${totalStocks}) for date ${selectedDate}`);

                    // שימוש בפונקציה מיובאת מהלוגיקה
                    const result = await calculateBSpyForStock(
                        stock, 
                        selectedDate, 
                        spy, 
                        'local', 
                        localData, 
                        dataIndex
                    );
                    
                    if (result) {
                        // עדכון הציון ל-ShortSpyScore
                        const shortResult: BSpyTypes.RelativeStrengthResult = {
                            ...result,
                            LongSpyScore: calculateShortSpyScore(result.stockReturn, result.spyReturn)
                        };
                        
                        results.push(shortResult);
                        console.log(`✅ ${stock.symbol}: Return=${result.stockReturn.toFixed(2)}%, RS=${result.relativeStrength.toFixed(2)}, ShortSpyScore=${shortResult.LongSpyScore}`);
                    }

                } catch (stockError) {
                    console.error(`❌ Error processing ${stock.symbol}:`, stockError);
                }

                // עדכון התקדמות
                const newProgress = ((i + 1) / totalStocks) * 100;
                setProgress(newProgress);
            }

            // התוצאות ימויינו לפי ההגדרה ב-sortConfig
            
            setRelativeStrengthResults(results);
            
            // סיכום ביצועים
            const totalTime = Date.now() - calculationStartTime;
            const avgLookupTime = localLookupTime / results.length;
            
            console.log(`🎉 ShortSpy calculation completed!`, {
                totalTime: `${totalTime}ms`,
                stocksProcessed: results.length,
                dataSource: 'local',
                avgLookupTime: `${avgLookupTime.toFixed(2)}ms per stock`,
                totalLookupTime: `${localLookupTime}ms`,
                spyTime: `${spyTime}ms`,
                performance: '🚀 ULTRA FAST'
            });

        } catch (error) {
            console.error('💥 Calculation error:', error);
            setError(`שגיאה בחישוב: ${error}`);
        } finally {
            setIsCalculating(false);
            setCurrentStock('');
        }
    };

    // שמירה לFirebase
    const saveToFirebase = async () => {
        if (relativeStrengthResults.length === 0) {
            setError('אין תוצאות לשמירה');
            return;
        }

        try {
            // שמירה בקולקציה short_daily_relative-strength
            const documentId = `${selectedDate}_short_relative_strength`;
            const saveData = {
                candleDate: selectedDate,
                calculationDate: new Date().toISOString().split('T')[0],
                spyData: spyData,
                totalStocks: relativeStrengthResults.length,
                results: relativeStrengthResults,
                signals: {
                    short: relativeStrengthResults.filter(r => r.LongSpyScore >= 70).length, // ציון 70+ = טוב ל-Short
                    long: relativeStrengthResults.filter(r => r.LongSpyScore < 30).length, // ציון 30- = רע ל-Short
                    neutral: relativeStrengthResults.filter(r => r.LongSpyScore >= 30 && r.LongSpyScore < 70).length // ציון 30-70
                },
                version: '1.0'
            };

            await setDoc(doc(db, 'short_daily_relative-strength', documentId), saveData);
            console.log(`✅ Saved to short_daily_relative-strength collection: ${documentId}`);

            console.log('✅ Saved Short analysis results to short_daily_relative-strength collection');

            // סטטיסטיקות ציונים
            const avgScore = relativeStrengthResults.reduce((sum, r) => sum + r.LongSpyScore, 0) / relativeStrengthResults.length;
            const maxScore = Math.max(...relativeStrengthResults.map(r => r.LongSpyScore));
            const minScore = Math.min(...relativeStrengthResults.map(r => r.LongSpyScore));

            alert(`תוצאות ציון ShortSpy נשמרו בהצלחה! 🎯\n\n` +
                  `📅 Document ID: ${documentId}\n` +
                  `📊 SPY Return: ${spyData?.return.toFixed(2)}%\n` +
                  `🔍 מניות שנותחו: ${relativeStrengthResults.length}\n\n` +
                  `📉 טוב ל-Short (70+): ${saveData.signals.short}\n` +
                  `😐 רגיל (30-70): ${saveData.signals.neutral}\n` +
                  `📈 רע ל-Short (30-): ${saveData.signals.long}\n\n` +
                  `🎯 ציונים ShortSpyScore:\n` +
                  `• ממוצע: ${avgScore.toFixed(1)}\n` +
                  `• מקסימום: ${maxScore}\n` +
                  `• מינימום: ${minScore}\n\n` +
                  `💾 נשמר תחת: short_daily_relative-strength/${documentId}\n` +
                  `🗓️ תאריך ניתוח: ${selectedDate}`);

        } catch (error) {
            console.error('❌ Error saving to Firebase:', error);
            setError(`שגיאה בשמירה: ${error}`);
        }
    };

    const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = event.target.value;
        setSelectedDate(newDate);
        setRelativeStrengthResults([]);
        setError(null);
        
        console.log(`📅 Date selected: ${newDate} for analysis`);
    };

    // פונקציות מיון
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (sortConfig.key !== key) {
            return '↕️';
        }
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    const sortData = (data: BSpyTypes.RelativeStrengthResult[]) => {
        if (!sortConfig.key || !sortConfig.direction) {
            return data;
        }

        return [...data].sort((a, b) => {
            let aValue = a[sortConfig.key as keyof BSpyTypes.RelativeStrengthResult];
            let bValue = b[sortConfig.key as keyof BSpyTypes.RelativeStrengthResult];

            // Handle different data types
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

    console.log('ShorthBSpy component rendered!');
    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                📉 ShorthBSpy - ציון ShortSpy מול SPY
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold">
                    🎯 הקומפוננטה מחשבת ציון ShortSpy של מניות מול SPY לפי הנוסחה:
                    ShortSpyScore = 50 - ((ReturnStock - ReturnSPY) × 2)
                    <br />
                    📉 ציון 70+ = טוב ל-Short | 😐 ציון 30-70 = רגיל | 📈 ציון 30- = רע ל-Short
                    <br />
                    📊 מקור נתונים: 📁 מקומי (מהיר O(1))
                    {localData && (
                        <span> | 📅 טווח: {localData.metadata.startDate} עד {localData.metadata.endDate} | 🚀 אינדקס: {Object.keys(dataIndex).length} מניות</span>
                    )}
                </Typography>
            </Alert>

            {/* בחירת תאריך */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>בחירת תאריך לניתוח</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                        <Box>
                            <Typography variant="body2" gutterBottom color="text.secondary">
                                תאריך לניתוח:
                            </Typography>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={handleDateChange}
                                style={{
                                    padding: '12px',
                                    fontSize: '16px',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    width: '200px'
                                }}
                            />
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography 
                                variant="body2" 
                                color={favoriteStocks.length === 0 ? 'error' : 'success'}
                                fontWeight="bold"
                            >
                                {favoriteStocks.length === 0 ? 
                                    '⚠️ אין מניות מועדפות - רוץ AScan תחילה' : 
                                    `🌟 ${favoriteStocks.length} מניות מועדפות מוכנות`
                                }
                            </Typography>
                            
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={loadFavoriteStocks}
                            >
                                🔄 טען מניות מחדש
                            </Button>
                            
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                    setError(null);
                                }}
                                color="success"
                            >
                                📁 מקומי בלבד
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            {/* כפתורי פעולה */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={calculateRelativeStrength}
                    disabled={isCalculating || !selectedDate || favoriteStocks.length === 0}
                    size="large"
                >
                    🚀 חשב ציון ShortSpy ({favoriteStocks.length} מניות) - 📁 מקומי בלבד
                </Button>

                <Button
                    variant="contained"
                    color="success"
                    startIcon={<Save />}
                    onClick={saveToFirebase}
                    disabled={relativeStrengthResults.length === 0}
                >
                    💾 שמור ל-Firebase ({relativeStrengthResults.length})
                </Button>

                {/* כפתור דיבוג */}
                <Button
                    variant="outlined"
                    onClick={async () => {
                        console.log('🔍 Debug: Checking Firebase data...');
                        try {
                            const stockScansRef = collection(db, 'stock-scans');
                            const querySnapshot = await getDocs(stockScansRef);
                            
                            console.log(`📊 Total documents in stock-scans: ${querySnapshot.size}`);
                            
                            querySnapshot.forEach((doc) => {
                                const data = doc.data();
                                console.log(`📄 Document ${doc.id}:`, {
                                    candleDate: data.candleDate,
                                    scanDate: data.scanDate,
                                    totalResults: data.results?.length || 0,
                                    passedResults: data.results?.filter((s: any) => s.passed)?.length || 0
                                });
                            });
                            
                            alert(`נמצאו ${querySnapshot.size} documents ב-Firebase. בדוק Console לפרטים מלאים.`);
                        } catch (error) {
                            console.error('❌ Debug error:', error);
                            alert(`שגיאה בדיבוג: ${error}`);
                        }
                    }}
                    size="small"
                >
                    🔍 דיבוג Firebase
                </Button>
            </Stack>

            {/* הצגת נתוני SPY */}
            {spyData && (
                <Card sx={{ mt: 3, bgcolor: 'primary.light' }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>📊 נתוני SPY</Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <Typography variant="body2">
                                מחיר נוכחי: <strong>${spyData.currentPrice.toFixed(2)}</strong>
                            </Typography>
                            <Typography variant="body2">
                                מחיר קודם: <strong>${spyData.previousPrice.toFixed(2)}</strong>
                            </Typography>
                            <Typography variant="body2">
                                תשואה: <strong style={{ color: spyData.return >= 0 ? 'green' : 'red' }}>
                                    {spyData.return >= 0 ? '+' : ''}{spyData.return.toFixed(2)}%
                                </strong>
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {/* שגיאות */}
            {error && (
                <Alert severity="error" sx={{ mt: 3 }}>
                    {error}
                </Alert>
            )}

            {/* פרוגרס בר */}
            {isCalculating && (
                <Box sx={{ mb: 3 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2" fontWeight="bold">
                            🔍 מחשב ציון ShortSpy - אל תסגור את הדף!
                        </Typography>
                    </Alert>
                    <Typography variant="body1" gutterBottom fontWeight="bold">
                        מעבד כעת: {currentStock || 'מכין נתונים...'}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        התקדמות: {progress.toFixed(1)}%
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 12, borderRadius: 6, mb: 2 }}
                    />
                </Box>
            )}

            {/* תוצאות */}
            {relativeStrengthResults.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            📉 תוצאות ציון ShortSpy (מיון לפי ציון ShortSpyScore)
                        </Typography>
                        
                        {/* סיכום איתותים */}
                        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
                            <Chip 
                                label={`Good for Short: ${relativeStrengthResults.filter(r => r.LongSpyScore >= 70).length}`}
                                color="success"
                                icon={<TrendingDown />}
                            />
                            <Chip 
                                label={`Bad for Short: ${relativeStrengthResults.filter(r => r.LongSpyScore < 30).length}`}
                                color="error"
                                icon={<TrendingUp />}
                            />
                            <Chip 
                                label={`Neutral: ${relativeStrengthResults.filter(r => r.LongSpyScore >= 30 && r.LongSpyScore < 70).length}`}
                                color="default"
                                icon={<Remove />}
                            />
                        </Stack>

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
                                                    gap: 0.5,
                                                    textTransform: 'none',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                <strong>סימול</strong>
                                                <span style={{ fontSize: '0.8rem' }}>{getSortIcon('symbol')}</span>
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
                                                    gap: 0.5,
                                                    textTransform: 'none',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                <strong>שם</strong>
                                                <span style={{ fontSize: '0.8rem' }}>{getSortIcon('name')}</span>
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('stockReturn')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    textTransform: 'none',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                <strong>תשואת מניה %</strong>
                                                <span style={{ fontSize: '0.8rem' }}>{getSortIcon('stockReturn')}</span>
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('spyReturn')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    textTransform: 'none',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                <strong>תשואת SPY %</strong>
                                                <span style={{ fontSize: '0.8rem' }}>{getSortIcon('spyReturn')}</span>
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('relativeStrength')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    textTransform: 'none',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                <strong>יחס חוזק</strong>
                                                <span style={{ fontSize: '0.8rem' }}>{getSortIcon('relativeStrength')}</span>
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={() => handleSort('LongSpyScore')}
                                                sx={{ 
                                                    minWidth: 'auto', 
                                                    p: 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    textTransform: 'none',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                <strong>ציון ShortSpy</strong>
                                                <span style={{ fontSize: '0.8rem' }}>{getSortIcon('LongSpyScore')}</span>
                                            </Button>
                                        </TableCell>
                                        <TableCell><strong>מצב</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sortData(relativeStrengthResults).map((result, index) => (
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
                                                <Typography 
                                                    variant="body2" 
                                                    style={{ 
                                                        color: result.stockReturn >= 0 ? 'green' : 'red',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {result.stockReturn >= 0 ? '+' : ''}{result.stockReturn.toFixed(2)}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2"
                                                    style={{ 
                                                        color: result.spyReturn >= 0 ? 'green' : 'red',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {result.spyReturn >= 0 ? '+' : ''}{result.spyReturn.toFixed(2)}%
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {result.relativeStrength.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body1" 
                                                    fontWeight="bold"
                                                    style={{
                                                        color: result.LongSpyScore >= 70 ? 'green' : 
                                                               result.LongSpyScore < 30 ? 'red' : 'orange',
                                                        fontSize: '1.1rem'
                                                    }}
                                                >
                                                    {result.LongSpyScore || 'N/A'}
                                                </Typography>
                                                <Typography 
                                                    variant="caption" 
                                                    color="text.secondary"
                                                    display="block"
                                                >
                                                    {result.LongSpyScore >= 70 ? '📉 טוב ל-Short' : 
                                                     result.LongSpyScore < 30 ? '📈 רע ל-Short' : '😐 רגיל'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongSpyScore >= 70 ? '📉' : result.LongSpyScore < 30 ? '📈' : '😐'}
                                                    color={
                                                        result.LongSpyScore >= 70 ? 'success' :
                                                        result.LongSpyScore < 30 ? 'error' : 'default'
                                                    }
                                                    icon={
                                                        result.LongSpyScore >= 70 ? <TrendingDown /> :
                                                        result.LongSpyScore < 30 ? <TrendingUp /> : <Remove />
                                                    }
                                                    size="small"
                                                />
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
