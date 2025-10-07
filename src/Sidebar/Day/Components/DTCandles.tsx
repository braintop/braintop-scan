import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Button,
    Alert,
    Box,
    Stack,
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
import { TrendingUp, Remove, PlayArrow, Save } from '@mui/icons-material';
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

interface DSignalsResult {
    symbol: string;
    name: string;
    currentPrice: number;
    crossoverType: 'Bullish' | 'Bearish' | 'None';
    LongMomentumScore: number;
    macdHistogram: number;
    sma3Current: number;
    sma12Current: number;
    analysisDate: string;
}

interface CandleResult {
    symbol: string;
    name: string;
    currentPrice: number;
    candleScore: number; // 0-100
    detectedPatterns: string[];
    analysisDate: string;
    calculationDate: string;
}

interface OHLCData {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjusted_close?: number;
}

interface LocalStockData {
    metadata: {
        created: string;
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
    };
    data: OHLCData[];
}

// Import Candle Configuration
import { CANDLE_CONFIG } from './CandleConfig';

const db = getFirestore();

export default function DTCandles() {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [favoriteStocks, setFavoriteStocks] = useState<FavoriteStock[]>([]);
    const [candleResults, setCandleResults] = useState<CandleResult[]>([]);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string>('');
    const [currentStock, setCurrentStock] = useState<string>('');
    
    // נתונים מקומיים
    const [localData, setLocalData] = useState<LocalStockData | null>(null);
    const [dataIndex, setDataIndex] = useState<{[symbol: string]: {[date: string]: any}}>({});

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
            console.log(`📊 Loaded ${stocksData.length} favorite stocks for candle analysis`);
            
        } catch (error) {
            console.error('❌ Error loading favorite stocks:', error);
            setError('שגיאה בטעינת מניות מועדפות');
        }
    };

    // טעינת נתונים מקומיים
    const loadLocalData = async () => {
        try {
            console.log('📁 Loading local data for DTCandles...');
            const startTime = Date.now();
            
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
                
                const indexTime = Date.now() - indexStartTime;
                const totalTime = Date.now() - startTime;
                
                console.log('✅ Local data loaded and indexed for DTCandles:', {
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
        }
    };

    // פונקציות עזר לנתונים מקומיים
    const findLocalData = (symbol: string, date: string) => {
        if (!dataIndex || !dataIndex[symbol]) {
            console.warn(`⚠️ No data index for symbol: ${symbol}`);
            return null;
        }
        return dataIndex[symbol][date] || null;
    };

    const getLocalHistoricalData = (symbol: string, endDate: string, days: number = 30) => {
        if (!dataIndex || !dataIndex[symbol]) {
            console.warn(`⚠️ No data index for symbol: ${symbol}`);
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
            }
            
            // עבור ליום הקודם
            currentDate.setDate(currentDate.getDate() - 1);
            iterations++;
        }
        
        console.log(`📊 Found ${results.length} trading days of data for ${symbol} (needed ${days})`);
        return results;
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

    // זיהוי Hammer
    const detectHammer = (candle: OHLCData): boolean => {
        const body = Math.abs(candle.close - candle.open);
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        const upperShadow = candle.high - Math.max(candle.open, candle.close);
        const totalRange = candle.high - candle.low;
        
        // קריטריונים ל-Hammer:
        // 1. גוף קטן (≤ 30% מהטווח)
        // 2. צל תחתון ארוך (≥ פי 2 מהגוף)
        // 3. צל עליון קצר (≤ 10% מהגוף)
        // 4. סגירה קרובה ל-High
        
        const smallBody = body <= totalRange * 0.3;
        const longLowerShadow = lowerShadow >= body * 2;
        const shortUpperShadow = upperShadow <= body * 0.5;
        const closesNearHigh = candle.close >= candle.low + (totalRange * 0.8);
        
        return smallBody && longLowerShadow && shortUpperShadow && closesNearHigh;
    };

    // זיהוי Bullish Engulfing
    const detectBullishEngulfing = (prevCandle: OHLCData, currentCandle: OHLCData): boolean => {
        // קריטריונים:
        // 1. נר קודם אדום
        // 2. נר נוכחי ירוק
        // 3. נר ירוק "בולע" נר אדום
        // 4. גוף ירוק גדול יותר מגוף אדום
        
        const prevIsRed = prevCandle.close < prevCandle.open;
        const currentIsGreen = currentCandle.close > currentCandle.open;
        const engulfs = currentCandle.open < prevCandle.close && 
                       currentCandle.close > prevCandle.open;
        
        const greenBody = currentCandle.close - currentCandle.open;
        const redBody = prevCandle.open - prevCandle.close;
        const largerBody = greenBody > redBody;
        
        return prevIsRed && currentIsGreen && engulfs && largerBody;
    };

    // זיהוי Piercing Line
    const detectPiercingLine = (prevCandle: OHLCData, currentCandle: OHLCData): boolean => {
        const prevIsRed = prevCandle.close < prevCandle.open;
        const prevBody = prevCandle.open - prevCandle.close;
        const prevIsLong = prevBody > (prevCandle.high - prevCandle.low) * 0.6;
        
        const currentIsGreen = currentCandle.close > currentCandle.open;
        const gapsDown = currentCandle.open < prevCandle.close;
        const closesInRedBody = currentCandle.close > prevCandle.open && 
                               currentCandle.close < prevCandle.close;
        const closesAboveMid = currentCandle.close > (prevCandle.open + prevCandle.close) / 2;
        
        return prevIsRed && prevIsLong && currentIsGreen && 
               gapsDown && closesInRedBody && closesAboveMid;
    };

    // זיהוי Morning Star
    const detectMorningStar = (candles: OHLCData[]): boolean => {
        if (candles.length < 3) return false;
        
        const [prev2, prev1, current] = candles.slice(-3);
        
        const firstIsRed = prev2.close < prev2.open;
        const firstIsLong = (prev2.open - prev2.close) > (prev2.high - prev2.low) * 0.6;
        
        const secondIsSmall = Math.abs(prev1.close - prev1.open) < (prev1.high - prev1.low) * 0.3;
        const secondGapsDown = prev1.open < prev2.close;
        
        const thirdIsGreen = current.close > current.open;
        const thirdIsLong = (current.close - current.open) > (current.high - current.low) * 0.6;
        const thirdGapsUp = current.open > prev1.close;
        
        const closesAboveFirstMid = current.close > (prev2.open + prev2.close) / 2;
        
        return firstIsRed && firstIsLong && secondIsSmall && secondGapsDown &&
               thirdIsGreen && thirdIsLong && thirdGapsUp && closesAboveFirstMid;
    };

    // זיהוי Inverted Hammer
    const detectInvertedHammer = (candle: OHLCData): boolean => {
        const body = Math.abs(candle.close - candle.open);
        const upperShadow = candle.high - Math.max(candle.open, candle.close);
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        const totalRange = candle.high - candle.low;
        
        const smallBody = body <= totalRange * 0.3;
        const longUpperShadow = upperShadow >= body * 2;
        const shortLowerShadow = lowerShadow <= body * 0.5;
        const closesNearLow = candle.close <= candle.low + (totalRange * 0.2);
        
        return smallBody && longUpperShadow && shortLowerShadow && closesNearLow;
    };

    // זיהוי Three White Soldiers
    const detectThreeWhiteSoldiers = (candles: OHLCData[]): boolean => {
        if (candles.length < 3) return false;
        
        const [prev2, prev1, current] = candles.slice(-3);
        
        const allGreen = prev2.close > prev2.open && 
                        prev1.close > prev1.open && 
                        current.close > current.open;
        
        const increasingBodies = (prev1.close - prev1.open) > (prev2.close - prev2.open) &&
                               (current.close - current.open) > (prev1.close - prev1.open);
        
        const opensInPrevBody = prev1.open > prev2.open && prev1.open < prev2.close &&
                              current.open > prev1.open && current.open < prev1.close;
        
        const higherCloses = prev1.close > prev2.close && current.close > prev1.close;
        
        return allGreen && increasingBodies && opensInPrevBody && higherCloses;
    };

    // ניתוח נרות למניה
    const analyzeCandlesForStock = async (stock: FavoriteStock, dSignalsResult: DSignalsResult): Promise<CandleResult> => {
        console.log(`🕯️ Analyzing candles for ${stock.symbol}...`);
        
        try {
            // קבלת נתונים היסטוריים
            const historicalData = getLocalHistoricalData(stock.symbol, selectedDate, 10);
            if (historicalData.length < 3) {
                console.warn(`⚠️ Not enough data for candle analysis: ${stock.symbol}`);
                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.price,
                    candleScore: 0,
                    detectedPatterns: [],
                    analysisDate: selectedDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                };
            }

            const currentCandle = historicalData[historicalData.length - 1];
            const prevCandle = historicalData[historicalData.length - 2];
            
            let score = 0;
            const detectedPatterns: string[] = [];

            // בדיקת Hammer - דורש ירידה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Hammer', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                detectHammer(currentCandle)) {
                score += CANDLE_CONFIG.WEIGHTS.HAMMER;
                detectedPatterns.push('Hammer');
                console.log(`✅ Hammer detected for ${stock.symbol}`);
            }

            // בדיקת Bullish Engulfing - דורש עלייה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Bullish Engulfing', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                detectBullishEngulfing(prevCandle, currentCandle)) {
                score += CANDLE_CONFIG.WEIGHTS.BULLISH_ENGULFING;
                detectedPatterns.push('Bullish Engulfing');
                console.log(`✅ Bullish Engulfing detected for ${stock.symbol}`);
            }

            // בדיקת Piercing Line - דורש ירידה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Piercing Line', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                detectPiercingLine(prevCandle, currentCandle)) {
                score += CANDLE_CONFIG.WEIGHTS.PIERCING_LINE;
                detectedPatterns.push('Piercing Line');
                console.log(`✅ Piercing Line detected for ${stock.symbol}`);
            }

            // בדיקת Morning Star - דורש ירידה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Morning Star', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                detectMorningStar(historicalData)) {
                score += CANDLE_CONFIG.WEIGHTS.MORNING_STAR;
                detectedPatterns.push('Morning Star');
                console.log(`✅ Morning Star detected for ${stock.symbol}`);
            }

            // בדיקת Inverted Hammer - דורש ירידה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Inverted Hammer', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                detectInvertedHammer(currentCandle)) {
                score += CANDLE_CONFIG.WEIGHTS.INVERTED_HAMMER;
                detectedPatterns.push('Inverted Hammer');
                console.log(`✅ Inverted Hammer detected for ${stock.symbol}`);
            }

            // בדיקת Three White Soldiers - דורש עלייה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Three White Soldiers', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                detectThreeWhiteSoldiers(historicalData)) {
                score += CANDLE_CONFIG.WEIGHTS.THREE_WHITE_SOLDIERS;
                detectedPatterns.push('Three White Soldiers');
                console.log(`✅ Three White Soldiers detected for ${stock.symbol}`);
            }

            console.log(`📊 ${stock.symbol} candle analysis:`, {
                score,
                patterns: detectedPatterns,
                dSignalsScore: dSignalsResult.LongMomentumScore,
                crossoverType: dSignalsResult.crossoverType
            });

            return {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.price,
                candleScore: Math.min(score, 100), // מקסימום 100
                detectedPatterns,
                analysisDate: selectedDate,
                calculationDate: new Date().toISOString().split('T')[0]
            };

        } catch (error) {
            console.error(`❌ Error analyzing candles for ${stock.symbol}:`, error);
            return {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.price,
                candleScore: 0,
                detectedPatterns: [],
                analysisDate: selectedDate,
                calculationDate: new Date().toISOString().split('T')[0]
            };
        }
    };

    // פונקציה ראשית לניתוח נרות
    const analyzeCandles = async () => {
        console.log('🔄 analyzeCandles called');
        
        if (!validateInputs()) {
            console.log('❌ Validation failed');
            return;
        }

        setIsCalculating(true);
        setProgress(0);
        setError('');
        setCandleResults([]);

        const results: CandleResult[] = [];
        const totalStocks = favoriteStocks.length;

        try {
            console.log(`🚀 Starting candle analysis for ${totalStocks} stocks on ${selectedDate}`);
            
            // טעינת תוצאות DSignals מ-Firebase
            const relativeStrengthDocId = `${selectedDate}_relative_strength`;
            console.log(`📊 Loading DSignals results from: ${relativeStrengthDocId}`);
            
            const relativeStrengthRef = doc(db, 'relative-strength', relativeStrengthDocId);
            const docSnap = await getDoc(relativeStrengthRef);
            
            if (!docSnap.exists()) {
                throw new Error(`לא נמצא מסמך relative-strength עבור תאריך ${selectedDate}. רוץ תחילה DSignals`);
            }
            
            const existingData = docSnap.data();
            const dSignalsResults = existingData?.results || [];
            
            console.log(`📊 Found ${dSignalsResults.length} DSignals results`);

            for (let i = 0; i < favoriteStocks.length; i++) {
                const stock = favoriteStocks[i];
                setCurrentStock(stock.symbol);
                setProgress(((i + 1) / totalStocks) * 100);

                try {
                    console.log(`🕯️ Processing ${i + 1}/${totalStocks}: ${stock.symbol}`);

                    // מציאת תוצאות DSignals עבור המניה
                    const dSignalsResult = dSignalsResults.find((d: any) => d.symbol === stock.symbol);
                    
                    if (!dSignalsResult) {
                        console.warn(`⚠️ No DSignals result found for ${stock.symbol}`);
                        continue;
                    }

                    // ניתוח נרות
                    const candleResult = await analyzeCandlesForStock(stock, dSignalsResult);
                    results.push(candleResult);

                } catch (stockError) {
                    console.error(`❌ Error processing ${stock.symbol}:`, stockError);
                }
            }

            setCandleResults(results);
            setProgress(100);

            console.log(`🎉 Candle analysis completed: ${results.length}/${totalStocks} stocks processed`);
            
            const excellentScores = results.filter(r => r.candleScore >= CANDLE_CONFIG.THRESHOLDS.EXCELLENT).length;
            const goodScores = results.filter(r => r.candleScore >= CANDLE_CONFIG.THRESHOLDS.GOOD && r.candleScore < CANDLE_CONFIG.THRESHOLDS.EXCELLENT).length;
            const weakScores = results.filter(r => r.candleScore < CANDLE_CONFIG.THRESHOLDS.GOOD).length;

            alert(`ניתוח נרות ללונג הושלם! 🕯️\n\n` +
                  `🔥 מעולה (50+): ${excellentScores}\n` +
                  `✅ טוב (25-49): ${goodScores}\n` +
                  `❄️ חלש (<25): ${weakScores}\n\n` +
                  `סה"כ מניות: ${results.length}/${totalStocks}\n` +
                  `תאריך ניתוח: ${selectedDate}`);

        } catch (error) {
            console.error('❌ Error in candle analysis:', error);
            setError(`שגיאה בניתוח נרות: ${error}`);
        } finally {
            setIsCalculating(false);
            setCurrentStock('');
        }
    };

    // שמירה לFirebase
    const saveToFirebase = async () => {
        if (candleResults.length === 0) {
            setError('אין תוצאות לשמירה');
            return;
        }

        try {
            // עדכון קולקציית relative-strength עם ציוני נרות
            const relativeStrengthDocId = `${selectedDate}_relative_strength`;
            console.log(`🔄 Updating relative-strength document: ${relativeStrengthDocId}`);
            
            const relativeStrengthRef = doc(db, 'relative-strength', relativeStrengthDocId);
            const docSnap = await getDoc(relativeStrengthRef);
            
            if (!docSnap.exists()) {
                throw new Error(`לא נמצא מסמך relative-strength עבור תאריך ${selectedDate}. רוץ תחילה DSignals`);
            }
            
            const existingData = docSnap.data();

            if (existingData?.results) {
                const updatedResults = existingData.results.map((stock: any) => {
                    const candleResult = candleResults.find(c => c.symbol === stock.symbol);
                    if (candleResult) {
                        return {
                            ...stock,
                            candleScore: candleResult.candleScore,
                            detectedPatterns: candleResult.detectedPatterns,
                            candleAnalysisDate: selectedDate,
                            lastCandleUpdate: new Date().toISOString()
                        };
                    }
                    return stock;
                });

                // עדכון המסמך
                await updateDoc(relativeStrengthRef, {
                    results: updatedResults,
                    lastCandleUpdate: new Date().toISOString(),
                    candleAnalysisCompleted: true
                });
                
                console.log(`✅ Updated relative-strength document ${relativeStrengthDocId} with candle scores`);
                
                // חישוב סטטיסטיקות לתצוגה
                const avgScore = candleResults.reduce((sum, r) => sum + r.candleScore, 0) / candleResults.length;
                const maxScore = Math.max(...candleResults.map(r => r.candleScore));
                const minScore = Math.min(...candleResults.map(r => r.candleScore));
                const excellentScores = candleResults.filter(r => r.candleScore >= 50).length;
                const goodScores = candleResults.filter(r => r.candleScore >= 25 && r.candleScore < 50).length;
                const weakScores = candleResults.filter(r => r.candleScore < 25).length;

                alert(`תוצאות ניתוח נרות ללונג עודכנו ב-relative-strength בהצלחה! 🕯️\n\n` +
                      `📅 תאריך: ${selectedDate}\n` +
                      `🔍 מניות שנותחו: ${candleResults.length}\n\n` +
                      `🔥 מעולה (50+): ${excellentScores}\n` +
                      `✅ טוב (25-49): ${goodScores}\n` +
                      `❄️ חלש (<25): ${weakScores}\n\n` +
                      `🎯 ציוני נרות:\n` +
                      `• ממוצע: ${avgScore.toFixed(1)}\n` +
                      `• מקסימום: ${maxScore}\n` +
                      `• מינימום: ${minScore}\n\n` +
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
                🕯️ DTCandles - תחנה 5: נרות Bullish ללונג
            </Typography>

            {/* הסבר */}
            <Alert severity="info" sx={{ mb: 3 }}>
                🕯️ <strong>תחנה 5: נרות Bullish ללונג:</strong><br/>
                🔹 <strong>Hammer:</strong> דחייה חזקה (25 נקודות)<br/>
                🔹 <strong>Bullish Engulfing:</strong> שינוי מגמה (25 נקודות)<br/>
                🔹 <strong>Piercing Line:</strong> התאוששות (20 נקודות)<br/>
                🔹 <strong>Morning Star:</strong> סיום מגמה (15 נקודות)<br/>
                🔹 <strong>Inverted Hammer:</strong> דחייה למעלה (10 נקודות)<br/>
                🔹 <strong>Three White Soldiers:</strong> מגמה עולה (5 נקודות)
            </Alert>

            {/* בחירת תאריך לניתוח */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        בחירת תאריך לניתוח נרות
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
                                📊 מקור נתונים: 📁 מקומי + DSignals מ-Firebase
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
                                onClick={() => analyzeCandles()}
                                disabled={isCalculating || !selectedDate || favoriteStocks.length === 0}
                                sx={{ backgroundColor: '#1976d2' }}
                            >
                                🕯️ נתח נרות ({favoriteStocks.length} מניות) - עם DSignals
                            </Button>

                            <Button
                                variant="contained"
                                startIcon={<Save />}
                                onClick={saveToFirebase}
                                disabled={candleResults.length === 0}
                                sx={{ backgroundColor: '#4caf50' }}
                            >
                                💾 שמור ל-Firebase ({candleResults.length})
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
                            🕯️ מנתח נרות...
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
            {candleResults.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            🕯️ תוצאות ניתוח נרות ללונג (ציון לפי CandleScore {selectedDate})
                        </Typography>

                        {/* סיכום ציונים */}
                        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                            <Chip 
                                icon={<TrendingUp />} 
                                label={`🔥 מעולה (50+): ${candleResults.filter(r => r.candleScore >= 50).length}`}
                                color="success" 
                            />
                            <Chip 
                                icon={<TrendingUp />} 
                                label={`✅ טוב (25-49): ${candleResults.filter(r => r.candleScore >= 25 && r.candleScore < 50).length}`}
                                color="primary" 
                            />
                            <Chip 
                                icon={<Remove />} 
                                label={`❄️ חלש (<25): ${candleResults.filter(r => r.candleScore < 25).length}`}
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
                                        <TableCell><strong>ציון נרות</strong></TableCell>
                                        <TableCell><strong>נרות שזוהו</strong></TableCell>
                                        <TableCell><strong>סטטוס</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {candleResults.map((result, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{result.symbol}</TableCell>
                                            <TableCell>{result.name}</TableCell>
                                            <TableCell>${result.currentPrice.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body1" 
                                                    fontWeight="bold"
                                                    style={{
                                                        color: result.candleScore >= 50 ? 'green' : 
                                                               result.candleScore >= 25 ? 'blue' : 'orange',
                                                        fontSize: '1.1rem'
                                                    }}
                                                >
                                                    {result.candleScore}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {result.candleScore >= 50 ? '🔥 מעולה' : 
                                                     result.candleScore >= 25 ? '✅ טוב' : '❄️ חלש'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {result.detectedPatterns.length > 0 ? (
                                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                                        {result.detectedPatterns.map((pattern, idx) => (
                                                            <Chip 
                                                                key={idx}
                                                                label={pattern}
                                                                size="small"
                                                                color="primary"
                                                                variant="outlined"
                                                            />
                                                        ))}
                                                    </Stack>
                                                ) : (
                                                    <Typography variant="body2" color="textSecondary">
                                                        אין נרות
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2" 
                                                    style={{
                                                        color: result.candleScore >= 50 ? 'green' : 
                                                               result.candleScore >= 25 ? 'blue' : 'orange',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {result.candleScore >= 50 ? '🔥 מעולה ללונג' : 
                                                     result.candleScore >= 25 ? '✅ טוב ללונג' : '❄️ חלש ללונג'}
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