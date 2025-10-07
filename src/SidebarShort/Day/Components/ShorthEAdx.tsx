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
import { TrendingUp, Remove, ShowChart, PlayArrow, Save } from '@mui/icons-material';
import { getFirestore, collection, doc, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import * as EAdxTypes from '../Types/EAdxTypes';
// import * as ShortEAdxLogic from '../Logic/ShortEAdxLogic';

// Interfaces are now imported from Types

const db = getFirestore();

export default function ShorthEAdx() {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [favoriteStocks, setFavoriteStocks] = useState<EAdxTypes.FavoriteStock[]>([]);
    const [momentumData, setMomentumData] = useState<any[]>([]);
    const [trendResults, setTrendResults] = useState<any[]>([]);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<string>('');
    const [currentStock, setCurrentStock] = useState<string>('');
    
    // נתונים מקומיים
    const [localData, setLocalData] = useState<EAdxTypes.LocalStockData | null>(null);
    const [dataIndex, setDataIndex] = useState<{[symbol: string]: {[date: string]: any}}>({});
    const [dataSource, setDataSource] = useState<'local' | 'polygon'>('local');

    // טעינת מניות מועדפות ונתוני מומנטום מFirebase
    useEffect(() => {
        loadFavoriteStocks();
        loadLocalData();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            loadMomentumData();
        }
    }, [selectedDate]);

    const loadFavoriteStocks = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'favorite'));
            
            let stocksData: EAdxTypes.FavoriteStock[] = [];
            querySnapshot.forEach((doc) => {
                if (doc.id === 'my-favorites') {
                    const data = doc.data();
                    if (data.stocks && Array.isArray(data.stocks)) {
                        stocksData = data.stocks;
                    }
                }
            });

            setFavoriteStocks(stocksData);
            console.log(`📊 Loaded ${stocksData.length} favorite stocks for trend analysis`);
            
        } catch (error) {
            console.error('❌ Error loading favorite stocks:', error);
            setError('שגיאה בטעינת מניות מועדפות');
        }
    };

    const loadMomentumData = async () => {
        try {
            const momentumDocId = `${selectedDate}_momentum_analysis`;
            const querySnapshot = await getDocs(collection(db, 'momentum-analysis'));
            
            let momentumResults: any[] = [];
            querySnapshot.forEach((doc) => {
                if (doc.id === momentumDocId) {
                    const data = doc.data();
                    if (data.results && Array.isArray(data.results)) {
                        momentumResults = data.results;
                    }
                }
            });

            setMomentumData(momentumResults);
            console.log(`📊 Loaded ${momentumResults.length} momentum results for ${selectedDate}`);
            
        } catch (error) {
            console.error('❌ Error loading momentum data:', error);
            setError('שגיאה בטעינת נתוני מומנטום');
        }
    };

    // טעינת נתונים מקומיים מהקובץ הגדול
    const loadLocalData = async () => {
        try {
            console.log('📁 Loading local data from single large file for ShorthEAdx...');
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
                
                const indexTime = Date.now() - indexStartTime;
                const totalTime = Date.now() - startTime;
                
                console.log('✅ Local data loaded and indexed for ShorthEAdx:', {
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
            console.warn(`⚠️ No data index for symbol: ${symbol}`, {
                hasDataIndex: !!dataIndex,
                hasSymbol: !!dataIndex?.[symbol],
                availableSymbols: dataIndex ? Object.keys(dataIndex).slice(0, 5) : []
            });
            return null;
        }
        return dataIndex[symbol][date] || null;
    };

    const getLocalHistoricalData = (symbol: string, endDate: string, days: number = 35) => {
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
        let daysSearched = 0;
        const maxDaysToSearch = days * 3; // מקסימום 3x מהמבוקש כדי למנוע לולאה אינסופית
        
        console.log(`🔍 Getting ${days} trading days of data for ${symbol} ending ${endDate}`);
        
        // חיפוש ימי מסחר אחורה מהתאריך שנבחר
        while (tradingDaysFound < days && daysSearched < maxDaysToSearch) {
            const dateStr = currentDate.toISOString().split('T')[0];
            
            const data = findLocalData(symbol, dateStr);
            if (data) {
                results.unshift(data); // הוספה בתחילה כדי לשמור על סדר כרונולוגי
                tradingDaysFound++;
            }
            
            // עבור ליום הקודם
            currentDate.setDate(currentDate.getDate() - 1);
            daysSearched++;
            
            // אם הגענו לתאריך מוקדם מדי (לפני 2020), נעצור
            if (currentDate.getFullYear() < 2020) {
                console.warn(`⚠️ Reached year 2020 for ${symbol}, stopping search`);
                break;
            }
        }
        
        if (daysSearched >= maxDaysToSearch) {
            console.warn(`⚠️ Reached maximum search limit for ${symbol}. Found ${results.length} days out of ${days} requested`);
        }
        
        console.log(`📊 Found ${results.length} trading days of data for ${symbol} (needed ${days})`);
        
        // אם לא מצאנו מספיק נתונים (כמו במקרה של מניות חדשות), נחזיר מה שיש
        if (results.length < days) {
            console.warn(`⚠️ ${symbol} has only ${results.length} trading days available (needed ${days}). This might be a new stock.`);
        }
        
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

    // חישוב ADX עצמי מנתוני OHLC (כיוון ש-Polygon לא מספקת ADX ישירות)
    const calculateADXFromOHLC = async (symbol: string, targetDate: string): Promise<number> => {
        try {
            let ohlcData: any[];

            if (dataSource === 'local' && localData) {
                // שימוש בנתונים מקומיים - מהיר O(1)
                console.log(`🔍 Using local data for ADX calculation: ${symbol}`);
                
                const historicalData = getLocalHistoricalData(symbol, targetDate, 35);
                if (historicalData.length < 20) {
                    throw new Error(`Insufficient local data for ADX calculation: ${historicalData.length} days`);
                }

                // המרה לפורמט Polygon
                ohlcData = historicalData.map(item => ({
                    h: item.high,
                    l: item.low,
                    c: item.close
                }));

                console.log(`📊 Got ${ohlcData.length} local OHLC candles for ${symbol}`);

            } else {
                // שימוש ב-Polygon API - איטי
                console.log(`🔍 Fetching OHLC data from Polygon for ADX calculation: ${symbol}`);
                
                const endDate = targetDate;
                const startDateObj = new Date(targetDate);
                startDateObj.setDate(startDateObj.getDate() - 35); // 35 ימים אחורה
                const startDate = startDateObj.toISOString().split('T')[0];

                const historicalData = await fetch(
                    `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}?adjusted=true&apikey=${import.meta.env.VITE_POLYGON_API_KEY}`
                );

                if (!historicalData.ok) {
                    throw new Error(`Failed to fetch OHLC data: ${historicalData.status}`);
                }

                const data = await historicalData.json();
                
                if (!data.results || data.results.length < 20) {
                    throw new Error(`Insufficient OHLC data for ADX calculation: ${data.results?.length || 0} days`);
                }

                ohlcData = data.results;
                console.log(`📊 Got ${ohlcData.length} OHLC candles for ${symbol}`);
            }

            // חישוב ADX מפושט (מבוסס על תנודתיות ומומנטום)
            const adxValue = calculateSimplifiedADX(ohlcData);
            
            console.log(`✅ Calculated ADX for ${symbol}: ${adxValue.toFixed(2)}`);
            return adxValue;
            
        } catch (error) {
            console.error(`❌ Error calculating ADX for ${symbol}:`, error);
            throw error;
        }
    };

    // חישוב ADX מפושט
    const calculateSimplifiedADX = (ohlcData: any[]): number => {
        if (ohlcData.length < 14) {
            return 25; // ערך ברירת מחדל
        }

        try {
            // חישוב ATR (Average True Range)
            let atrSum = 0;
            for (let i = 1; i < Math.min(15, ohlcData.length); i++) {
                const current = ohlcData[i];
                const previous = ohlcData[i - 1];
                
                const tr1 = current.h - current.l; // High - Low
                const tr2 = Math.abs(current.h - previous.c); // High - Previous Close
                const tr3 = Math.abs(current.l - previous.c); // Low - Previous Close
                
                const trueRange = Math.max(tr1, tr2, tr3);
                atrSum += trueRange;
            }
            const atr = atrSum / 14;

            // חישוב +DM ו-DM מפושט
            let plusDM = 0;
            let minusDM = 0;
            let count = 0;

            for (let i = 1; i < Math.min(15, ohlcData.length); i++) {
                const current = ohlcData[i];
                const previous = ohlcData[i - 1];
                
                const upMove = current.h - previous.h;
                const downMove = previous.l - current.l;
                
                if (upMove > downMove && upMove > 0) {
                    plusDM += upMove;
                }
                if (downMove > upMove && downMove > 0) {
                    minusDM += downMove;
                }
                count++;
            }

            plusDM = plusDM / count;
            minusDM = minusDM / count;

            // חישוב +DI ו-DI
            const plusDI = (plusDM / atr) * 100;
            const minusDI = (minusDM / atr) * 100;

            // חישוב DX
            const diSum = plusDI + minusDI;
            const diDiff = Math.abs(plusDI - minusDI);
            
            let dx = 0;
            if (diSum > 0) {
                dx = (diDiff / diSum) * 100;
            }

            // ADX הוא ממוצע נע של DX (מפושט)
            let adx = dx;
            
            // נרמול להיות בטווח סביר (15-85)
            adx = Math.max(15, Math.min(85, adx));
            
            console.log(`📊 ADX calculation details:`, {
                atr: atr.toFixed(3),
                plusDI: plusDI.toFixed(2),
                minusDI: minusDI.toFixed(2),
                dx: dx.toFixed(2),
                adx: adx.toFixed(2)
            });

            return adx;
            
        } catch (error) {
            console.error('❌ Error in ADX calculation:', error);
            return 25; // ערך ברירת מחדל במקרה של שגיאה
        }
    };

    // חישוב ציון ADX לשורט בלבד (1-100) - הפוך מ-Long
    const calculateShortAdxScore = (adxValue: number): { score: number, strength: 'No Trend' | 'Weak Trend' | 'Strong Trend' | 'Very Strong' | 'Extreme' } => {
        let score: number;
        let strength: 'No Trend' | 'Weak Trend' | 'Strong Trend' | 'Very Strong' | 'Extreme';
        
        if (adxValue < 20) {
            score = 85; // דשדוש - טוב לשורט (אין מגמה ברורה)
            strength = 'No Trend';
        } else if (adxValue >= 20 && adxValue < 25) {
            score = 75; // מגמה חלשה - טוב לשורט
            strength = 'Weak Trend';
        } else if (adxValue >= 25 && adxValue <= 50) {
            score = 25; // מגמה חזקה - לא טוב לשורט
            strength = 'Strong Trend';
        } else if (adxValue > 50 && adxValue <= 75) {
            score = 15; // מגמה מאוד חזקה - רע לשורט
            strength = 'Very Strong';
        } else { // > 75
            score = 35; // מגמה קיצונית - בינוני לשורט (עלול להיות לא יציב)
            strength = 'Extreme';
        }
        
        console.log(`📊 ShortAdxScore calculation:`, {
            adxValue: adxValue.toFixed(2),
            score,
            strength
        });
        
        return { score, strength };
    };

    // פונקציה זו הוסרה - אנחנו לא רוצים איתותים מורכבים, רק ציון ללונג

    // פונקציה ראשית לניתוח חוזק מגמה
    const analyzeTrendStrength = async () => {
        console.log('🔄 analyzeTrendStrength called');
        
        if (!validateInputs()) {
            console.log('❌ Validation failed');
            return;
        }

        setIsCalculating(true);
        setProgress(0);
        setError('');
        setTrendResults([]);

        const results: any[] = [];
        const totalStocks = favoriteStocks.length;

        try {
            console.log(`🚀 Starting trend strength analysis for ${totalStocks} stocks on ${selectedDate}`);
            
            // בדיקה אם יש API key
            const apiKey = import.meta.env.VITE_POLYGON_API_KEY;
            console.log('API Key exists:', !!apiKey);
            if (!apiKey) {
                throw new Error('Missing Polygon API key');
            }

            for (let i = 0; i < favoriteStocks.length; i++) {
                const stock = favoriteStocks[i];
                setCurrentStock(stock.symbol);
                setProgress(((i + 1) / totalStocks) * 100);

                try {
                    console.log(`📊 Processing ${i + 1}/${totalStocks}: ${stock.symbol}`);

                    // חישוב ADX מנתוני OHLC
                    console.log(`🔍 Calculating ADX for ${stock.symbol}...`);
                    const adxValue = await calculateADXFromOHLC(stock.symbol, selectedDate);
                    const { score: shortAdxScore, strength: trendStrength } = calculateShortAdxScore(adxValue);

                    const result: any = {
                        symbol: stock.symbol,
                        name: stock.name,
                        currentPrice: stock.price,
                        adxValue,
                        adxScore: shortAdxScore,
                        trendStrength,
                        LongAdxScore: shortAdxScore, // נשתמש באותו שדה אבל עם לוגיקת Short
                        analysisDate: selectedDate,
                        calculationDate: new Date().toISOString().split('T')[0]
                    };

                    results.push(result);

                    console.log(`✅ ${stock.symbol} ShortAdxScore analysis complete:`, {
                        adxValue: adxValue.toFixed(2),
                        shortAdxScore,
                        trendStrength
                    });

                } catch (stockError) {
                    console.error(`❌ Error processing ${stock.symbol}:`, stockError);
                }

                // השהיה קטנה רק עבור API (לא עבור נתונים מקומיים)
                if (dataSource === 'polygon') {
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }

            setTrendResults(results);
            setProgress(100);

            console.log(`🎉 Trend strength analysis completed: ${results.length}/${totalStocks} stocks processed`);
            
            const excellentScores = results.filter(r => r.LongAdxScore >= 80).length;
            const goodScores = results.filter(r => r.LongAdxScore >= 60 && r.LongAdxScore < 80).length;
            const weakScores = results.filter(r => r.LongAdxScore < 60).length;

            alert(`ניתוח חוזק מגמה ללונג הושלם! 📊\n\n` +
                  `🔥 מעולה (80+): ${excellentScores}\n` +
                  `✅ טוב (60-79): ${goodScores}\n` +
                  `❄️ חלש (<60): ${weakScores}\n\n` +
                  `סה"כ מניות: ${results.length}/${totalStocks}\n` +
                  `תאריך ניתוח: ${selectedDate}`);

        } catch (error) {
            console.error('❌ Error in trend strength analysis:', error);
            setError(`שגיאה בניתוח חוזק מגמה: ${error}`);
        } finally {
            setIsCalculating(false);
            setCurrentStock('');
        }
    };

    // שמירה לFirebase
    // עדכון relative-strength עם תוצאות ניתוח חוזק מגמה (ADX)
    const saveToFirebase = async () => {
        if (trendResults.length === 0) {
            setError('אין תוצאות לשמירה');
            return;
        }

        try {
            // עדכון קולקציית short_daily_relative-strength עם ציוני ADX
            const shortRelativeStrengthDocId = `${selectedDate}_short_relative_strength`;
            console.log(`🔄 Updating short_daily_relative-strength document: ${shortRelativeStrengthDocId}`);
            
            const shortRelativeStrengthRef = doc(db, 'short_daily_relative-strength', shortRelativeStrengthDocId);
            const docSnap = await getDoc(shortRelativeStrengthRef);
            
            if (!docSnap.exists()) {
                throw new Error(`לא נמצא מסמך short_daily_relative-strength עבור תאריך ${selectedDate}. רוץ תחילה ShorthBSpy`);
            }
            
            const existingData = docSnap.data();

            if (existingData?.results) {
                    const updatedResults = existingData.results.map((stock: any) => {
                        const trendResult = trendResults.find(t => t.symbol === stock.symbol);
                        if (trendResult) {
                            return {
                                ...stock,
                                adxValue: trendResult.adxValue,
                                adxScore: trendResult.adxScore,
                                trendStrength: trendResult.trendStrength,
                                ShortAdxScore: trendResult.LongAdxScore, // נשתמש באותו שדה אבל עם שם Short
                                trendAnalysisDate: selectedDate,
                                lastADXUpdate: new Date().toISOString()
                            };
                        }
                        return stock;
                    });

                    // עדכון המסמך
                    await updateDoc(shortRelativeStrengthRef, {
                        results: updatedResults,
                        lastADXUpdate: new Date().toISOString(),
                        trendAnalysisCompleted: true
                    });
                
                console.log(`✅ Updated short_daily_relative-strength document ${shortRelativeStrengthDocId} with ADX scores`);
                
                // חישוב סטטיסטיקות לתצוגה - Long בלבד
                const avgADX = trendResults.reduce((sum, r) => sum + r.adxScore, 0) / trendResults.length;
                const avgLongAdx = trendResults.reduce((sum, r) => sum + r.LongAdxScore, 0) / trendResults.length;
                const maxLongAdx = Math.max(...trendResults.map(r => r.LongAdxScore));
                const minLongAdx = Math.min(...trendResults.map(r => r.LongAdxScore));
                const excellentScores = trendResults.filter(r => r.LongAdxScore >= 80).length;
                const goodScores = trendResults.filter(r => r.LongAdxScore >= 60 && r.LongAdxScore < 80).length;
                const weakScores = trendResults.filter(r => r.LongAdxScore < 60).length;
                const strongTrends = trendResults.filter(r => ['Strong Trend', 'Very Strong'].includes(r.trendStrength)).length;

                alert(`תוצאות ניתוח חוזק מגמה לשורט עודכנו ב-short_daily_relative-strength בהצלחה! 📊\n\n` +
                      `📅 תאריך: ${selectedDate}\n` +
                      `🔍 מניות שנותחו: ${trendResults.length}\n\n` +
                      `🔥 מעולה (80+): ${excellentScores}\n` +
                      `✅ טוב (60-79): ${goodScores}\n` +
                      `❄️ חלש (<60): ${weakScores}\n\n` +
                      `📊 ציונים:\n` +
                      `• ממוצע ADX: ${avgADX.toFixed(1)}\n` +
                      `• ממוצע LongAdxScore: ${avgLongAdx.toFixed(1)}\n` +
                      `• מקסימום: ${maxLongAdx}\n` +
                      `• מינימום: ${minLongAdx}\n\n` +
                      `📈 מגמות חזקות: ${strongTrends}\n\n` +
                      `💾 עודכן ב-short_daily_relative-strength/${shortRelativeStrengthDocId}`);
                      
            } else {
                throw new Error('לא נמצאו נתונים במסמך short_daily_relative-strength');
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
                <ShowChart color="error" />
                ShorthEAdx - תחנה 5: חוזק מגמה (ADX) לשורט בלבד
            </Typography>

            {/* הסבר */}
            <Alert severity="info" sx={{ mb: 3 }}>
                📉 <strong>תחנה 5: מדד חוזק המגמה לשורט:</strong><br/>
                🔹 <strong>ADX (14):</strong> מחושב מנתוני OHLC - מודד עוצמת המגמה (15-85)<br/>
                🔹 <strong>ציון לשורט לפי טווחים:</strong> &lt;20=דשדוש(85), 20-25=חלש(75), 25-50=חזק(25), 50-75=מאוד חזק(15), &gt;75=קיצוני(35)<br/>
                🔹 <strong>מטרה:</strong> זיהוי מגמות חלשות/דשדוש לשורט בלבד
            </Alert>

            <Alert severity="warning" sx={{ mb: 3 }}>
                ⚠️ <strong>הערה טכנית:</strong> המערכת מחשבת ADX מנתוני OHLC היסטוריים (35 ימים). התוצאות מנורמלות לטווח 15-85. Short logic: מגמות חלשות = טוב לשורט.
            </Alert>

            {/* בחירת תאריך לניתוח */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        בחירת תאריך לניתוח חוזק מגמה
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
                                ⭐ מניות מועדפות: {favoriteStocks.length} | 
                                📊 נתוני מומנטום: {momentumData.length}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                📊 מקור נתונים: {dataSource === 'local' ? 'מקומי' : 'Polygon API'}
                            </Typography>
                            {dataSource === 'local' && localData && (
                                <Typography variant="body2" color="textSecondary">
                                    📅 טווח נתונים: {localData.metadata.startDate} עד {localData.metadata.endDate} ({Object.keys(dataIndex).length} מניות)
                                </Typography>
                            )}
                        </Box>

                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="contained"
                                startIcon={<PlayArrow />}
                                onClick={analyzeTrendStrength}
                                disabled={isCalculating || !selectedDate || favoriteStocks.length === 0}
                                sx={{ backgroundColor: '#1976d2' }}
                            >
                                🚀 נתח חוזק מגמה ({favoriteStocks.length} מניות) - {dataSource === 'local' ? 'מקומי' : 'API'}
                            </Button>

                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setDataSource(dataSource === 'local' ? 'polygon' : 'local');
                                }}
                                disabled={isCalculating}
                            >
                                {dataSource === 'local' ? 'API-עבור ל' : 'מקומי-עבור ל'}
                            </Button>

                            <Button
                                variant="outlined"
                                onClick={() => {
                                    console.log('🔍 ADX Debug button clicked');
                                    console.log('selectedDate:', selectedDate);
                                    console.log('favoriteStocks:', favoriteStocks.length);
                                    console.log('momentumData:', momentumData.length);
                                    console.log('API Key exists:', !!import.meta.env.VITE_POLYGON_API_KEY);
                                    alert(`ADX Debug Info:\nDate: ${selectedDate}\nStocks: ${favoriteStocks.length}\nMomentum Data: ${momentumData.length}\nAPI Key: ${!!import.meta.env.VITE_POLYGON_API_KEY}`);
                                }}
                            >
                                🔍 דיבוג ADX
                            </Button>

                            <Button
                                variant="contained"
                                startIcon={<Save />}
                                onClick={saveToFirebase}
                                disabled={trendResults.length === 0}
                                sx={{ backgroundColor: '#4caf50' }}
                            >
                                💾 שמור ל-Firebase ({trendResults.length})
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
                            🔄 מנתח חוזק מגמה...
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
            {trendResults.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            📊 תוצאות ניתוח חוזק מגמה ללונג (תאריך {selectedDate})
                        </Typography>

                        {/* סיכום ציונים Long */}
                        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                            <Chip 
                                icon={<TrendingUp />} 
                                label={`🔥 מעולה (80+): ${trendResults.filter(r => r.LongAdxScore >= 80).length}`}
                                color="success" 
                            />
                            <Chip 
                                icon={<TrendingUp />} 
                                label={`✅ טוב (60-79): ${trendResults.filter(r => r.LongAdxScore >= 60 && r.LongAdxScore < 80).length}`}
                                color="primary" 
                            />
                            <Chip 
                                icon={<Remove />} 
                                label={`❄️ חלש (<60): ${trendResults.filter(r => r.LongAdxScore < 60).length}`}
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
                                        <TableCell><strong>ADX ערך</strong></TableCell>
                                        <TableCell><strong>חוזק מגמה</strong></TableCell>
                                        <TableCell><strong>ציון ADX</strong></TableCell>
                                        <TableCell><strong>ציון LongAdxScore</strong></TableCell>
                                        <TableCell><strong>סטטוס מגמה</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {trendResults.map((result, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{result.symbol}</TableCell>
                                            <TableCell>{result.name}</TableCell>
                                            <TableCell>${result.currentPrice.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {result.adxValue.toFixed(1)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={result.trendStrength}
                                                    color={
                                                        result.trendStrength === 'Very Strong' ? 'success' :
                                                        result.trendStrength === 'Strong Trend' ? 'primary' :
                                                        result.trendStrength === 'Weak Trend' ? 'warning' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {result.adxScore}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    נק'
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body1" 
                                                    fontWeight="bold"
                                                    style={{
                                                        color: result.LongAdxScore >= 80 ? 'green' : 
                                                               result.LongAdxScore >= 60 ? 'blue' : 'orange',
                                                        fontSize: '1.1rem'
                                                    }}
                                                >
                                                    {result.LongAdxScore}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {result.LongAdxScore >= 80 ? '🔥 מעולה' : 
                                                     result.LongAdxScore >= 60 ? '✅ טוב' : '❄️ חלש'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2" 
                                                    style={{
                                                        color: result.trendStrength === 'Very Strong' ? 'green' : 
                                                               result.trendStrength === 'Strong Trend' ? 'blue' : 
                                                               result.trendStrength === 'Weak Trend' ? 'orange' : 'red',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {result.trendStrength}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {result.trendStrength === 'Very Strong' ? '📈 מצוין ללונג' : 
                                                     result.trendStrength === 'Strong Trend' ? '📈 טוב ללונג' : 
                                                     result.trendStrength === 'Weak Trend' ? '😐 בינוני ללונג' : '📉 לא טוב ללונג'}
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
