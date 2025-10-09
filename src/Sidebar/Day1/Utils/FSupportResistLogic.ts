/**
 * FSupportResist Logic - זיהוי רמות תמיכה והתנגדות
 * שלב F במערכת הניתוח הטכני
 */

import * as MarketStructureTypes from '../Types/MarketStructureTypes';

/**
 * זיהוי Swing High/Low
 */
export const detectSwingLevels = (
    data: MarketStructureTypes.OHLCData[],
    window: number = 7
): MarketStructureTypes.SupportResistanceLevel[] => {
    const levels: MarketStructureTypes.SupportResistanceLevel[] = [];
    
    if (data.length < 3) {
        console.warn('⚠️ Insufficient data for swing level detection. Need at least 3 data points.');
        return levels;
    }
    
    // Adjust window based on available data
    const adjustedWindow = Math.min(window, Math.floor((data.length - 1) / 2));
    
    for (let i = adjustedWindow; i < data.length - adjustedWindow; i++) {
        const current = data[i];
        
        // בדיקת Swing High
        let isSwingHigh = true;
        for (let j = i - adjustedWindow; j <= i + adjustedWindow; j++) {
            if (j !== i && data[j].high >= current.high) {
                isSwingHigh = false;
                break;
            }
        }
        
        if (isSwingHigh) {
            levels.push({
                price: current.high,
                strength: calculateSwingStrength(data, i, window, 'high'),
                type: 'Swing High',
                confidence: calculateLevelConfidence(data, i, window, 'high'),
                touches: countTouches(data, current.high, 0.02), // 2% tolerance
                lastTouch: current.date
            });
        }
        
        // בדיקת Swing Low
        let isSwingLow = true;
        for (let j = i - adjustedWindow; j <= i + adjustedWindow; j++) {
            if (j !== i && data[j].low <= current.low) {
                isSwingLow = false;
                break;
            }
        }
        
        if (isSwingLow) {
            levels.push({
                price: current.low,
                strength: calculateSwingStrength(data, i, window, 'low'),
                type: 'Swing Low',
                confidence: calculateLevelConfidence(data, i, window, 'low'),
                touches: countTouches(data, current.low, 0.02), // 2% tolerance
                lastTouch: current.date
            });
        }
    }
    
    return levels;
};

/**
 * חישוב עוצמת Swing
 */
const calculateSwingStrength = (
    data: MarketStructureTypes.OHLCData[],
    index: number,
    _window: number,
    type: 'high' | 'low'
): number => {
    const current = data[index];
    const price = type === 'high' ? current.high : current.low;
    
    // חישוב על בסיס מרחק מהממוצע
    const windowData = data.slice(Math.max(0, index - _window), index + _window + 1);
    const avgPrice = windowData.reduce((sum, d) => sum + d.close, 0) / windowData.length;
    
    const deviation = Math.abs(price - avgPrice) / avgPrice;
    
    // נורמליזציה ל-1-5
    if (deviation > 0.05) return 5; // 5%+ deviation
    if (deviation > 0.03) return 4; // 3-5% deviation
    if (deviation > 0.02) return 3; // 2-3% deviation
    if (deviation > 0.01) return 2; // 1-2% deviation
    return 1; // <1% deviation
};

/**
 * חישוב ביטחון ברמה
 */
const calculateLevelConfidence = (
    data: MarketStructureTypes.OHLCData[],
    index: number,
    _window: number,
    type: 'high' | 'low'
): number => {
    const touches = countTouches(data, type === 'high' ? data[index].high : data[index].low, 0.02);
    const recency = calculateRecency(data[index].date, data[data.length - 1].date);
    const volumeStrength = calculateVolumeStrength(data, index);
    
    // חישוב משוקלל
    const confidence = (touches * 30) + (recency * 25) + (volumeStrength * 25) + 20; // base confidence
    
    return Math.min(100, Math.max(0, confidence));
};

/**
 * ספירת נגיעות ברמה
 */
