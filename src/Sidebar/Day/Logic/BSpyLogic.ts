// BSpy Logic - חילוץ הלוגיקה מ-BSpy.tsx
import * as BSpyTypes from '../Types/BSpyTypes';

// Function to check if a date is a US holiday
export const isUSHoliday = (date: Date): boolean => {
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

// Function to get previous trading day (skip weekends and holidays)
export const getPreviousTradingDay = (date: Date): Date => {
    const previousDay = new Date(date);
    previousDay.setDate(date.getDate() - 1);
    
    // Skip weekends and holidays
    while (previousDay.getDay() === 0 || previousDay.getDay() === 6 || isUSHoliday(previousDay)) {
        previousDay.setDate(previousDay.getDate() - 1);
    }
    
    return previousDay;
};

// חישוב ציון LongSpy
export const calculateLongSpyScore = (stockReturn: number, spyReturn: number): number => {
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
        longSpyScore: longSpyScore.toFixed(2),
        finalScore: finalScore
    });
    
    return finalScore;
};

// חישוב Relative Strength
export const calculateRelativeStrength = (stockReturn: number, spyReturn: number): number => {
    if (Math.abs(spyReturn) < 0.001) { // כמעט 0
        // אם SPY כמעט לא זז, נשתמש בערכים מוחלטים
        return stockReturn === 0 ? 1 : (stockReturn > 0 ? 2 : 0.5);
    } else {
        // הנוסחה הרגילה: (1 + תשואת מניה) / (1 + תשואת SPY)  
        const stockMultiplier = 1 + (stockReturn / 100);
        const spyMultiplier = 1 + (spyReturn / 100);
        return stockMultiplier / spyMultiplier;
    }
};

// חיפוש נתונים מקומיים מהיר O(1) - משתמש באינדקס
export const findLocalData = (dataIndex: any, symbol: string, date: string) => {
    if (!dataIndex[symbol]) return null;
    return dataIndex[symbol][date] || null;
};

