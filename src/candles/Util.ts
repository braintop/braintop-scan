// פונקציות לזיהוי תבניות נרות ומגמות

// הגדרות טיפוסים
export interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface CandleData extends Candle {
    body: number;
    upperShadow: number;
    lowerShadow: number;
    isBullish: boolean;
    isBearish: boolean;
}

export interface Pattern {
    index: number;
    pattern: string;
    direction: "bullish" | "bearish";
    trend: "up" | "down";
    candle?: Candle;
    candles?: Candle[];
}

/**
 * חישוב EMA (Exponential Moving Average)
 * @param prices - מערך מחירי סגירה
 * @param period - תקופה (10, 30, וכו')
 * @returns מערך של ערכי EMA
 */
export function calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // הערך הראשון הוא פשוט הממוצע הפשוט
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }
    ema[period - 1] = sum / period;
    
    // חישוב EMA לשאר הערכים
    for (let i = period; i < prices.length; i++) {
        ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
}

/**
 * קביעת מגמה בהתבסס על EMA10 ו-EMA30
 * @param prices - מערך מחירי סגירה
 * @returns "up" או "down"
 */
export function calculateTrend(prices: number[]): "up" | "down" {
    const ema10 = calculateEMA(prices, 10);
    const ema30 = calculateEMA(prices, 30);
    
    const currentEma10 = ema10[ema10.length - 1];
    const currentEma30 = ema30[ema30.length - 1];
    
    return currentEma10 > currentEma30 ? "up" : "down";
}

/**
 * חישוב נתוני נר בסיסיים
 * @param candle - נר עם open, high, low, close
 * @returns נתוני הנר המחושבים
 */
export function calculateCandleData(candle: Candle): CandleData {
    const { open, high, low, close } = candle;
    
    const body = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    const isBullish = close > open;
    const isBearish = close < open;
    
    return {
        body,
        upperShadow,
        lowerShadow,
        isBullish,
        isBearish,
        ...candle
    };
}

/**
 * זיהוי תבנית Hammer (פטיש) - היפוך שורי
 * @param candleData - נתוני נר מחושבים
 * @param trend - מגמה נוכחית
 * @returns האם זוהתה התבנית
 */
export function isHammer(candleData: CandleData, trend: "up" | "down"): boolean {
    const { body, upperShadow, lowerShadow, close, open, high } = candleData;
    
    if (trend !== "down") return false;
    
    const condition1 = lowerShadow >= 2 * body;
    const condition2 = upperShadow <= 0.1 * body;
    const condition3 = Math.abs(close - high) <= 0.1 * body || Math.abs(open - high) <= 0.1 * body;
    
    return condition1 && condition2 && condition3;
}

/**
 * זיהוי תבנית Shooting Star (כוכב נופל) - היפוך דובי
 * @param candleData - נתוני נר מחושבים
 * @param trend - מגמה נוכחית
 * @returns האם זוהתה התבנית
 */
export function isShootingStar(candleData: CandleData, trend: "up" | "down"): boolean {
    const { body, upperShadow, lowerShadow, close, open, low } = candleData;
    
    if (trend !== "up") return false;
    
    const condition1 = upperShadow >= 2 * body;
    const condition2 = lowerShadow <= 0.1 * body;
    const condition3 = Math.abs(close - low) <= 0.1 * body || Math.abs(open - low) <= 0.1 * body;
    
    return condition1 && condition2 && condition3;
}

/**
 * זיהוי תבנית Bullish Engulfing (בליעת שורית)
 * @param prevCandle - נר קודם
 * @param currentCandle - נר נוכחי
 * @param trend - מגמה נוכחית
 * @returns האם זוהתה התבנית
 */
export function isBullishEngulfing(prevCandle: Candle, currentCandle: Candle, trend: "up" | "down"): boolean {
    if (trend !== "down") return false;
    
    const prevData = calculateCandleData(prevCandle);
    const currentData = calculateCandleData(currentCandle);
    
    const condition1 = prevData.isBearish;
    const condition2 = currentData.isBullish;
    const condition3 = currentCandle.open < prevCandle.close;
    const condition4 = currentCandle.close > prevCandle.open;
    
    return condition1 && condition2 && condition3 && condition4;
}

/**
 * זיהוי תבנית Bearish Engulfing (בליעת דובית)
 * @param prevCandle - נר קודם
 * @param currentCandle - נר נוכחי
 * @param trend - מגמה נוכחית
 * @returns האם זוהתה התבנית
 */
export function isBearishEngulfing(prevCandle: Candle, currentCandle: Candle, trend: "up" | "down"): boolean {
    if (trend !== "up") return false;
    
    const prevData = calculateCandleData(prevCandle);
    const currentData = calculateCandleData(currentCandle);
    
    const condition1 = prevData.isBullish;
    const condition2 = currentData.isBearish;
    const condition3 = currentCandle.open > prevCandle.close;
    const condition4 = currentCandle.close < prevCandle.open;
    
    return condition1 && condition2 && condition3 && condition4;
}

/**
 * זיהוי תבנית Morning Star (כוכב בוקר) - היפוך שורי
 * @param firstCandle - נר ראשון
 * @param secondCandle - נר שני
 * @param thirdCandle - נר שלישי
 * @param trend - מגמה נוכחית
 * @returns האם זוהתה התבנית
 */
