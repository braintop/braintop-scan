// DSignals Logic - חילוץ הלוגיקה מ-DSignals.tsx
import * as DSignalsTypes from '../Types/DSignalsTypes';

// פונקציות עזר לנתונים מקומיים
export const findLocalData = (dataIndex: any, symbol: string, date: string) => {
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

export const getLocalHistoricalData = (dataIndex: any, symbol: string, endDate: string, days: number = 30) => {
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
    let maxIterations = days * 3; // הגדלת הגבלת הניסיונות ל-90 ימים
    let iterations = 0;
    
    console.log(`🔍 Getting ${days} trading days of data for ${symbol} ending ${endDate}`);
    console.log(`📊 Data available for ${symbol}:`, Object.keys(dataIndex[symbol] || {}).length, 'dates');
    
    // חיפוש ימי מסחר אחורה מהתאריך שנבחר
    while (tradingDaysFound < days && iterations < maxIterations) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const data = findLocalData(dataIndex, symbol, dateStr);
        if (data) {
            results.unshift(data); // הוספה בתחילה כדי לשמור על סדר כרונולוגי
            tradingDaysFound++;
            // הסרת הלוגים המרובים - רק לוג כל 5 ימים
            if (tradingDaysFound % 5 === 0 || tradingDaysFound <= 3) {
                console.log(`✅ Found data for ${symbol} on ${dateStr}`);
            }
        } else {
            // הסרת הלוגים המרובים - רק לוג כל 15 ימים
            if (iterations % 15 === 0) {
                console.log(`❌ No data for ${symbol} on ${dateStr}`);
            }
        }
        
        // עבור ליום הקודם
        currentDate.setDate(currentDate.getDate() - 1);
        iterations++;
    }
    
    console.log(`📊 Found ${results.length} trading days of data for ${symbol} (needed ${days})`);
    return results;
};

