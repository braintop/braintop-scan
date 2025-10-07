// EAdx Logic - חילוץ הלוגיקה מ-EAdx.tsx
import * as EAdxTypes from '../Types/EAdxTypes';

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

export const getLocalHistoricalData = (dataIndex: any, symbol: string, endDate: string, days: number = 35) => {
    if (!dataIndex || !dataIndex[symbol]) {
        console.warn(`⚠️ No data index for symbol: ${symbol}`, {
            hasDataIndex: !!dataIndex,
            hasSymbol: !!dataIndex?.[symbol],
            availableSymbols: dataIndex ? Object.keys(dataIndex).slice(0, 5) : [],
            requestedSymbol: symbol
        });
        return [];
    }
    
    // חיפוש 35 ימי מסחר אחורה מהתאריך שנבחר (כמו שצריך!)
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
        
        const data = findLocalData(dataIndex, symbol, dateStr);
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

// פונקציה חדשה למציאת יום המסחר האחרון לפני התאריך שנבחר
export const findLastTradingDay = (dataIndex: any, symbol: string, targetDate: string): string | null => {
    if (!dataIndex || !dataIndex[symbol]) {
        console.warn(`⚠️ No data index for symbol: ${symbol}`);
        return null;
    }
    
    const targetDateObj = new Date(targetDate);
    let currentDate = new Date(targetDateObj);
    let maxIterations = 10; // מחפש עד 10 ימים אחורה
    let iterations = 0;
    
    console.log(`🔍 Finding last trading day for ${symbol} before ${targetDate}`);
    
    // חיפוש יום המסחר האחרון לפני התאריך שנבחר
    while (iterations < maxIterations) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const data = findLocalData(dataIndex, symbol, dateStr);
        if (data) {
            console.log(`✅ Found last trading day for ${symbol}: ${dateStr}`);
            return dateStr;
        }
        
        // עבור ליום הקודם
        currentDate.setDate(currentDate.getDate() - 1);
        iterations++;
    }
    
    console.warn(`⚠️ No trading day found for ${symbol} in the last ${maxIterations} days before ${targetDate}`);
    return null;
};

// חישוב ADX מפושט
export const calculateSimplifiedADX = (ohlcData: any[]): number => {
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

// חישוב ציון ADX ללונג בלבד (1-100)
export const calculateLongAdxScore = (adxValue: number): { score: number, strength: 'No Trend' | 'Weak Trend' | 'Strong Trend' | 'Very Strong' | 'Extreme' } => {
    let score: number;
    let strength: 'No Trend' | 'Weak Trend' | 'Strong Trend' | 'Very Strong' | 'Extreme';
    
    if (adxValue < 20) {
        score = 25; // דשדוש - לא טוב ללונג
        strength = 'No Trend';
    } else if (adxValue >= 20 && adxValue < 25) {
        score = 45; // מגמה חלשה - בינוני ללונג
        strength = 'Weak Trend';
    } else if (adxValue >= 25 && adxValue <= 50) {
        score = 85; // מגמה חזקה - מעולה ללונג
        strength = 'Strong Trend';
    } else if (adxValue > 50 && adxValue <= 75) {
        score = 95; // מגמה מאוד חזקה - מצוין ללונג
        strength = 'Very Strong';
    } else { // > 75
        score = 75; // מגמה קיצונית - טובה ללונג אבל עלולה להיות לא יציבה
        strength = 'Extreme';
    }
    
    console.log(`📊 LongAdxScore calculation:`, {
        adxValue: adxValue.toFixed(2),
        score,
        strength
    });
    
    return { score, strength };
};

// חישוב ADX עצמי מנתוני OHLC (כיוון ש-Polygon לא מספקת ADX ישירות)
export const calculateADXFromOHLC = async (
    symbol: string, 
    targetDate: string,
    dataSource: 'local' | 'api',
    localData?: any,
    dataIndex?: any
): Promise<number> => {
    try {
        let ohlcData: any[];

        if (dataSource === 'local' && localData && dataIndex) {
            // שימוש בנתונים מקומיים - מהיר O(1)
            console.log(`🔍 Using local data for ADX calculation: ${symbol}`);
            
            const historicalData = getLocalHistoricalData(dataIndex, symbol, targetDate, 35);
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

// חישוב EAdx עבור מניה בודדת
export const calculateEAdxForStock = async (
    stock: EAdxTypes.FavoriteStock,
    targetDate: string,
    dataSource: 'local' | 'api',
    localData?: any,
    dataIndex?: any
): Promise<EAdxTypes.TrendResult | null> => {
    try {
        console.log(`🔍 Processing ${stock.symbol} for EAdx analysis on ${targetDate}`);

        // חישוב ADX
        const adxValue = await calculateADXFromOHLC(stock.symbol, targetDate, dataSource, localData, dataIndex);
        
        // חישוב ציון ADX
        const { score: longAdxScore, strength } = calculateLongAdxScore(adxValue);

        const result: EAdxTypes.TrendResult = {
            symbol: stock.symbol,
            name: stock.name,
            currentPrice: stock.price,
            adxValue,
            LongAdxScore: longAdxScore,
            trendStrength: strength,
            analysisDate: targetDate,
            calculationDate: new Date().toISOString().split('T')[0]
        };

        console.log(`✅ ${stock.symbol} EAdx analysis:`, {
            adxValue: adxValue.toFixed(2),
            score: longAdxScore,
            strength
        });

        return result;
        
    } catch (error) {
        console.error(`❌ Error processing ${stock.symbol}:`, error);
        return {
            symbol: stock.symbol,
            name: stock.name,
            currentPrice: stock.price,
            adxValue: 25,
            LongAdxScore: 25,
            trendStrength: 'No Trend' as const,
            analysisDate: targetDate,
            calculationDate: new Date().toISOString().split('T')[0]
        };
    }
};