export function isMorningStar(firstCandle: Candle, secondCandle: Candle, thirdCandle: Candle, trend: "up" | "down"): boolean {
    if (trend !== "down") return false;
    
    const firstData = calculateCandleData(firstCandle);
    const secondData = calculateCandleData(secondCandle);
    const thirdData = calculateCandleData(thirdCandle);
    
    const condition1 = firstData.isBearish && firstData.body > 0.01; // גוף גדול
    const condition2 = secondData.body < firstData.body * 0.5; // גוף קטן
    const condition3 = secondCandle.high < firstCandle.close; // gap down
    const condition4 = thirdData.isBullish;
    const condition5 = thirdCandle.close >= (firstCandle.open + firstCandle.close) / 2;
    
    return condition1 && condition2 && condition3 && condition4 && condition5;
}

/**
 * זיהוי תבנית Evening Star (כוכב ערב) - היפוך דובי
 * @param firstCandle - נר ראשון
 * @param secondCandle - נר שני
 * @param thirdCandle - נר שלישי
 * @param trend - מגמה נוכחית
 * @returns האם זוהתה התבנית
 */
export function isEveningStar(firstCandle: Candle, secondCandle: Candle, thirdCandle: Candle, trend: "up" | "down"): boolean {
    if (trend !== "up") return false;
    
    const firstData = calculateCandleData(firstCandle);
    const secondData = calculateCandleData(secondCandle);
    const thirdData = calculateCandleData(thirdCandle);
    
    const condition1 = firstData.isBullish && firstData.body > 0.01; // גוף גדול
    const condition2 = secondData.body < firstData.body * 0.5; // גוף קטן
    const condition3 = secondCandle.low > firstCandle.close; // gap up
    const condition4 = thirdData.isBearish;
    const condition5 = thirdCandle.close <= (firstCandle.open + firstCandle.close) / 2;
    
    return condition1 && condition2 && condition3 && condition4 && condition5;
}

/**
 * פונקציה ראשית לזיהוי תבניות נרות
 * @param candles - מערך נרות (OHLC)
 * @returns רשימת זיהויים
 */
export function detectCandlePatterns(candles: Candle[]): Pattern[] {
    if (candles.length < 30) {
        throw new Error("נדרשים לפחות 30 נרות לזיהוי תבניות");
    }
    
    const patterns: Pattern[] = [];
    const prices = candles.map(candle => candle.close);
    
    // עבור כל נר (החל מהנר ה-30)
    for (let i = 29; i < candles.length; i++) {
        const currentPrices = prices.slice(0, i + 1);
        const trend = calculateTrend(currentPrices);
        const currentCandle = candles[i];
        const currentCandleData = calculateCandleData(currentCandle);
        
        // בדיקת תבניות נר יחיד
        if (isHammer(currentCandleData, trend)) {
            patterns.push({
                index: i,
                pattern: "Hammer",
                direction: "bullish",
                trend: trend,
                candle: currentCandle
            });
        }
        
        if (isShootingStar(currentCandleData, trend)) {
            patterns.push({
                index: i,
                pattern: "Shooting Star",
                direction: "bearish",
                trend: trend,
                candle: currentCandle
            });
        }
        
        // בדיקת תבניות שני נרות
        if (i > 29) {
            const prevCandle = candles[i - 1];
            
            if (isBullishEngulfing(prevCandle, currentCandle, trend)) {
                patterns.push({
                    index: i,
                    pattern: "Bullish Engulfing",
                    direction: "bullish",
                    trend: trend,
                    candles: [prevCandle, currentCandle]
                });
            }
            
            if (isBearishEngulfing(prevCandle, currentCandle, trend)) {
                patterns.push({
                    index: i,
                    pattern: "Bearish Engulfing",
                    direction: "bearish",
                    trend: trend,
                    candles: [prevCandle, currentCandle]
                });
            }
        }
        
        // בדיקת תבניות שלושה נרות
        if (i > 30) {
            const firstCandle = candles[i - 2];
            const secondCandle = candles[i - 1];
            const thirdCandle = candles[i];
            
            if (isMorningStar(firstCandle, secondCandle, thirdCandle, trend)) {
                patterns.push({
                    index: i,
                    pattern: "Morning Star",
                    direction: "bullish",
                    trend: trend,
                    candles: [firstCandle, secondCandle, thirdCandle]
                });
            }
            
            if (isEveningStar(firstCandle, secondCandle, thirdCandle, trend)) {
                patterns.push({
                    index: i,
                    pattern: "Evening Star",
                    direction: "bearish",
                    trend: trend,
                    candles: [firstCandle, secondCandle, thirdCandle]
                });
            }
        }
    }
    
    return patterns;
}

/**
 * פונקציה לקבלת התבנית האחרונה שזוהתה
 * @param candles - מערך נרות
 * @returns התבנית האחרונה או null
 */
export function getLatestPattern(candles: Candle[]): Pattern | null {
    const patterns = detectCandlePatterns(candles);
    return patterns.length > 0 ? patterns[patterns.length - 1] : null;
}