// חישוב SMA מהנתונים המקומיים
export const calculateLocalSMA = (ohlcData: any[], period: number): number[] => {
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

// חישוב EMA
export const calculateEMA = (prices: number[], period: number) => {
    if (prices.length < period) {
        console.warn(`⚠️ Not enough prices for EMA${period}: need ${period}, got ${prices.length}`);
        return [];
    }
    
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
    
    // EMA calculation completed
    
    return ema;
};

// חישוב MACD מהנתונים המקומיים
export const calculateLocalMACD = (ohlcData: any[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
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
    const fastEMA = calculateEMA(closePrices, fastPeriod);
    const slowEMA = calculateEMA(closePrices, slowPeriod);
    
    // MACD = Fast EMA - Slow EMA
    const macd = [];
    const minLength = Math.min(fastEMA.length, slowEMA.length);
    
    for (let i = 0; i < minLength; i++) {
        const macdValue = fastEMA[i] - slowEMA[i];
        macd.push(macdValue);
    }
    
    // Signal Line = EMA של MACD
    const signal = calculateEMA(macd, signalPeriod);
    
    // Histogram = MACD - Signal
    const histogram = [];
    const minSignalLength = Math.min(macd.length, signal.length);
    
    for (let i = 0; i < minSignalLength; i++) {
        const histogramValue = macd[i] - signal[i];
        histogram.push(histogramValue);
    }
    
    return { macd, signal, histogram };
};

// חישוב ציון LongMomentumScore
export const calculateLongMomentumScore = (crossoverType: 'Bullish' | 'Bearish' | 'None', macdHistogram: number): number => {
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

// חישוב ציון ShortMomentumScore - לוגיקה הפוכה מ-Long
export const calculateShortMomentumScore = (crossoverType: 'Bullish' | 'Bearish' | 'None', macdHistogram: number): number => {
    let score = 50; // בסיס ניטרלי
    
    if (crossoverType === 'Bearish') { // Short logic: Bearish crossover is GOOD for Short
        if (macdHistogram < 0) {
            score = 95; // חצייה יורדת + MACD שלילי = מצוין לשורט
        } else if (Math.abs(macdHistogram) < 0.01) {
            score = 75; // חצייה יורדת + MACD ניטרלי = טוב לשורט
        } else {
            score = 55; // חצייה יורדת + MACD חיובי = עדיין טוב לשורט
        }
    } else if (crossoverType === 'Bullish') { // Short logic: Bullish crossover is BAD for Short
        if (macdHistogram > 0) {
            score = 15; // חצייה עולה + MACD חיובי = לא טוב לשורט
        } else if (Math.abs(macdHistogram) < 0.01) {
            score = 25; // חצייה עולה + MACD ניטרלי = חלש לשורט
        } else {
            score = 40; // חצייה עולה + MACD שלילי = התנגדות - בינוני לשורט
        }
    } else {
        // אין חצייה
        if (macdHistogram < -0.02) {
            score = 70; // מומנטום שלילי בלי חצייה = טוב לשורט
        } else if (macdHistogram > 0.02) {
            score = 30; // מומנטום חיובי בלי חצייה = לא טוב לשורט
        } else {
            score = 50; // ניטרלי לחלוטין = בינוני לשורט
        }
    }
    
    return Math.max(1, Math.min(100, Math.round(score)));
};

// חישוב DSignals עבור מניה בודדת
export const calculateDSignalsForStock = async (
    stock: DSignalsTypes.FavoriteStock,
    targetDate: string,
    dataSource: 'local' | 'api',
    localData?: any,
    dataIndex?: any
): Promise<DSignalsTypes.MomentumResult | null> => {
    try {
        console.log(`🔍 Processing ${stock.symbol} for DSignals analysis on ${targetDate}`);

        let ohlcData: any[] = [];
        
        if (dataSource === 'local' && localData && dataIndex) {
            // שימוש בנתונים מקומיים
            // Using local data for DSignals
            ohlcData = getLocalHistoricalData(dataIndex, stock.symbol, targetDate, 30);
            
            if (ohlcData.length < 26) {
                console.warn(`⚠️ Insufficient local data for ${stock.symbol}: need 26 days, got ${ohlcData.length}`);
                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.price,
                    sma3Current: 0,
                    sma3Previous: 0,
                    sma12Current: 0,
                    sma12Previous: 0,
                    crossoverType: 'None' as const,
                    macdHistogram: 0,
                    LongMomentumScore: 50,
                    analysisDate: targetDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                };
            }
        } else {
            // שימוש בנתונים מקומיים בלבד
            console.log(`📁 DSignals - Using local data for ${stock.symbol}`);
            
            if (!dataIndex || !dataIndex[stock.symbol]) {
                console.warn(`⚠️ No local data index for ${stock.symbol}`);
                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.price,
                    sma3Current: 0,
                    sma3Previous: 0,
                    sma12Current: 0,
                    sma12Previous: 0,
                    crossoverType: 'None' as const,
                    macdHistogram: 0,
                    LongMomentumScore: 50,
                    analysisDate: targetDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                };
            }
            
            // קבלת נתונים היסטוריים מהאינדקס המקומי
            const availableDates = Object.keys(dataIndex[stock.symbol]).sort();
            const endDateObj = new Date(targetDate);
            
            // מציאת התאריך הקרוב ביותר לתאריך המטרה
            let closestDate = null;
            let closestIndex = -1;
            
            for (let i = availableDates.length - 1; i >= 0; i--) {
                const dateObj = new Date(availableDates[i]);
                if (dateObj <= endDateObj) {
                    closestDate = availableDates[i];
                    closestIndex = i;
                    break;
                }
            }
            
            if (!closestDate || closestIndex === -1) {
                console.warn(`⚠️ No local data found for ${stock.symbol} on or before ${targetDate}`);
                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.price,
                    sma3Current: 0,
                    sma3Previous: 0,
                    sma12Current: 0,
                    sma12Previous: 0,
                    crossoverType: 'None' as const,
                    macdHistogram: 0,
                    LongMomentumScore: 50,
                    analysisDate: targetDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                };
            }
            
            // קבלת 30 הימים האחרונים
            const startIndex = Math.max(0, closestIndex - 29);
            const endIndex = closestIndex + 1;
            const recentDates = availableDates.slice(startIndex, endIndex);
            
            if (recentDates.length < 26) {
                console.warn(`⚠️ Insufficient local data for ${stock.symbol}: need 26 days, got ${recentDates.length}`);
                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.price,
                    sma3Current: 0,
                    sma3Previous: 0,
                    sma12Current: 0,
                    sma12Previous: 0,
                    crossoverType: 'None' as const,
                    macdHistogram: 0,
                    LongMomentumScore: 50,
                    analysisDate: targetDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                };
            }
            
            ohlcData = recentDates.map(date => {
                const data = dataIndex[stock.symbol][date];
                return {
                    date: date,
                    symbol: stock.symbol,
                    open: data.open,
                    high: data.high,
                    low: data.low,
                    close: data.close,
                    volume: data.volume
                };
            });
            
            // Local historical data loaded
        }

        // חישוב SMA
        const sma3Values = calculateLocalSMA(ohlcData, 3);
        const sma12Values = calculateLocalSMA(ohlcData, 12);
        
        if (sma3Values.length < 2 || sma12Values.length < 2) {
            console.warn(`⚠️ Insufficient SMA data for ${stock.symbol}: SMA3=${sma3Values.length}, SMA12=${sma12Values.length}`);
            return {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.price,
                sma3Current: 0,
                sma3Previous: 0,
                sma12Current: 0,
                sma12Previous: 0,
                crossoverType: 'None' as const,
                macdHistogram: 0,
                LongMomentumScore: 50,
                analysisDate: targetDate,
                calculationDate: new Date().toISOString().split('T')[0]
            };
        }

        const sma3Current = sma3Values[sma3Values.length - 1];
        const sma3Previous = sma3Values[sma3Values.length - 2];
        const sma12Current = sma12Values[sma12Values.length - 1];
        const sma12Previous = sma12Values[sma12Values.length - 2];

        // חישוב MACD עם פרמטרים מותאמים
        let macdData;
        if (ohlcData.length >= 25) {
            macdData = calculateLocalMACD(ohlcData, 8, 16, 6);
        } else if (ohlcData.length >= 20) {
            macdData = calculateLocalMACD(ohlcData, 6, 12, 4);
        } else {
            macdData = calculateLocalMACD(ohlcData, 5, 10, 3);
        }
        
        if (macdData.histogram.length < 2) {
            console.warn(`⚠️ Insufficient MACD data for ${stock.symbol}: histogram length=${macdData.histogram.length}`);
            return {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.price,
                sma3Current,
                sma3Previous,
                sma12Current,
                sma12Previous,
                crossoverType: 'None' as const,
                macdHistogram: 0,
                LongMomentumScore: 50,
                analysisDate: targetDate,
                calculationDate: new Date().toISOString().split('T')[0]
            };
        }

        const macdHistogram = macdData.histogram[macdData.histogram.length - 1];

        // זיהוי חצייה
        let crossoverType: 'Bullish' | 'Bearish' | 'None' = 'None';
        
        if (sma3Previous <= sma12Previous && sma3Current > sma12Current) {
            crossoverType = 'Bullish';
        } else if (sma3Previous >= sma12Previous && sma3Current < sma12Current) {
            crossoverType = 'Bearish';
        }

        const longMomentumScore = calculateLongMomentumScore(crossoverType, macdHistogram);

        const result: DSignalsTypes.MomentumResult = {
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
            analysisDate: targetDate,
            calculationDate: new Date().toISOString().split('T')[0]
        };

        return result;
        
    } catch (error) {
        console.error(`❌ Error processing ${stock.symbol}:`, error);
        return null;
    }
};
