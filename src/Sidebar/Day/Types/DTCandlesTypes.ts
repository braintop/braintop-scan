// DTCandles Types - טיפוסים עבור DTCandles Logic

export interface CandleResult {
    symbol: string;
    name: string;
    currentPrice: number;
    candleScore: number; // 0-100
    detectedPatterns: CandlePattern[];
    analysisDate: string;
    calculationDate: string;
}

export interface DSignalsInput {
    symbol: string;
    name: string;
    currentPrice: number;
    crossoverType: 'Bullish' | 'Bearish' | 'None';
    LongMomentumScore: number; // 1-100
    macdHistogram: number;
    sma3Current: number;
    sma12Current: number;
    analysisDate: string;
}

export interface OHLCData {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjusted_close?: number;
}

export interface LocalStockData {
    metadata: {
        created: string;
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
    };
    data: OHLCData[];
}

export interface FavoriteStock {
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

// סוגי נרות
export type CandlePattern = 
    | 'Hammer'
    | 'Bullish Engulfing'
    | 'Piercing Line'
    | 'Morning Star'
    | 'Inverted Hammer'
    | 'Three White Soldiers';

// סוגי מגמה
export type MomentumType = 'Bullish' | 'Bearish' | 'Neutral';

// סוגי ניקוד
export type ScoreCategory = 'excellent' | 'good' | 'weak';

// תוצאות ניתוח נרות מורחבות
export interface ExtendedCandleResult extends CandleResult {
    // נתונים מ-DSignals
    dSignalsScore: number;
    crossoverType: 'Bullish' | 'Bearish' | 'None';
    macdHistogram: number;
    
    // נתונים טכניים
    sma3Current: number;
    sma12Current: number;
    
    // סטטיסטיקות נרות
    totalPatterns: number;
    maxPossibleScore: number;
    scorePercentage: number;
    
    // תאימות מגמה
    momentumCompatibility: boolean;
    trendDirection: MomentumType;
}

// קונפיגורציה לנרות
export interface CandleAnalysisConfig {
    // קריטריונים לזיהוי
    criteria: {
        hammer: {
            smallBodyRatio: number;
            longLowerShadowRatio: number;
            shortUpperShadowRatio: number;
            closeToHighRatio: number;
        };
        bullishEngulfing: {
            minBodyRatio: number;
        };
        piercingLine: {
            longBodyRatio: number;
            closeAboveMid: boolean;
        };
        morningStar: {
            longBodyRatio: number;
            smallBodyRatio: number;
            longThirdBodyRatio: number;
        };
        invertedHammer: {
            smallBodyRatio: number;
            longUpperShadowRatio: number;
            shortLowerShadowRatio: number;
            closeToLowRatio: number;
        };
        threeWhiteSoldiers: {
            minBodyIncrease: number;
        };
    };
    
    // ספי פעולה
    thresholds: {
        excellent: number;
        good: number;
        weak: number;
        bullish: number;
        bearish: number;
        neutral: number;
    };
    
    // משקלים
    weights: {
        hammer: number;
        bullishEngulfing: number;
        piercingLine: number;
        morningStar: number;
        invertedHammer: number;
        threeWhiteSoldiers: number;
    };
}

// תוצאות ניתוח נרות לפי תאריך
export interface CandleAnalysisByDate {
    date: string;
    totalStocks: number;
    analyzedStocks: number;
    results: CandleResult[];
    
    // סטטיסטיקות
    statistics: {
        averageScore: number;
        maxScore: number;
        minScore: number;
        excellentCount: number;
        goodCount: number;
        weakCount: number;
        
        // נרות פופולריים
        patternCounts: {
            hammer: number;
            bullishEngulfing: number;
            piercingLine: number;
            morningStar: number;
            invertedHammer: number;
            threeWhiteSoldiers: number;
        };
    };
}

// פונקציות עזר
export interface CandleUtils {
    // בדיקת סף ניקוד
    getScoreCategory: (score: number) => string;
    
    // בדיקת מגמה
    getMomentumCategory: (score: number) => string;
    
    // חישוב ציון כולל
    calculateTotalScore: (patterns: CandlePattern[]) => number;
    
    // בדיקת תאימות מגמה לנר
    isPatternCompatible: (pattern: CandlePattern, momentumScore: number, crossoverType: string) => boolean;
}

// הגדרות נרות
export interface CandleSettings {
    // ניקוד מינימלי לכניסה
    minScoreForEntry: number;
    
    // מספר מקסימלי של נרות למניה
    maxPatternsPerStock: number;
    
    // האם לבדוק נרות מרובים
    allowMultiplePatterns: boolean;
    
    // משקל ב-MasterAnalysis
    masterAnalysisWeight: number;
    
    // ספי פעולה
    actionThresholds: {
        strong: number;
        moderate: number;
        weak: number;
    };
}

// הודעות למשתמש
export interface CandleMessages {
    excellent: string;
    good: string;
    weak: string;
    noPatterns: string;
    
    analysisComplete: string;
    saveSuccess: string;
    
    patterns: {
        hammer: string;
        bullishEngulfing: string;
        piercingLine: string;
        morningStar: string;
        invertedHammer: string;
        threeWhiteSoldiers: string;
    };
}

// טיפוסים מורכבים
export type CandleAnalysisFunction = (
    stock: FavoriteStock, 
    dSignalsResult: DSignalsInput, 
    historicalData: OHLCData[]
) => Promise<CandleResult>;

export type CandleDetectionFunction = (candle: OHLCData, ...args: any[]) => boolean;

export type CandleCompatibilityFunction = (
    pattern: CandlePattern, 
    momentumScore: number, 
    crossoverType: string
) => boolean;