const countTouches = (
    data: MarketStructureTypes.OHLCData[],
    level: number,
    tolerance: number
): number => {
    let touches = 0;
    const range = level * tolerance;
    
    data.forEach(d => {
        if ((d.high >= level - range && d.high <= level + range) ||
            (d.low >= level - range && d.low <= level + range) ||
            (d.close >= level - range && d.close <= level + range)) {
            touches++;
        }
    });
    
    return touches;
};

/**
 * חישוב עדכניות
 */
const calculateRecency = (levelDate: string, currentDate: string): number => {
    const level = new Date(levelDate);
    const current = new Date(currentDate);
    const daysDiff = (current.getTime() - level.getTime()) / (1000 * 60 * 60 * 24);
    
    // עדכניות גבוהה יותר = ציון גבוה יותר
    if (daysDiff <= 5) return 100;
    if (daysDiff <= 10) return 80;
    if (daysDiff <= 20) return 60;
    if (daysDiff <= 30) return 40;
    return 20;
};

/**
 * חישוב עוצמת נפח
 */
const calculateVolumeStrength = (
    data: MarketStructureTypes.OHLCData[],
    index: number
): number => {
    const currentVolume = data[index].volume;
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    const volumeRatio = currentVolume / avgVolume;
    
    if (volumeRatio > 2.0) return 100;
    if (volumeRatio > 1.5) return 80;
    if (volumeRatio > 1.2) return 60;
    if (volumeRatio > 1.0) return 40;
    return 20;
};

/**
 * חישוב Moving Averages
 */
export const calculateMALevels = (
    data: MarketStructureTypes.OHLCData[],
    config: MarketStructureTypes.MarketStructureConfig
): MarketStructureTypes.MALevels => {
    // Calculate MA with available data, adjusting periods if necessary
    const maxPeriod = Math.max(config.sma20Period, config.sma50Period, config.sma200Period);
    
    if (data.length < maxPeriod) {
        console.warn(`⚠️ Limited data for MA calculation. Data length: ${data.length}, Required: ${maxPeriod}. Calculating with available data.`);
    }
    
    // Calculate SMA with adjusted periods based on available data
    const sma20Period = Math.min(config.sma20Period, Math.max(1, data.length - 1));
    const sma50Period = Math.min(config.sma50Period, Math.max(1, data.length - 1));
    const sma200Period = Math.min(config.sma200Period, Math.max(1, data.length - 1));
    
    const sma20 = calculateSMA(data, sma20Period);
    const sma50 = calculateSMA(data, sma50Period);
    const sma200 = calculateSMA(data, sma200Period);
    
    return {
        sma20,
        sma50,
        sma200
    };
};

/**
 * חישוב Simple Moving Average
 */
const calculateSMA = (data: MarketStructureTypes.OHLCData[], period: number): number => {
    const recentData = data.slice(-period);
    return recentData.reduce((sum, d) => sum + d.close, 0) / recentData.length;
};

/**
 * חישוב Pivot Points
 */
export const calculatePivotPoints = (
    data: MarketStructureTypes.OHLCData[]
): MarketStructureTypes.PivotPoints => {
    if (data.length < 1) {
        console.warn('⚠️ No data available for pivot points calculation');
        return {
            pp: 100,
            r1: 105,
            r2: 110,
            s1: 95,
            s2: 90
        };
    }
    
    const lastDay = data[data.length - 1];
    const high = lastDay.high;
    const low = lastDay.low;
    const close = lastDay.close;
    
    const pp = (high + low + close) / 3;
    const r1 = (2 * pp) - low;
    const r2 = pp + (high - low);
    const s1 = (2 * pp) - high;
    const s2 = pp - (high - low);
    
    return {
        pp,
        r1,
        r2,
        s1,
        s2
    };
};

/**
 * ניתוח נפח
 */
