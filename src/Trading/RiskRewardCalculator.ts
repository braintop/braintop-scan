/**
 * Risk/Reward Ratio Calculator Module
 * 
 * חושב יחס סיכון-רווח (R:R) עבור טריידים
 * כולל חישוב אוטומטי של Stop Loss ו-Target מבוסס על:
 * - רמות תמיכה והתנגדות
 * - ATR (Average True Range)
 * - כללי ניהול סיכונים מתקדמים
 */

// Types and Interfaces
export interface OHLCData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface SupportResistanceLevel {
    price: number;
    strength: number; // 1-10, כמה פעמים המחיר נבדק ברמה הזו
    type: 'support' | 'resistance';
    distance: number; // מרחק מהמחיר הנוכחי באחוזים
}

export interface RiskRewardResult {
    entry: number;
    stopLoss: number;
    target: number;
    risk: number; // בדולרים
    reward: number; // בדולרים
    riskPercent: number; // באחוזים
    rewardPercent: number; // באחוזים
    ratio: number; // R:R ratio
    isApproved: boolean; // האם עובר את מבחן ה-2:1
    confidence: number; // רמת ביטחון 1-100
    method: string; // איך חושב הStop/Target
}

export interface TradeSetup {
    symbol: string;
    direction: 'Long' | 'Short';
    entryPrice: number;
    riskReward: RiskRewardResult;
    score: number; // ציון כללי של המניה
    finalApproval: boolean; // אישור סופי לטרייד
}

/**
 * חישוב ATR (Average True Range) - תנודתיות ממוצעת
 */
export const calculateATR = (ohlcData: OHLCData[], period: number = 14): number => {
    if (ohlcData.length < period + 1) {
        console.warn('Not enough data for ATR calculation');
        return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < ohlcData.length; i++) {
        const current = ohlcData[i];
        const previous = ohlcData[i - 1];
        
        const tr1 = current.high - current.low;
        const tr2 = Math.abs(current.high - previous.close);
        const tr3 = Math.abs(current.low - previous.close);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
    }
    
    // ממוצע של ה-True Ranges האחרונים
    const atrValues = trueRanges.slice(-period);
    return atrValues.reduce((sum, tr) => sum + tr, 0) / atrValues.length;
};

/**
 * זיהוי רמות תמיכה והתנגדות
 */
export const findSupportResistanceLevels = (
    ohlcData: OHLCData[], 
    currentPrice: number,
    lookbackPeriod: number = 50
): SupportResistanceLevel[] => {
    if (ohlcData.length < lookbackPeriod) {
        console.warn('Not enough data for support/resistance calculation');
        return [];
    }

    const recentData = ohlcData.slice(-lookbackPeriod);
    const levels: SupportResistanceLevel[] = [];
    const priceThreshold = currentPrice * 0.005; // 0.5% threshold לקיבוץ מחירים דומים

    // איסוף רמות פוטנציאליות מנקודות גבוהות ונמוכות
    for (let i = 2; i < recentData.length - 2; i++) {
        const candle = recentData[i];
        const prev2 = recentData[i - 2];
        const prev1 = recentData[i - 1];
        const next1 = recentData[i + 1];
        const next2 = recentData[i + 2];

        // זיהוי Support (נקודה נמוכה מקומית)
        if (candle.low <= prev2.low && candle.low <= prev1.low && 
            candle.low <= next1.low && candle.low <= next2.low) {
            
            const distance = ((currentPrice - candle.low) / currentPrice) * 100;
            if (distance > 0 && distance < 10) { // רק רמות קרובות (עד 10%)
                levels.push({
                    price: candle.low,
                    strength: 1,
                    type: 'support',
                    distance: distance
                });
            }
        }

        // זיהוי Resistance (נקודה גבוהה מקומית)
        if (candle.high >= prev2.high && candle.high >= prev1.high && 
            candle.high >= next1.high && candle.high >= next2.high) {
            
            const distance = ((candle.high - currentPrice) / currentPrice) * 100;
            if (distance > 0 && distance < 10) { // רק רמות קרובות (עד 10%)
                levels.push({
                    price: candle.high,
                    strength: 1,
                    type: 'resistance',
                    distance: distance
                });
            }
        }
    }

    // קיבוץ רמות דומות וחישוב חוזק
    const groupedLevels: SupportResistanceLevel[] = [];
    
    for (const level of levels) {
        let foundGroup = false;
        
        for (const grouped of groupedLevels) {
            if (Math.abs(level.price - grouped.price) <= priceThreshold && 
                level.type === grouped.type) {
                // עדכון ממוצע משוקלל וחוזק
                grouped.price = (grouped.price * grouped.strength + level.price) / (grouped.strength + 1);
                grouped.strength += 1;
                grouped.distance = ((grouped.type === 'support' ? currentPrice - grouped.price : grouped.price - currentPrice) / currentPrice) * 100;
                foundGroup = true;
                break;
            }
        }
        
        if (!foundGroup) {
            groupedLevels.push({ ...level });
        }
    }

    // מיון לפי חוזק ומרחק
    return groupedLevels
        .filter(level => level.strength >= 2) // רק רמות שנבדקו לפחות 2 פעמים
        .sort((a, b) => {
            if (a.strength !== b.strength) return b.strength - a.strength;
            return a.distance - b.distance; // מעדיפים רמות קרובות יותר
        });
};

