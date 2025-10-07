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
import { TrendingUp, Remove, SignalCellularAlt, PlayArrow, Save } from '@mui/icons-material';
import { getFirestore, collection, doc, getDocs, getDoc, updateDoc } from 'firebase/firestore';

// Interfaces
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

// SMAData and MACDData interfaces removed - using only local data

interface MomentumResult {
    symbol: string;
    name: string;
    currentPrice: number;
    sma3Current: number;
    sma3Previous: number;
    sma12Current: number;
    sma12Previous: number;
    crossoverType: 'Bullish' | 'Bearish' | 'None';
    macdHistogram: number;
    LongMomentumScore: number; // ציון Long מ-1 עד 100 עבור DSignals
    analysisDate: string;
    calculationDate: string;
}

interface LocalStockData {
    metadata: {
        created: string;
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
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

const db = getFirestore();

export default function DSignals() {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [favoriteStocks, setFavoriteStocks] = useState<FavoriteStock[]>([]);
    const [momentumResults, setMomentumResults] = useState<MomentumResult[]>([]);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string>('');
    const [currentStock, setCurrentStock] = useState<string>('');
    
    // נתונים מקומיים
    const [localData, setLocalData] = useState<LocalStockData | null>(null);
    const [dataIndex, setDataIndex] = useState<{[symbol: string]: {[date: string]: any}}>({});
    // dataSource removed - using only local data

    // טעינת מניות מועדפות מFirebase
    useEffect(() => {
        loadFavoriteStocks();
        loadLocalData();
    }, []);

    const loadFavoriteStocks = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'favorite'));
            
            let stocksData: FavoriteStock[] = [];
            querySnapshot.forEach((doc) => {
                if (doc.id === 'my-favorites') {
                    const data = doc.data();
                    if (data.stocks && Array.isArray(data.stocks)) {
                        stocksData = data.stocks;
                    }
                }
            });