export const analyzeVolume = (
    data: MarketStructureTypes.OHLCData[],
    config: MarketStructureTypes.MarketStructureConfig
): MarketStructureTypes.VolumeAnalysis => {
    const recentData = data.slice(-config.volumeLookback);
    const avgVolume = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length;
    
    // זיהוי רמות עם נפח גבוה
    const highVolumeLevels: number[] = [];
    const volumeNodes: MarketStructureTypes.SupportResistanceLevel[] = [];
    
    recentData.forEach(d => {
        if (d.volume > avgVolume * config.volumeThreshold) {
            highVolumeLevels.push(d.close);
            
            volumeNodes.push({
                price: d.close,
                strength: Math.min(5, Math.floor(d.volume / avgVolume)),
                type: 'Volume',
                confidence: Math.min(100, (d.volume / avgVolume) * 50),
                touches: 1,
                lastTouch: d.date
            });
        }
    });
    
    const volumeStrength = avgVolume > 0 ? 
        Math.min(5, Math.floor(avgVolume / 1000000)) : 1; // 1M volume = strength 1
    
    return {
        avgVolume,
        highVolumeLevels: [...new Set(highVolumeLevels)], // remove duplicates
        volumeStrength,
        volumeNodes
    };
};

/**
 * זיהוי רמות עגולות (Round Numbers)
 */
export const detectRoundNumbers = (
    data: MarketStructureTypes.OHLCData[],
    currentPrice: number
): MarketStructureTypes.SupportResistanceLevel[] => {
    const levels: MarketStructureTypes.SupportResistanceLevel[] = [];
    
    // רמות עגולות קרובות למחיר הנוכחי
    const priceRange = currentPrice * 0.3; // 30% סביב המחיר הנוכחי
    const minPrice = currentPrice - priceRange;
    const maxPrice = currentPrice + priceRange;
    
    // רמות עגולות אפשריות
    const roundLevels = [];
    for (let price = Math.floor(minPrice); price <= Math.ceil(maxPrice); price++) {
        if (price % 5 === 0 || price % 10 === 0 || price % 50 === 0 || price % 100 === 0) {
            roundLevels.push(price);
        }
    }
    
    roundLevels.forEach(level => {
        const touches = countTouches(data, level, 0.01); // 1% tolerance for round numbers
        
        if (touches > 0) {
            levels.push({
                price: level,
                strength: Math.min(5, Math.floor(touches / 2) + 1),
                type: 'Round Number',
                confidence: Math.min(100, touches * 15),
                touches,
                lastTouch: data[data.length - 1].date
            });
        }
    });
    
    return levels;
};

/**
 * סיכום מבנה השוק
 */
export const createMarketStructureSummary = (
    allLevels: MarketStructureTypes.SupportResistanceLevel[],
    maLevels: MarketStructureTypes.MALevels,
    currentPrice: number
): MarketStructureTypes.MarketStructureSummary => {
    // מיון רמות לפי עוצמה וביטחון
    const sortedLevels = allLevels.sort((a, b) => {
        const scoreA = (a.strength * 20) + (a.confidence * 0.8);
        const scoreB = (b.strength * 20) + (b.confidence * 0.8);
        return scoreB - scoreA;
    });
    
    // רמות תמיכה והתנגדות (משתמשים ב-sortedLevels ישירות)
    
    // זיהוי מגמה
    let trend: 'Bullish' | 'Bearish' | 'Sideways' | 'Unknown' = 'Unknown';
    if (currentPrice > maLevels.sma50 && maLevels.sma50 > maLevels.sma200) {
        trend = 'Bullish';
    } else if (currentPrice < maLevels.sma50 && maLevels.sma50 < maLevels.sma200) {
        trend = 'Bearish';
    } else if (Math.abs(currentPrice - maLevels.sma50) / currentPrice < 0.02) {
        trend = 'Sideways';
    }
    
    // חישוב עוצמה כוללת
    const avgStrength = sortedLevels.length > 0 ? 
        sortedLevels.reduce((sum, l) => sum + l.strength, 0) / sortedLevels.length : 1;
    
    // חישוב ביטחון כולל
    const avgConfidence = sortedLevels.length > 0 ? 
        sortedLevels.reduce((sum, l) => sum + l.confidence, 0) / sortedLevels.length : 50;
    
    // רמות מפתח (עליונות 5)
    const keyLevels = sortedLevels.slice(0, 5);
    
    // רמות פריצה פוטנציאליות (קרובות למחיר הנוכחי)
    const breakoutLevels = sortedLevels.filter(l => 
        Math.abs(l.price - currentPrice) / currentPrice < 0.05 // 5% מהמחיר הנוכחי
    );
    
    return {
        trend,
        strength: Math.round(avgStrength),
        confidence: Math.round(avgConfidence),
        keyLevels,
        breakoutLevels
    };
};