/**
 * חישוב Stop Loss אוטומטי
 */
export const calculateStopLoss = (
    entryPrice: number,
    direction: 'Long' | 'Short',
    atr: number,
    supportResistanceLevels: SupportResistanceLevel[]
): { stopLoss: number; method: string; confidence: number } => {
    
    let stopLoss: number;
    let method: string;
    let confidence: number = 70; // ברירת מחדל

    if (direction === 'Long') {
        // עבור Long - Stop מתחת לתמיכה הקרובה
        const nearestSupport = supportResistanceLevels
            .filter(level => level.type === 'support' && level.price < entryPrice)
            .sort((a, b) => a.distance - b.distance)[0];

        if (nearestSupport && nearestSupport.distance < 5) {
            // יש תמיכה קרובה (עד 5%)
            stopLoss = nearestSupport.price * 0.995; // 0.5% מתחת לתמיכה
            method = `Support Level (${nearestSupport.strength}x tested)`;
            confidence = Math.min(90, 60 + nearestSupport.strength * 5);
        } else {
            // אין תמיכה קרובה - משתמשים ב-ATR
            stopLoss = entryPrice - (atr * 2); // 2×ATR מתחת לכניסה
            method = '2×ATR Stop';
            confidence = 60;
        }
    } else {
        // עבור Short - Stop מעל להתנגדות הקרובה
        const nearestResistance = supportResistanceLevels
            .filter(level => level.type === 'resistance' && level.price > entryPrice)
            .sort((a, b) => a.distance - b.distance)[0];

        if (nearestResistance && nearestResistance.distance < 5) {
            // יש התנגדות קרובה (עד 5%)
            stopLoss = nearestResistance.price * 1.005; // 0.5% מעל להתנגדות
            method = `Resistance Level (${nearestResistance.strength}x tested)`;
            confidence = Math.min(90, 60 + nearestResistance.strength * 5);
        } else {
            // אין התנגדות קרובה - משתמשים ב-ATR
            stopLoss = entryPrice + (atr * 2); // 2×ATR מעל לכניסה
            method = '2×ATR Stop';
            confidence = 60;
        }
    }

    return { stopLoss, method, confidence };
};

/**
 * חישוב Target אוטומטי
 */
export const calculateTarget = (
    entryPrice: number,
    direction: 'Long' | 'Short',
    atr: number,
    supportResistanceLevels: SupportResistanceLevel[],
    riskAmount: number
): { target: number; method: string; confidence: number } => {
    
    let target: number;
    let method: string;
    let confidence: number = 70;

    if (direction === 'Long') {
        // עבור Long - Target בהתנגדות הבאה
        const nextResistance = supportResistanceLevels
            .filter(level => level.type === 'resistance' && level.price > entryPrice)
            .sort((a, b) => a.distance - b.distance)[0];

        if (nextResistance && nextResistance.distance < 15) {
            // יש התנגדות ברמה סבירה (עד 15%)
            target = nextResistance.price * 0.995; // 0.5% לפני ההתנגדות
            method = `Resistance Target (${nextResistance.strength}x tested)`;
            confidence = Math.min(85, 55 + nextResistance.strength * 5);
        } else {
            // אין התנגדות ברמה סבירה - יעד מבוסס על R:R מינימלי
            const minTarget = entryPrice + (riskAmount * 2); // מינימום 2:1 R:R
            const atrTarget = entryPrice + (atr * 3); // 3×ATR יעד
            target = Math.max(minTarget, atrTarget);
            method = target === minTarget ? '2:1 R:R Target' : '3×ATR Target';
            confidence = 65;
        }
    } else {
        // עבור Short - Target בתמיכה הבאה
        const nextSupport = supportResistanceLevels
            .filter(level => level.type === 'support' && level.price < entryPrice)
            .sort((a, b) => a.distance - b.distance)[0];

        if (nextSupport && nextSupport.distance < 15) {
            // יש תמיכה ברמה סבירה (עד 15%)
            target = nextSupport.price * 1.005; // 0.5% מעל לתמיכה
            method = `Support Target (${nextSupport.strength}x tested)`;
            confidence = Math.min(85, 55 + nextSupport.strength * 5);
        } else {
            // אין תמיכה ברמה סבירה - יעד מבוסס על R:R מינימלי
            const minTarget = entryPrice - (riskAmount * 2); // מינימום 2:1 R:R
            const atrTarget = entryPrice - (atr * 3); // 3×ATR יעד
            target = Math.min(minTarget, atrTarget);
            method = target === minTarget ? '2:1 R:R Target' : '3×ATR Target';
            confidence = 65;
        }
    }

    return { target, method, confidence };
};

