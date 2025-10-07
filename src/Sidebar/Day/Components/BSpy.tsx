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
// polygonApi removed - using only local data

// Interface עבור מניה מתוצאות AScan
interface StockFromScan {
    candleDate: string;
    scanDate: string;
    symbol: string;
    name: string;
    price: number;
    market: string;
    volume: number;
    dollarVolume: number;
    float: number;
    spread: number;
    passed: boolean;
    marketCap?: number;
    avgVolume20?: number;
}

// Interface עבור תוצאות חוזק יחסי - פישוט ל-Long בלבד
interface RelativeStrengthResult {
    symbol: string;
    name: string;
    currentPrice: number;
    previousPrice: number;
    stockReturn: number;
    spyReturn: number;
    relativeStrength: number;
    LongSpyScore: number; // ציון Long מ-0 עד 100 עבור BSpy
    candleDate: string;
    calculationDate: string;
}

// Interface עבור נתוני SPY
interface SPYData {
    currentPrice: number;
    previousPrice: number;
    return: number;
}

// Interface עבור נתונים מקומיים
interface LocalStockData {
    metadata: {
        created: string;
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
        source: string;
        description: string;
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
        adjusted_close?: number;
    }>;
}

export default function BSpy() {
    const [selectedDate, setSelectedDate] = useState<string>(''); // תאריך ידני
    const [favoriteStocks, setFavoriteStocks] = useState<StockFromScan[]>([]); // מניות מועדפות
    const [relativeStrengthResults, setRelativeStrengthResults] = useState<RelativeStrengthResult[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [spyData, setSPYData] = useState<SPYData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentStock, setCurrentStock] = useState<string>('');
    const [localData, setLocalData] = useState<LocalStockData | null>(null);
    const [dataIndex, setDataIndex] = useState<{[symbol: string]: {[date: string]: any}}>({});
    // dataSource removed - using only local data
    const [sortConfig, setSortConfig] = useState<{
        key: string;
        direction: 'asc' | 'desc' | null;
    }>({ key: 'LongSpyScore', direction: 'desc' });

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
            
            let foundStocks: StockFromScan[] = [];
            docSnap.forEach((doc) => {
                if (doc.id === 'my-favorites') {
                    const data = doc.data();
                    console.log('📄 Favorite data:', data);
                    if (data.stocks && Array.isArray(data.stocks)) {
                        foundStocks = data.stocks.map((stock: any) => ({
                            ...stock,
                            candleDate: '', // נוסיף אותו ב-BSpy
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

    // Function to check if a date is a US holiday
    const isUSHoliday = (date: Date): boolean => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        
        // New Year's Day
        if (month === 0 && day === 1) return true;
        
        // Martin Luther King Jr. Day (third Monday in January)
        const mlkDay = new Date(year, 0, 1);
        while (mlkDay.getDay() !== 1) mlkDay.setDate(mlkDay.getDate() + 1);
        mlkDay.setDate(mlkDay.getDate() + 14);
        if (month === 0 && day === mlkDay.getDate()) return true;
        
        // Presidents' Day (third Monday in February)
        const presidentsDay = new Date(year, 1, 1);
        while (presidentsDay.getDay() !== 1) presidentsDay.setDate(presidentsDay.getDate() + 1);
        presidentsDay.setDate(presidentsDay.getDate() + 14);
        if (month === 1 && day === presidentsDay.getDate()) return true;
        
        // Memorial Day (last Monday in May)
        const memorialDay = new Date(year, 4, 31);
        while (memorialDay.getDay() !== 1) memorialDay.setDate(memorialDay.getDate() - 1);
        if (month === 4 && day === memorialDay.getDate()) return true;
        
        // Independence Day
        if (month === 6 && day === 4) return true;
        
        // Labor Day (first Monday in September)
        const laborDay = new Date(year, 8, 1);
        while (laborDay.getDay() !== 1) laborDay.setDate(laborDay.getDate() + 1);
        if (month === 8 && day === laborDay.getDate()) return true;
        
        // Columbus Day (second Monday in October)
        const columbusDay = new Date(year, 9, 1);
        while (columbusDay.getDay() !== 1) columbusDay.setDate(columbusDay.getDate() + 1);
        columbusDay.setDate(columbusDay.getDate() + 7);
        if (month === 9 && day === columbusDay.getDate()) return true;
        
        // Veterans Day
        if (month === 10 && day === 11) return true;
        
        // Thanksgiving (fourth Thursday in November)
        const thanksgiving = new Date(year, 10, 1);
        while (thanksgiving.getDay() !== 4) thanksgiving.setDate(thanksgiving.getDate() + 1);
        thanksgiving.setDate(thanksgiving.getDate() + 21);
        if (month === 10 && day === thanksgiving.getDate()) return true;
        
        // Christmas Day
        if (month === 11 && day === 25) return true;
        
        return false;
    };

    // חיפוש נתונים מקומיים מהיר O(1) - משתמש באינדקס
    const findLocalData = (symbol: string, date: string) => {
        if (!dataIndex[symbol]) return null;
        return dataIndex[symbol][date] || null;
    };

    // Function to get previous trading day (skip weekends and holidays)
    const getPreviousTradingDay = (date: Date): Date => {
        const previousDay = new Date(date);
        previousDay.setDate(date.getDate() - 1);
        
        // Skip weekends and holidays
        while (previousDay.getDay() === 0 || previousDay.getDay() === 6 || isUSHoliday(previousDay)) {
            previousDay.setDate(previousDay.getDate() - 1);
        }
        
        return previousDay;
    };

    // קבלת נתוני SPY לתאריך ספציפי
    const getSPYData = async (targetDate: string): Promise<SPYData | null> => {
        try {
            console.log(`📊 Fetching SPY data for specific date: ${targetDate}...`);
            
            // חישוב התאריך הקודם (יום מסחר אחד לפני) - כולל דילוג על חגים
            const targetDateObj = new Date(targetDate);
            const previousDateObj = getPreviousTradingDay(targetDateObj);
            const previousDate = previousDateObj.toISOString().split('T')[0];
            
            console.log(`📅 Target date: ${targetDate}, Previous trading day: ${previousDate}`);
            
            let currentPrice: number;
            let previousPrice: number;
            
            // שימוש בנתונים מקומיים בלבד
            console.log('📁 Using local data for SPY...');
            
            const spyTargetData = findLocalData('SPY', targetDate);
            if (!spyTargetData) {
                throw new Error(`No local SPY data for target date ${targetDate}`);
            }
            currentPrice = spyTargetData.close;
            
            const spyPreviousData = findLocalData('SPY', previousDate);
            if (!spyPreviousData) {
                throw new Error(`No local SPY data for previous date ${previousDate}`);
            }
            previousPrice = spyPreviousData.close;
            
            if (currentPrice === 0 || previousPrice === 0) {
                throw new Error('Invalid SPY prices received');
            }
            
            const spyReturn = ((currentPrice - previousPrice) / previousPrice) * 100;
            
            const spyData: SPYData = {
                currentPrice,
                previousPrice,
                return: spyReturn
            };
            
            console.log(`✅ SPY Data for ${targetDate} (local):`, {
                date: targetDate,
                current: `$${currentPrice}`,
                previousDate: previousDate,
                previous: `$${previousPrice}`,
                return: `${spyReturn.toFixed(2)}%`,
                source: 'local'
            });
            
            setSPYData(spyData);
            return spyData;
            
        } catch (error) {
            console.error('❌ Error fetching SPY data:', error);
            throw error;
        }
    };

    // חישוב ציון LongSpy - גרסה מפושטת מ-0 עד 100
    const calculateLongSpyScore = (stockReturn: number, spyReturn: number): number => {
        console.log(`🧮 Calculating LongSpy Score:`, {
            stockReturn: `${stockReturn.toFixed(3)}%`,
            spyReturn: `${spyReturn.toFixed(3)}%`,
            difference: `${(stockReturn - spyReturn).toFixed(3)}%`
        });

        // חישוב ציון LongSpy: ככל שהמניה חזקה יותר מ-SPY, הציון גבוה יותר
        const relativePerformance = stockReturn - spyReturn;
        
        // ציון בסיס 50 + בונוס/עונש לפי ביצוע יחסי
        let longSpyScore = 50 + (relativePerformance * 2); // מכפיל 2 במקום 10
        
        // הגבלה לטווח 0-100
        longSpyScore = Math.max(0, Math.min(100, longSpyScore));
        
        // עיגול למספר שלם
        const finalScore = Math.round(longSpyScore);
        
        console.log(`📊 LongSpy Score calculation:`, {
            relativePerformance: `${relativePerformance.toFixed(3)}%`,
            calculatedScore: longSpyScore.toFixed(1),
            finalScore: finalScore
        });
        
        return finalScore;
    };



    // חישוב חוזק יחסי לכל המניות - פישוט ל-Long בלבד
    const calculateRelativeStrength = async () => {
        if (!validateInputs()) {
            return;
        }

        setIsCalculating(true);
        setProgress(0);
        setError(null);
        setRelativeStrengthResults([]);

        const calculationStartTime = Date.now();
        console.log(`🚀 Starting LongSpy calculation for ${selectedDate} using local data...`);

        try {
            // קבלת נתוני SPY
            const spyStartTime = Date.now();
            const spy = await getSPYData(selectedDate);
            if (!spy) {
                throw new Error('Failed to get SPY data');
            }
            const spyTime = Date.now() - spyStartTime;
            console.log(`⏱️ SPY data loaded in ${spyTime}ms`);

            const results: RelativeStrengthResult[] = [];
            const totalStocks = favoriteStocks.length;
            let localLookupTime = 0;

            for (let i = 0; i < totalStocks; i++) {
                const stock = favoriteStocks[i];
                setCurrentStock(stock.symbol);

                try {
                    console.log(`🔍 Processing ${stock.symbol} (${i + 1}/${totalStocks}) for date ${selectedDate}`);

                    // חישוב התאריך הקודם (יום מסחר אחד לפני) - כולל דילוג על חגים
                    const targetDateObj = new Date(selectedDate);
                    const previousDateObj = getPreviousTradingDay(targetDateObj);
                    const previousDate = previousDateObj.toISOString().split('T')[0];

                    let currentPrice: number;
                    let previousPrice: number;
                    
                    // שימוש בנתונים מקומיים בלבד - מהיר O(1)
                    const lookupStartTime = Date.now();
                    
                    const stockTargetData = findLocalData(stock.symbol, selectedDate);
                    if (!stockTargetData) {
                        console.warn(`⚠️ No local data for ${stock.symbol} on ${selectedDate}`);
                        continue;
                    }
                    currentPrice = stockTargetData.close;
                    
                    const stockPreviousData = findLocalData(stock.symbol, previousDate);
                    if (!stockPreviousData) {
                        console.warn(`⚠️ No local data for ${stock.symbol} on ${previousDate}`);
                        continue;
                    }
                    previousPrice = stockPreviousData.close;
                    
                    const lookupTime = Date.now() - lookupStartTime;
                    localLookupTime += lookupTime;
                    
                    if (previousPrice === 0) {
                        console.warn(`⚠️ No valid previous price for ${stock.symbol} on ${previousDate}`);
                        continue;
                    }

                    // חישוב תשואת המניה
                    const stockReturn = ((currentPrice - previousPrice) / previousPrice) * 100;

                    // חישוב חוזק יחסי (Relative Strength Ratio)
                    let relativeStrength;
                    if (Math.abs(spy.return) < 0.001) { // כמעט 0
                        // אם SPY כמעט לא זז, נשתמש בערכים מוחלטים
                        relativeStrength = stockReturn === 0 ? 1 : (stockReturn > 0 ? 2 : 0.5);
                    } else {
                        // הנוסחה הרגילה: (1 + תשואת מניה) / (1 + תשואת SPY)  
                        const stockMultiplier = 1 + (stockReturn / 100);
                        const spyMultiplier = 1 + (spy.return / 100);
                        relativeStrength = stockMultiplier / spyMultiplier;
                    }

                                    // חישוב ציון LongSpy
                const LongSpyScore = calculateLongSpyScore(stockReturn, spy.return);
                
                console.log(`🧮 ${stock.symbol} calculations for ${selectedDate} (local):`, {
                    targetDate: selectedDate,
                    previousDate: previousDate,
                    currentPrice: `$${currentPrice}`,
                    previousPrice: `$${previousPrice}`,
                    stockReturn: `${stockReturn.toFixed(3)}%`,
                    spyReturn: `${spy.return.toFixed(3)}%`,
                    relativeStrength: relativeStrength.toFixed(3),
                    LongSpyScore: LongSpyScore,
                    source: 'local'
                });

                const result: RelativeStrengthResult = {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice,
                    previousPrice,
                    stockReturn,
                    spyReturn: spy.return,
                    relativeStrength,
                    LongSpyScore,
                    candleDate: selectedDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                };

                results.push(result);

                console.log(`✅ ${stock.symbol}: Return=${stockReturn.toFixed(2)}%, RS=${relativeStrength.toFixed(2)}, LongSpyScore=${LongSpyScore}`);

                } catch (stockError) {
                    console.error(`❌ Error processing ${stock.symbol}:`, stockError);
                }

                // עדכון התקדמות
                const newProgress = ((i + 1) / totalStocks) * 100;
                setProgress(newProgress);

                // אין צורך בהשהייה כי הנתונים מקומיים (O(1) lookup)
            }

            // התוצאות ימויינו לפי ההגדרה ב-sortConfig
            
            setRelativeStrengthResults(results);
            
            // סיכום ביצועים
            const totalTime = Date.now() - calculationStartTime;
            const avgLookupTime = localLookupTime / results.length;
            
            console.log(`🎉 LongSpy calculation completed!`, {
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
            // 1. שמירה בקולקציה relative-strength (כמו קודם)
            const documentId = `${selectedDate}_relative_strength`;
            const saveData = {
                candleDate: selectedDate,
                calculationDate: new Date().toISOString().split('T')[0],
                spyData: spyData,
                totalStocks: relativeStrengthResults.length,
                results: relativeStrengthResults,
                signals: {
                    long: relativeStrengthResults.filter(r => r.LongSpyScore >= 70).length, // ציון 70+
                    short: relativeStrengthResults.filter(r => r.LongSpyScore < 30).length, // ציון 30-
                    neutral: relativeStrengthResults.filter(r => r.LongSpyScore >= 30 && r.LongSpyScore < 70).length // ציון 30-70
                },
                version: '1.0'
            };

            await setDoc(doc(db, 'relative-strength', documentId), saveData);
            console.log(`✅ Saved to relative-strength collection: ${documentId}`);

            // לא צריך לעדכן כלום - נשמור רק ב-relative-strength
            console.log('✅ Saved analysis results to relative-strength collection');

            // סטטיסטיקות ציונים
            const avgScore = relativeStrengthResults.reduce((sum, r) => sum + r.LongSpyScore, 0) / relativeStrengthResults.length;
            const maxScore = Math.max(...relativeStrengthResults.map(r => r.LongSpyScore));
            const minScore = Math.min(...relativeStrengthResults.map(r => r.LongSpyScore));

            alert(`תוצאות ציון LongSpy נשמרו בהצלחה! 🎯\n\n` +
                  `📅 Document ID: ${documentId}\n` +
                  `📊 SPY Return: ${spyData?.return.toFixed(2)}%\n` +
                  `🔍 מניות שנותחו: ${relativeStrengthResults.length}\n\n` +
                  `🔥 חזק מאוד (70+): ${saveData.signals.long}\n` +
                  `😐 רגיל (30-70): ${saveData.signals.neutral}\n` +
                  `❄️ חלש (30-): ${saveData.signals.short}\n\n` +
                  `🎯 ציונים LongSpyScore:\n` +
                  `• ממוצע: ${avgScore.toFixed(1)}\n` +
                  `• מקסימום: ${maxScore}\n` +
                  `• מינימום: ${minScore}\n\n` +
                  `💾 נשמר תחת: relative-strength/${documentId}\n` +
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

    const sortData = (data: RelativeStrengthResult[]) => {
        if (!sortConfig.key || !sortConfig.direction) {
            return data;
        }

        return [...data].sort((a, b) => {
            let aValue = a[sortConfig.key as keyof RelativeStrengthResult];
            let bValue = b[sortConfig.key as keyof RelativeStrengthResult];

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

    console.log('BSpy component rendered!');
    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                📊 BSpy - ציון LongSpy מול SPY
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold">
                    🎯 הקומפוננטה מחשבת ציון LongSpy של מניות מול SPY לפי הנוסחה:
                    LongSpyScore = 50 + ((ReturnStock - ReturnSPY) × 2)
                    <br />
                    🔥 ציון 70+ = חזק מאוד | 😐 ציון 30-70 = רגיל | ❄️ ציון 30- = חלש
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
                    🚀 חשב ציון LongSpy ({favoriteStocks.length} מניות) - 📁 מקומי בלבד
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
                            🔍 מחשב ציון LongSpy - אל תסגור את הדף!
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
                            📈 תוצאות ציון LongSpy (מיון לפי ציון LongSpyScore)
                        </Typography>
                        
                        {/* סיכום איתותים */}
                        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
                            <Chip 
                                label={`Long: ${relativeStrengthResults.filter(r => r.LongSpyScore >= 70).length}`}
                                color="success"
                                icon={<TrendingUp />}
                            />
                            <Chip 
                                label={`Short: ${relativeStrengthResults.filter(r => r.LongSpyScore < 30).length}`}
                                color="error"
                                icon={<TrendingDown />}
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
                                                <strong>ציון LongSpy</strong>
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
                                                    {result.LongSpyScore >= 70 ? '🔥 חזק' : 
                                                     result.LongSpyScore < 30 ? '❄️ חלש' : '😐 רגיל'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongSpyScore >= 70 ? '🔥' : result.LongSpyScore < 30 ? '❄️' : '😐'}
                                                    color={
                                                        result.LongSpyScore >= 70 ? 'success' :
                                                        result.LongSpyScore < 30 ? 'error' : 'default'
                                                    }
                                                    icon={
                                                        result.LongSpyScore >= 70 ? <TrendingUp /> :
                                                        result.LongSpyScore < 30 ? <TrendingDown /> : <Remove />
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