            setFavoriteStocks(stocksData);
            console.log(`📊 Loaded ${stocksData.length} favorite stocks for momentum analysis`);
            
        } catch (error) {
            console.error('❌ Error loading favorite stocks:', error);
            setError('שגיאה בטעינת מניות מועדפות');
        }
    };

    // טעינת נתונים מקומיים מהקובץ הגדול
    const loadLocalData = async () => {
        try {
            console.log('📁 Loading local data from single large file for DSignals...');
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
                
                console.log('✅ Local data loaded and indexed for DSignals:', {
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

    // פונקציות עזר לנתונים מקומיים
    const findLocalData = (symbol: string, date: string) => {
        if (!dataIndex || !dataIndex[symbol]) {
            console.warn(`⚠️ No data index for symbol: ${symbol}`, {
                hasDataIndex: !!dataIndex,
                hasSymbol: !!dataIndex?.[symbol],
                availableSymbols: dataIndex ? Object.keys(dataIndex).slice(0, 5) : []
            });
            return null;
        }
        return dataIndex[symbol][date] || null;
    };

    const getLocalHistoricalData = (symbol: string, endDate: string, days: number = 30) => {
        if (!dataIndex || !dataIndex[symbol]) {
            console.warn(`⚠️ No data index for symbol: ${symbol}`, {
                hasDataIndex: !!dataIndex,
                hasSymbol: !!dataIndex?.[symbol],
                availableSymbols: dataIndex ? Object.keys(dataIndex).slice(0, 5) : [],
                requestedSymbol: symbol
            });
            return [];
        }
        
        const endDateObj = new Date(endDate);
        const results = [];
        let tradingDaysFound = 0;
        let currentDate = new Date(endDateObj);
        let iterations = 0;
        let maxIterations = days * 2;
        
        console.log(`🔍 Getting ${days} trading days of data for ${symbol} ending ${endDate}`);
        
        // חיפוש ימי מסחר אחורה מהתאריך שנבחר
        while (tradingDaysFound < days && iterations < maxIterations) {
            const dateStr = currentDate.toISOString().split('T')[0];
            
            const data = findLocalData(symbol, dateStr);
            if (data) {
                results.unshift(data); // הוספה בתחילה כדי לשמור על סדר כרונולוגי
                tradingDaysFound++;
                // הסרת הלוגים המרובים - רק לוג כל 5 ימים
                if (tradingDaysFound % 5 === 0 || tradingDaysFound <= 3) {
                    console.log(`✅ Found data for ${symbol} on ${dateStr}`);
                }
            } else {
                // הסרת הלוגים המרובים - רק לוג כל 10 ימים
                if (iterations % 10 === 0) {
                    console.log(`❌ No data for ${symbol} on ${dateStr}`);
                }
            }
            
            // עבור ליום הקודם
            currentDate.setDate(currentDate.getDate() - 1);
            iterations++;
        }
        
        console.log(`📊 Found ${results.length} trading days of data for ${symbol} (needed ${days}) after ${iterations} iterations`);
        return results;
    };

    // חישוב SMA מהנתונים המקומיים
    const calculateLocalSMA = (ohlcData: any[], period: number): number[] => {
        if (ohlcData.length < period) {
            console.warn(`⚠️ Not enough data for SMA${period}: need ${period}, got ${ohlcData.length}`);
            return [];
        }
        
        const smaValues: number[] = [];
        
        for (let i = period - 1; i < ohlcData.length; i++) {
            const periodData = ohlcData.slice(i - period + 1, i + 1);
            const closePrices = periodData.map(d => d.close).filter(price => !isNaN(price) && price > 0);
            
            if (closePrices.length === period) {
                const sma = closePrices.reduce((sum, price) => sum + price, 0) / period;
                smaValues.push(sma);
            }
        }
        
        return smaValues;
    };

    // חישוב MACD מהנתונים המקומיים
    const calculateLocalMACD = (ohlcData: any[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
        if (ohlcData.length < slowPeriod) {
            console.warn(`⚠️ Not enough data for MACD: need ${slowPeriod}, got ${ohlcData.length}`);
            return { macd: [], signal: [], histogram: [] };
        }
        
        const closePrices = ohlcData.map(d => d.close).filter(price => !isNaN(price) && price > 0);
        
        if (closePrices.length < slowPeriod) {
            console.warn(`⚠️ Not enough valid close prices for MACD`);
            return { macd: [], signal: [], histogram: [] };
        }
        
        // חישוב EMA
        const calculateEMA = (prices: number[], period: number) => {
            const ema: number[] = [];
            const multiplier = 2 / (period + 1);
            
            // EMA הראשון = SMA
            const sma = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
            ema.push(sma);
            
            // EMA הבאים
            for (let i = period; i < prices.length; i++) {
                const emaValue = (prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
                ema.push(emaValue);
            }
            
            return ema;
        };
        
        const fastEMA = calculateEMA(closePrices, fastPeriod);
        const slowEMA = calculateEMA(closePrices, slowPeriod);
        
        // MACD = Fast EMA - Slow EMA
        const macd: number[] = [];
        const startIndex = slowPeriod - fastPeriod;
        
        for (let i = 0; i < fastEMA.length - startIndex; i++) {
            macd.push(fastEMA[i + startIndex] - slowEMA[i]);
        }
        
        // Signal Line = EMA של MACD
        const signal = calculateEMA(macd, signalPeriod);
        
        // Histogram = MACD - Signal
        const histogram: number[] = [];
        const signalStartIndex = macd.length - signal.length;
        
        for (let i = 0; i < signal.length; i++) {
            histogram.push(macd[i + signalStartIndex] - signal[i]);
        }
        
        return { macd, signal, histogram };
    };

    // בדיקת קלטים
    const validateInputs = (): boolean => {
        if (!selectedDate) {
            setError('יש לבחור תאריך לניתוח');
            return false;
        }
        
        if (favoriteStocks.length === 0) {
            setError('לא נמצאו מניות מועדפות. רוץ תחילה AScan');
            return false;
        }
        
        setError('');
        return true;
    };

    // Polygon API functions removed - using only local data

    // זיהוי חצייה של SMA3 מול SMA12 (משופר)
    const detectCrossover = (sma3Current: number, sma3Previous: number, sma12Current: number, sma12Previous: number): 'Bullish' | 'Bearish' | 'None' => {
        const currentAbove = sma3Current > sma12Current;
        const previousAbove = sma3Previous > sma12Previous;
        
        console.log(`🔍 Crossover analysis:`, {
            sma3Current: sma3Current.toFixed(4),
            sma3Previous: sma3Previous.toFixed(4), 
            sma12Current: sma12Current.toFixed(4),
            sma12Previous: sma12Previous.toFixed(4),
            currentAbove,
            previousAbove
        });
        
        // אם הנתונים זהים (אין היסטוריה), נבדוק על בסיס המצב הנוכחי
        if (sma3Current === sma3Previous && sma12Current === sma12Previous) {
            if (currentAbove) {
                return 'Bullish'; // SMA3 מעל SMA12 = כיוון עולה
            } else {
                return 'Bearish'; // SMA3 מתחת SMA12 = כיוון יורד  
            }
        }
        
        // בדיקת חצייה אמיתית
        if (!previousAbove && currentAbove) {
            return 'Bullish'; // SMA3 חוצה מלמטה למעלה את SMA12
        } else if (previousAbove && !currentAbove) {
            return 'Bearish'; // SMA3 חוצה מלמעלה למטה את SMA12
        } else {
            return 'None'; // אין חצייה
        }
    };

    // חישוב ציון מומנטום ללונג בלבד (1-100)
    const calculateLongMomentumScore = (crossoverType: 'Bullish' | 'Bearish' | 'None', macdHistogram: number): number => {
        let score = 50; // בסיס ניטרלי
        
        if (crossoverType === 'Bullish') {
            if (macdHistogram > 0) {
                score = 95; // חצייה עולה + MACD חיובי = מצוין ללונג
            } else if (Math.abs(macdHistogram) < 0.01) {
                score = 75; // חצייה עולה + MACD ניטרלי = טוב ללונג
            } else {
                score = 55; // חצייה עולה + MACD שלילי = עדיין טוב ללונג
            }
        } else if (crossoverType === 'Bearish') {
            if (macdHistogram < 0) {
                score = 15; // חצייה יורדת + MACD שלילי = לא טוב ללונג
            } else if (Math.abs(macdHistogram) < 0.01) {
                score = 25; // חצייה יורדת + MACD ניטרלי = חלש ללונג
            } else {
                score = 40; // חצייה יורדת + MACD חיובי = התנגדות - בינוני ללונג
            }
        } else {
            // אין חצייה
            if (macdHistogram > 0.02) {
                score = 70; // מומנטום חיובי בלי חצייה = טוב ללונג
            } else if (macdHistogram < -0.02) {
                score = 30; // מומנטום שלילי בלי חצייה = לא טוב ללונג
            } else {
                score = 50; // ניטרלי לחלוטין = בינוני ללונג
            }
        }
        
        return Math.max(1, Math.min(100, Math.round(score)));
    };

    // פונקציה זו הוסרה - אנחנו לא רוצים איתותים, רק ציונים ללונג

    // פונקציה ראשית לניתוח מומנטום
    const analyzeMomentum = async () => {
        console.log('🔄 analyzeMomentum called');
        console.log('validateInputs:', validateInputs());
        console.log('selectedDate:', selectedDate);
        console.log('favoriteStocks:', favoriteStocks.length);
        
        if (!validateInputs()) {
            console.log('❌ Validation failed');
            return;
        }

        setIsCalculating(true);
        setProgress(0);
        setError('');
        setMomentumResults([]);

        const results: MomentumResult[] = [];
        const totalStocks = favoriteStocks.length;

        try {
            console.log(`🚀 Starting momentum analysis for ${totalStocks} stocks on ${selectedDate}`);
            
            // שימוש בנתונים מקומיים בלבד
            console.log('Using local data only - no API key needed');

            for (let i = 0; i < favoriteStocks.length; i++) {
                const stock = favoriteStocks[i];
                setCurrentStock(stock.symbol);
                setProgress(((i + 1) / totalStocks) * 100);

                try {
                    console.log(`📊 Processing ${i + 1}/${totalStocks}: ${stock.symbol}`);

                    let sma3Current: number, sma3Previous: number, sma12Current: number, sma12Previous: number, macdHistogram: number;

                    // שימוש בנתונים מקומיים בלבד - מהיר O(1)
                    console.log(`🔍 Using local data for ${stock.symbol}...`);
                    
                    const historicalData = getLocalHistoricalData(stock.symbol, selectedDate, 35);
                    if (historicalData.length < 35) {
                        console.warn(`⚠️ Not enough local data for ${stock.symbol} (need 35+ days, got ${historicalData.length})`);
                        continue;
                    }

                    // חישוב SMA3 ו-SMA12 מהנתונים המקומיים
                    const sma3Values = calculateLocalSMA(historicalData, 3);
                    const sma12Values = calculateLocalSMA(historicalData, 12);
                    const macdData = calculateLocalMACD(historicalData, 12, 26, 9);

                    if (sma3Values.length < 2 || sma12Values.length < 2 || macdData.histogram.length < 1) {
                        console.warn(`⚠️ Not enough calculated data for ${stock.symbol}: SMA3=${sma3Values.length}, SMA12=${sma12Values.length}, MACD=${macdData.histogram.length}`);
                        continue;
                    }

                    sma3Current = sma3Values[sma3Values.length - 1];
                    sma3Previous = sma3Values[sma3Values.length - 2];
                    sma12Current = sma12Values[sma12Values.length - 1];
                    sma12Previous = sma12Values[sma12Values.length - 2];
                    macdHistogram = macdData.histogram[macdData.histogram.length - 1];

                    console.log(`📊 ${stock.symbol} local calculations:`, {
                        sma3Current: sma3Current.toFixed(4),
                        sma3Previous: sma3Previous.toFixed(4),
                        sma12Current: sma12Current.toFixed(4),
                        sma12Previous: sma12Previous.toFixed(4),
                        macdHistogram: macdHistogram.toFixed(4)
                    });

                    console.log(`📊 ${stock.symbol} values:`, {
                        sma3Current: sma3Current.toFixed(4),
                        sma3Previous: sma3Previous.toFixed(4),
                        sma12Current: sma12Current.toFixed(4), 
                        sma12Previous: sma12Previous.toFixed(4),
                        macdHistogram: macdHistogram.toFixed(4)
                    });

                    // זיהוי חצייה
                    const crossoverType = detectCrossover(sma3Current, sma3Previous, sma12Current, sma12Previous);

                    // חישוב ציון ללונג בלבד
                    const longMomentumScore = calculateLongMomentumScore(crossoverType, macdHistogram);

                    const result: MomentumResult = {
                        symbol: stock.symbol,
                        name: stock.name,
                        currentPrice: stock.price,
                        sma3Current,
                        sma3Previous,
                        sma12Current,
                        sma12Previous,
                        crossoverType,
                        macdHistogram,
                        LongMomentumScore: longMomentumScore,
                        analysisDate: selectedDate,
                        calculationDate: new Date().toISOString().split('T')[0]
                    };

                    results.push(result);

                    console.log(`✅ ${stock.symbol} LongMomentumScore analysis:`, {
                        crossover: crossoverType,
                        macdHistogram: macdHistogram.toFixed(4),
                        score: longMomentumScore
                    });

                } catch (stockError) {
                    console.error(`❌ Error processing ${stock.symbol}:`, stockError);
                }

                // אין צורך בהשהייה כי הנתונים מקומיים (O(1) lookup)
            }

            setMomentumResults(results);
            setProgress(100);

            console.log(`🎉 Momentum analysis completed: ${results.length}/${totalStocks} stocks processed`);
            
            const excellentScores = results.filter(r => r.LongMomentumScore >= 80).length;
            const goodScores = results.filter(r => r.LongMomentumScore >= 60 && r.LongMomentumScore < 80).length;
            const weakScores = results.filter(r => r.LongMomentumScore < 60).length;

            alert(`ניתוח מומנטום ללונג הושלם! 📊\n\n` +
                  `🔥 מעולה (80+): ${excellentScores}\n` +
                  `✅ טוב (60-79): ${goodScores}\n` +
                  `❄️ חלש (<60): ${weakScores}\n\n` +
                  `סה"כ מניות: ${results.length}/${totalStocks}\n` +
                  `תאריך ניתוח: ${selectedDate}`);

        } catch (error) {
            console.error('❌ Error in momentum analysis:', error);
            setError(`שגיאה בניתוח מומנטום: ${error}`);
        } finally {
            setIsCalculating(false);
            setCurrentStock('');
        }
    };

    // שמירה לFirebase
    // עדכון relative-strength עם תוצאות ניתוח מומנטום
    const saveToFirebase = async () => {
        if (momentumResults.length === 0) {
            setError('אין תוצאות לשמירה');
            return;
        }

        try {
            // עדכון קולקציית relative-strength עם ציוני מומנטום
            const relativeStrengthDocId = `${selectedDate}_relative_strength`;
            console.log(`🔄 Updating relative-strength document: ${relativeStrengthDocId}`);
            
            const relativeStrengthRef = doc(db, 'relative-strength', relativeStrengthDocId);
            const docSnap = await getDoc(relativeStrengthRef);
            
            if (!docSnap.exists()) {
                throw new Error(`לא נמצא מסמך relative-strength עבור תאריך ${selectedDate}. רוץ תחילה BSpy`);
            }
            
            const existingData = docSnap.data();

            if (existingData?.results) {
                    const updatedResults = existingData.results.map((stock: any) => {
                        const momentumResult = momentumResults.find(m => m.symbol === stock.symbol);
                        if (momentumResult) {
                            return {
                                ...stock,
                                LongMomentumScore: momentumResult.LongMomentumScore,
                                crossoverType: momentumResult.crossoverType,
                                macdHistogram: momentumResult.macdHistogram,
                                momentumAnalysisDate: selectedDate,
                                lastMomentumUpdate: new Date().toISOString()
                            };
                        }
                        return stock;
                    });

                    // עדכון המסמך
                    await updateDoc(relativeStrengthRef, {
                        results: updatedResults,
                        lastMomentumUpdate: new Date().toISOString(),
                        momentumAnalysisCompleted: true
                    });
                
                console.log(`✅ Updated relative-strength document ${relativeStrengthDocId} with momentum scores`);
                
                // חישוב סטטיסטיקות לתצוגה - Long בלבד
                const avgScore = momentumResults.reduce((sum, r) => sum + r.LongMomentumScore, 0) / momentumResults.length;
                const maxScore = Math.max(...momentumResults.map(r => r.LongMomentumScore));
                const minScore = Math.min(...momentumResults.map(r => r.LongMomentumScore));
                const excellentScores = momentumResults.filter(r => r.LongMomentumScore >= 80).length;
                const goodScores = momentumResults.filter(r => r.LongMomentumScore >= 60 && r.LongMomentumScore < 80).length;
                const weakScores = momentumResults.filter(r => r.LongMomentumScore < 60).length;
                const bullishCrossovers = momentumResults.filter(r => r.crossoverType === 'Bullish').length;
                const bearishCrossovers = momentumResults.filter(r => r.crossoverType === 'Bearish').length;

                alert(`תוצאות ניתוח מומנטום ללונג עודכנו ב-relative-strength בהצלחה! 📊\n\n` +
                      `📅 תאריך: ${selectedDate}\n` +
                      `🔍 מניות שנותחו: ${momentumResults.length}\n\n` +
                      `🔥 מעולה (80+): ${excellentScores}\n` +
                      `✅ טוב (60-79): ${goodScores}\n` +
                      `❄️ חלש (<60): ${weakScores}\n\n` +
                      `🎯 ציונים LongMomentumScore:\n` +
                      `• ממוצע: ${avgScore.toFixed(1)}\n` +
                      `• מקסימום: ${maxScore}\n` +
                      `• מינימום: ${minScore}\n\n` +
                      `📊 קרוסאוברים:\n` +
                      `• שוריים: ${bullishCrossovers}\n` +
                      `• דוביים: ${bearishCrossovers}\n\n` +
                      `💾 עודכן ב-relative-strength/${relativeStrengthDocId}`);
                      
            } else {
                throw new Error('לא נמצאו נתונים במסמך relative-strength');
            }

        } catch (error) {
            console.error('❌ Error saving to Firebase:', error);
            setError(`שגיאה בשמירה: ${error}`);
        }
    };

    return (
        <Box sx={{ padding: 3, maxWidth: 1400, margin: '0 auto' }}>
            {/* כותרת */}
            <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SignalCellularAlt color="primary" />
                DSignals - תחנה 4: מומנטום ראשוני ללונג בלבד
            </Typography>

            {/* הסבר */}
            <Alert severity="info" sx={{ mb: 3 }}>
                📊 <strong>תחנה 4: מדדי תנודתיות וחוזק ללונג:</strong><br/>
                🔹 <strong>SMA Crossover:</strong> חצייה של SMA3 מול SMA12 (Bull/Bear)<br/>
                🔹 <strong>MACD Histogram:</strong> אישור מומנטום (&gt;0 עולה, &lt;0 יורד)<br/>
                🔹 <strong>LongMomentumScore:</strong> ציון ללונג בלבד (1-100)
            </Alert>

            {/* בחירת תאריך לניתוח */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        בחירת תאריך לניתוח מומנטום
                    </Typography>

                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                תאריך ניתוח:
                            </Typography>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    maxWidth: '300px',
                                    padding: '12px',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    fontSize: '16px'
                                }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="body2" color="textSecondary">
                                ⭐ מניות מועדפות: {favoriteStocks.length}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                📊 מקור נתונים: 📁 מקומי בלבד
                            </Typography>
                            {localData && (
                                <Typography variant="body2" color="textSecondary">
                                    📅 טווח נתונים: {localData.metadata.startDate} עד {localData.metadata.endDate} ({Object.keys(dataIndex).length} מניות)
                                </Typography>
                            )}
                        </Box>

                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="contained"
                                startIcon={<PlayArrow />}
                                onClick={analyzeMomentum}
                                disabled={isCalculating || !selectedDate || favoriteStocks.length === 0}
                                sx={{ backgroundColor: '#1976d2' }}
                            >
                                🚀 נתח מומנטום ({favoriteStocks.length} מניות) - 📁 מקומי בלבד
                            </Button>

                            <Button
                                variant="outlined"
                                onClick={() => {
                                    // dataSource is always 'local' now
                                }}
                                disabled={isCalculating}
                            >
                                📁 מקומי בלבד
                            </Button>

                            <Button
                                variant="outlined"
                                onClick={() => {
                                    console.log('🔍 Debug button clicked');
                                    console.log('selectedDate:', selectedDate);
                                    console.log('favoriteStocks:', favoriteStocks);
                                    console.log('Using local data only');
                                    alert(`Debug Info:\nDate: ${selectedDate}\nStocks: ${favoriteStocks.length}\nData Source: Local Only`);
                                }}
                            >
                                🔍 דיבוג מהיר
                            </Button>

                            <Button
                                variant="contained"
                                startIcon={<Save />}
                                onClick={saveToFirebase}
                                disabled={momentumResults.length === 0}
                                sx={{ backgroundColor: '#4caf50' }}
                            >
                                💾 שמור ל-Firebase ({momentumResults.length})
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            {/* פרוגרס בר */}
            {isCalculating && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            🔄 מנתח מומנטום...
                        </Typography>
                        <LinearProgress 
                            variant="determinate" 
                            value={progress} 
                            sx={{ mb: 2, height: 10, borderRadius: 5 }} 
                        />
                        <Typography variant="body2" color="textSecondary">
                            {currentStock ? `מנתח: ${currentStock}` : `התקדמות: ${progress.toFixed(1)}%`}
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {/* הודעת שגיאה */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* טבלת תוצאות */}
            {momentumResults.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            📊 תוצאות ניתוח מומנטום ללונג (ציון לפי LongMomentumScore {selectedDate})
                        </Typography>

                        {/* סיכום ציונים Long */}
                        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                            <Chip 
                                icon={<TrendingUp />} 
                                label={`🔥 מעולה (80+): ${momentumResults.filter(r => r.LongMomentumScore >= 80).length}`}
                                color="success" 
                            />
                            <Chip 
                                icon={<TrendingUp />} 
                                label={`✅ טוב (60-79): ${momentumResults.filter(r => r.LongMomentumScore >= 60 && r.LongMomentumScore < 80).length}`}
                                color="primary" 
                            />
                            <Chip 
                                icon={<Remove />} 
                                label={`❄️ חלש (<60): ${momentumResults.filter(r => r.LongMomentumScore < 60).length}`}
                                color="default" 
                            />
                        </Stack>

                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>סימבול</strong></TableCell>
                                        <TableCell><strong>שם</strong></TableCell>
                                        <TableCell><strong>מחיר</strong></TableCell>
                                        <TableCell><strong>SMA Crossover</strong></TableCell>
                                        <TableCell><strong>MACD Histogram</strong></TableCell>
                                        <TableCell><strong>ציון LongMomentumScore</strong></TableCell>
                                        <TableCell><strong>סטטוס</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {momentumResults.map((result, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{result.symbol}</TableCell>
                                            <TableCell>{result.name}</TableCell>
                                            <TableCell>${result.currentPrice.toFixed(2)}</TableCell>
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
                                                    color={result.macdHistogram > 0 ? 'success.main' : result.macdHistogram < 0 ? 'error.main' : 'text.secondary'}
                                                >
                                                    {result.macdHistogram.toFixed(4)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body1" 
                                                    fontWeight="bold"
                                                    style={{
                                                        color: result.LongMomentumScore >= 80 ? 'green' : 
                                                               result.LongMomentumScore >= 60 ? 'blue' : 'orange',
                                                        fontSize: '1.1rem'
                                                    }}
                                                >
                                                    {result.LongMomentumScore}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {result.LongMomentumScore >= 80 ? '🔥 מעולה' : 
                                                     result.LongMomentumScore >= 60 ? '✅ טוב' : '❄️ חלש'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2" 
                                                    style={{
                                                        color: result.crossoverType === 'Bullish' ? 'green' : 
                                                               result.crossoverType === 'Bearish' ? 'red' : 'orange',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {result.crossoverType}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {result.crossoverType === 'Bullish' ? '📈 טוב ללונג' : 
                                                     result.crossoverType === 'Bearish' ? '📉 לא טוב ללונג' : '😐 ניטרלי'}
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