/**
 * הפונקציה הראשית - ניתוח מבנה שוק מלא
 */
export const analyzeMarketStructure = (
    input: MarketStructureTypes.FSupportResistInput,
    config: MarketStructureTypes.MarketStructureConfig = MarketStructureTypes.DEFAULT_MARKET_STRUCTURE_CONFIG
): MarketStructureTypes.MarketStructureResult => {
    try {
        console.log(`🔍 Analyzing market structure for ${input.symbol}...`);
        
        // הגבלת נתונים לתקופה הרצויה
        const relevantData = input.historicalData.slice(-config.lookbackDays);
        
        if (relevantData.length < 20) {
            console.warn(`⚠️ Insufficient data for analysis. Need at least 20 days, got ${relevantData.length}. Using available data.`);
            // Continue with available data instead of throwing error
        }
        
        // זיהוי רמות Swing
        const swingLevels = detectSwingLevels(relevantData, config.swingDetectionWindow);
        
        // חישוב Moving Averages
        const maLevels = calculateMALevels(relevantData, config);
        
        // חישוב Pivot Points
        const pivotPoints = calculatePivotPoints(relevantData);
        
        // ניתוח נפח
        const volumeAnalysis = analyzeVolume(relevantData, config);
        
        // זיהוי רמות עגולות
        const roundNumberLevels = detectRoundNumbers(relevantData, input.currentPrice);
        
        // הוספת MA levels כרמות תמיכה/התנגדות
        const maLevelsAsSR: MarketStructureTypes.SupportResistanceLevel[] = [
            {
                price: maLevels.sma20,
                strength: 3,
                type: 'MA',
                confidence: 70,
                touches: 1,
                lastTouch: relevantData[relevantData.length - 1].date
            },
            {
                price: maLevels.sma50,
                strength: 4,
                type: 'MA',
                confidence: 80,
                touches: 1,
                lastTouch: relevantData[relevantData.length - 1].date
            },
            {
                price: maLevels.sma200,
                strength: 5,
                type: 'MA',
                confidence: 90,
                touches: 1,
                lastTouch: relevantData[relevantData.length - 1].date
            }
        ];
        
        // הוספת Pivot Points כרמות
        const pivotLevelsAsSR: MarketStructureTypes.SupportResistanceLevel[] = [
            {
                price: pivotPoints.pp,
                strength: 3,
                type: 'Pivot',
                confidence: 60,
                touches: 1,
                lastTouch: relevantData[relevantData.length - 1].date
            },
            {
                price: pivotPoints.r1,
                strength: 4,
                type: 'Pivot',
                confidence: 70,
                touches: 1,
                lastTouch: relevantData[relevantData.length - 1].date
            },
            {
                price: pivotPoints.s1,
                strength: 4,
                type: 'Pivot',
                confidence: 70,
                touches: 1,
                lastTouch: relevantData[relevantData.length - 1].date
            }
        ];
        
        // איחוד כל הרמות
        const allLevels = [
            ...swingLevels,
            ...maLevelsAsSR,
            ...pivotLevelsAsSR,
            ...roundNumberLevels,
            ...volumeAnalysis.volumeNodes
        ];
        
        // מיון רמות תמיכה והתנגדות
        const supportLevels = allLevels
            .filter(l => l.price < input.currentPrice)
            .sort((a, b) => b.price - a.price); // מיון יורד (הכי קרוב למחיר ראשון)
        
        const resistanceLevels = allLevels
            .filter(l => l.price > input.currentPrice)
            .sort((a, b) => a.price - b.price); // מיון עולה (הכי קרוב למחיר ראשון)
        
        // יצירת סיכום
        const summary = createMarketStructureSummary(allLevels, maLevels, input.currentPrice);
        
        console.log(`🔍 Creating result for ${input.symbol}:`);
        console.log(`📊 Support levels: ${supportLevels.length}`);
        console.log(`📊 Resistance levels: ${resistanceLevels.length}`);
        console.log(`📊 MA levels:`, maLevels);
        console.log(`📊 Pivot points:`, pivotPoints);
        console.log(`📊 Volume analysis:`, volumeAnalysis);
        console.log(`📊 Summary:`, summary);
        
        const result: MarketStructureTypes.MarketStructureResult = {
            symbol: input.symbol,
            name: input.name,
            currentPrice: input.currentPrice,
            analysisDate: input.analysisDate,
            calculationDate: new Date().toISOString().split('T')[0],
            
            supportLevels: {
                primary: supportLevels[0] || createDefaultLevel(input.currentPrice * 0.95, 'Support'),
                secondary: supportLevels[1] || createDefaultLevel(input.currentPrice * 0.90, 'Support'),
                tertiary: supportLevels[2] || createDefaultLevel(input.currentPrice * 0.85, 'Support')
            },
            
            resistanceLevels: {
                primary: resistanceLevels[0] || createDefaultLevel(input.currentPrice * 1.05, 'Resistance'),
                secondary: resistanceLevels[1] || createDefaultLevel(input.currentPrice * 1.10, 'Resistance'),
                tertiary: resistanceLevels[2] || createDefaultLevel(input.currentPrice * 1.15, 'Resistance')
            },
            
            maLevels,
            pivotPoints,
            volumeAnalysis,
            summary,
            historicalData: relevantData,
            
            analysisMetadata: {
                dataPoints: relevantData.length,
                timeFrame: `${config.lookbackDays} days`,
                lastUpdated: new Date().toISOString(),
                confidence: summary.confidence
            }
        };
        
        console.log(`✅ Market structure analysis completed for ${input.symbol}`);
        console.log(`📊 Found ${supportLevels.length} support levels, ${resistanceLevels.length} resistance levels`);
        console.log(`🎯 Trend: ${summary.trend}, Strength: ${summary.strength}, Confidence: ${summary.confidence}`);
        
        // Verify result structure
        console.log(`🔍 Result verification for ${input.symbol}:`);
        console.log(`  - Support Levels: ${result.supportLevels ? '✅' : '❌'}`);
        console.log(`  - Resistance Levels: ${result.resistanceLevels ? '✅' : '❌'}`);
        console.log(`  - MA Levels: ${result.maLevels ? '✅' : '❌'}`);
        console.log(`  - Pivot Points: ${result.pivotPoints ? '✅' : '❌'}`);
        console.log(`  - Volume Analysis: ${result.volumeAnalysis ? '✅' : '❌'}`);
        console.log(`  - Summary: ${result.summary ? '✅' : '❌'}`);
        console.log(`  - Historical Data: ${result.historicalData?.length || 0} points`);
        console.log(`  - Analysis Metadata: ${result.analysisMetadata ? '✅' : '❌'}`);
        
        return result;
        
    } catch (error) {
        console.error(`❌ Error analyzing market structure for ${input.symbol}:`, error);
        throw error;
    }
};

/**
 * יצירת רמה ברירת מחדל
 */
const createDefaultLevel = (price: number, type: string): MarketStructureTypes.SupportResistanceLevel => ({
    price,
    strength: 1,
    type: type as any,
    confidence: 20,
    touches: 0,
    lastTouch: new Date().toISOString().split('T')[0]
});