/**
 * חישוב R:R מלא עם כל הפרמטרים
 */
export const calculateRiskReward = (
    entryPrice: number,
    direction: 'Long' | 'Short',
    ohlcData: OHLCData[],
    minRatio: number = 2.0
): RiskRewardResult => {
    
    // חישוב ATR
    const atr = calculateATR(ohlcData);
    
    // זיהוי רמות תמיכה והתנגדות
    const levels = findSupportResistanceLevels(ohlcData, entryPrice);
    
    // חישוב Stop Loss
    const stopData = calculateStopLoss(entryPrice, direction, atr, levels);
    
    // חישוב Risk
    const risk = Math.abs(entryPrice - stopData.stopLoss);
    const riskPercent = (risk / entryPrice) * 100;
    
    // חישוב Target
    const targetData = calculateTarget(entryPrice, direction, atr, levels, risk);
    
    // חישוב Reward
    const reward = Math.abs(targetData.target - entryPrice);
    const rewardPercent = (reward / entryPrice) * 100;
    
    // חישוב יחס R:R
    const ratio = risk > 0 ? reward / risk : 0;
    
    // בדיקת אישור
    const isApproved = ratio >= minRatio;
    
    // רמת ביטחון משוקללת
    const confidence = Math.round((stopData.confidence + targetData.confidence) / 2);
    
    // תיאור השיטה
    const method = `Stop: ${stopData.method} | Target: ${targetData.method}`;
    
    return {
        entry: entryPrice,
        stopLoss: stopData.stopLoss,
        target: targetData.target,
        risk,
        reward,
        riskPercent,
        rewardPercent,
        ratio,
        isApproved,
        confidence,
        method
    };
};

/**
 * אישור טרייד עם בדיקת R:R
 */
export const approveTradeWithRR = (
    symbol: string,
    direction: 'Long' | 'Short',
    entryPrice: number,
    score: number,
    ohlcData: OHLCData[],
    minRatio: number = 2.0,
    minScore: number = 60
): TradeSetup => {
    
    // חישוב R:R
    const riskReward = calculateRiskReward(entryPrice, direction, ohlcData, minRatio);
    
    // אישור סופי - צריך גם ציון גבוה וגם R:R טוב
    const finalApproval = score >= minScore && riskReward.isApproved;
    
    console.log(`🎯 Trade Analysis for ${symbol}:`, {
        direction,
        entry: `$${entryPrice.toFixed(2)}`,
        score: `${score}/100`,
        riskReward: `${riskReward.ratio.toFixed(2)}:1`,
        approved: finalApproval ? '✅' : '❌',
        reason: !riskReward.isApproved ? 'Poor R:R' : score < minScore ? 'Low Score' : 'Approved'
    });
    
    return {
        symbol,
        direction,
        entryPrice,
        riskReward,
        score,
        finalApproval
    };
};

/**
 * פונקציה לחישוב R:R פשוט (ללא OHLC data)
 */
export const calculateSimpleRR = (
    entryPrice: number,
    stopLoss: number,
    target: number
): { ratio: number; isApproved: boolean; risk: number; reward: number } => {
    
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(target - entryPrice);
    
    if (risk === 0) {
        return { ratio: 0, isApproved: false, risk: 0, reward: 0 };
    }
    
    const ratio = reward / risk;
    const isApproved = ratio >= 2.0;
    
    return { ratio, isApproved, risk, reward };
};

export default {
    calculateATR,
    findSupportResistanceLevels,
    calculateStopLoss,
    calculateTarget,
    calculateRiskReward,
    approveTradeWithRR,
    calculateSimpleRR
};