// קבלת נתונים היסטוריים מקומיים
export const getLocalHistoricalData = (dataIndex: any, symbol: string, endDate: string, days: number = 30) => {
    if (!dataIndex || !dataIndex[symbol]) {
        console.warn(`⚠️ No data index for symbol: ${symbol}`);
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
    
    console.log(`📊 Found ${results.length} trading days of data for ${symbol} (needed ${days}) after ${iterations} iterations`);
    
    if (results.length < days) {
        console.warn(`⚠️ Insufficient data for ${symbol}: found ${results.length}, needed ${days}`);
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

// קבלת נתוני SPY לתאריך ספציפי
export const getSPYData = async (
    targetDate: string, 
    dataSource: 'local' | 'api',
    localData?: any,
    dataIndex?: any
): Promise<BSpyTypes.SPYData | null> => {
    try {
        console.log(`📊 Fetching SPY data for specific date: ${targetDate}...`);
        
        // חישוב התאריך הקודם (יום מסחר אחד לפני) - כולל דילוג על חגים
        const targetDateObj = new Date(targetDate);
        const previousDateObj = getPreviousTradingDay(targetDateObj);
        const previousDate = previousDateObj.toISOString().split('T')[0];
        
        console.log(`📅 Target date: ${targetDate}, Previous trading day: ${previousDate}`);
        
        let currentPrice: number;
        let previousPrice: number;
        
        if (dataSource === 'local' && localData) {
            // שימוש בנתונים מקומיים
            console.log('📁 Using local data for SPY...');
            
            let spyTargetData = findLocalData(dataIndex, 'SPY', targetDate);
            if (!spyTargetData) {
                console.warn(`⚠️ No local SPY data for ${targetDate}, trying fallback...`);
                // Try to find closest available SPY data
                const availableDates = Object.keys(dataIndex).sort();
                const spyAvailableDates = availableDates.filter(date => 
                    dataIndex[date] && dataIndex[date]['SPY']
                );
                
                if (spyAvailableDates.length > 0) {
                    // Use the most recent available SPY data
                    const fallbackDate = spyAvailableDates[spyAvailableDates.length - 1];
                    spyTargetData = findLocalData(dataIndex, 'SPY', fallbackDate);
                    console.log(`🔄 Using fallback SPY data from ${fallbackDate} for analysis date ${targetDate}`);
                } else {
                    console.warn(`⚠️ No SPY data available at all, using default values`);
                    // Use default SPY values when no data is available
                    spyTargetData = { close: 450, open: 450, high: 455, low: 445, volume: 100000000 };
                    console.log(`🔄 Using default SPY values: close=${spyTargetData.close}`);
                }
            }
            currentPrice = spyTargetData.close;
            
            let spyPreviousData = findLocalData(dataIndex, 'SPY', previousDate);
            if (!spyPreviousData) {
                console.warn(`⚠️ No local SPY data for ${previousDate}, trying fallback...`);
                // Try to find closest available SPY data
                const availableDates = Object.keys(dataIndex).sort();
                const spyAvailableDates = availableDates.filter(date => 
                    dataIndex[date] && dataIndex[date]['SPY']
                );
                
                if (spyAvailableDates.length > 0) {
                    // Use the second most recent available SPY data for previous
                    const fallbackDate = spyAvailableDates[spyAvailableDates.length - 2] || spyAvailableDates[spyAvailableDates.length - 1];
                    spyPreviousData = findLocalData(dataIndex, 'SPY', fallbackDate);
                    console.log(`🔄 Using fallback SPY data from ${fallbackDate} for previous date ${previousDate}`);
                } else {
                    console.warn(`⚠️ No SPY data available at all, using default values`);
                    // Use default SPY values when no data is available
                    spyPreviousData = { close: 445, open: 445, high: 450, low: 440, volume: 100000000 };
                    console.log(`🔄 Using default SPY values: previous=${spyPreviousData.close}`);
                }
            }
            previousPrice = spyPreviousData.close;
            
        } else {
            // שימוש בנתונים מקומיים בלבד
            console.log('📁 Using local data for SPY...');
            
            const spyTargetData = findLocalData(dataIndex, 'SPY', targetDate);
            if (!spyTargetData) {
                console.warn(`⚠️ No local SPY data for ${targetDate}`);
                return null;
            }
            currentPrice = spyTargetData.close;
            
            const spyPreviousData = findLocalData(dataIndex, 'SPY', previousDate);
            if (!spyPreviousData) {
                console.warn(`⚠️ No local SPY data for ${previousDate}`);
                return null;
            }
            previousPrice = spyPreviousData.close;
        }
        
        if (previousPrice === 0) {
            console.warn(`⚠️ No valid previous SPY price for ${previousDate}`);
            return null;
        }
        
        const spyReturn = ((currentPrice - previousPrice) / previousPrice) * 100;
        
        console.log(`📈 SPY data for ${targetDate}:`, {
            currentPrice: `$${currentPrice}`,
            previousPrice: `$${previousPrice}`,
            return: `${spyReturn.toFixed(3)}%`,
            source: dataSource
        });
        
        return {
            currentPrice,
            previousPrice,
            return: spyReturn
        };
        
    } catch (error) {
        console.error('❌ Error fetching SPY data:', error);
        return null;
    }
};

// חישוב BSpy עבור מניה בודדת
export const calculateBSpyForStock = async (
    stock: BSpyTypes.FavoriteStock,
    targetDate: string,
    spyData: BSpyTypes.SPYData,
    dataSource: 'local' | 'api',
    localData?: any,
    dataIndex?: any
): Promise<BSpyTypes.RelativeStrengthResult | null> => {
    try {
        console.log(`🔍 Processing ${stock.symbol} for date ${targetDate}`);

        // חישוב התאריך הקודם (יום מסחר אחד לפני) - כולל דילוג על חגים
        const targetDateObj = new Date(targetDate);
        const previousDateObj = getPreviousTradingDay(targetDateObj);
        const previousDate = previousDateObj.toISOString().split('T')[0];

        let currentPrice: number;
        let previousPrice: number;
        
        if (dataSource === 'local' && localData) {
            // שימוש בנתונים מקומיים - מהיר O(1)
            const stockTargetData = findLocalData(dataIndex, stock.symbol, targetDate);
            if (!stockTargetData) {
                console.warn(`⚠️ No local data for ${stock.symbol} on ${targetDate}`);
                return null;
            }
            currentPrice = stockTargetData.close;
            
            const stockPreviousData = findLocalData(dataIndex, stock.symbol, previousDate);
            if (!stockPreviousData) {
                console.warn(`⚠️ No local data for ${stock.symbol} on ${previousDate}`);
                return null;
            }
            previousPrice = stockPreviousData.close;
            
        } else {
            // שימוש בנתונים מקומיים בלבד - מהיר
            const stockTargetData = findLocalData(dataIndex, stock.symbol, targetDate);
            if (!stockTargetData) {
                console.warn(`⚠️ No local data for ${stock.symbol} on ${targetDate}`);
                return null;
            }
            currentPrice = stockTargetData.close;
            
            const stockPreviousData = findLocalData(dataIndex, stock.symbol, previousDate);
            if (!stockPreviousData) {
                console.warn(`⚠️ No local data for ${stock.symbol} on ${previousDate}`);
                return null;
            }
            previousPrice = stockPreviousData.close;
        }
        
        if (previousPrice === 0) {
            console.warn(`⚠️ No valid previous price for ${stock.symbol} on ${previousDate}`);
            return null;
        }

        // חישוב תשואת המניה
        const stockReturn = ((currentPrice - previousPrice) / previousPrice) * 100;

        // חישוב חוזק יחסי (Relative Strength Ratio)
        const relativeStrength = calculateRelativeStrength(stockReturn, spyData.return);

        // חישוב ציון LongSpy
        const LongSpyScore = calculateLongSpyScore(stockReturn, spyData.return);
        
        console.log(`🧮 ${stock.symbol} calculations for ${targetDate} (${dataSource}):`, {
            targetDate: targetDate,
            previousDate: previousDate,
            currentPrice: `$${currentPrice}`,
            previousPrice: `$${previousPrice}`,
            stockReturn: `${stockReturn.toFixed(3)}%`,
            spyReturn: `${spyData.return.toFixed(3)}%`,
            relativeStrength: relativeStrength.toFixed(3),
            LongSpyScore: LongSpyScore,
            source: dataSource
        });

        return {
            symbol: stock.symbol,
            name: stock.name,
            currentPrice,
            previousPrice,
            stockReturn,
            spyReturn: spyData.return,
            relativeStrength,
            LongSpyScore,
            analysisDate: targetDate,
            calculationDate: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`❌ Error processing ${stock.symbol}:`, error);
        return null;
    }
};
