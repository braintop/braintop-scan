/**
 * Market Structure Types for FSupportResist Component
 * שלב F - זיהוי רמות תמיכה והתנגדות
 */

// Basic stock data for analysis
export interface FavoriteStock {
    symbol: string;
    name: string;
    currentPrice: number;
    market: string;
}

// Historical OHLCV data for analysis
export interface OHLCData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// Support and Resistance Level
export interface SupportResistanceLevel {
    price: number;
    strength: number; // 1-5 (חלש עד חזק מאוד)
    type: 'Swing High' | 'Swing Low' | 'MA' | 'Volume' | 'Pivot' | 'Round Number';
    confidence: number; // 1-100
    touches: number; // כמה פעמים נגעה המחיר ברמה
    lastTouch: string; // תאריך הנגיעה האחרונה
}

// MA Levels
export interface MALevels {
    sma20: number;
    sma50: number;
    sma200: number;
    ema20?: number;
    ema50?: number;
}

// Pivot Points
export interface PivotPoints {
    pp: number; // Pivot Point
    r1: number; // Resistance 1
    r2: number; // Resistance 2
    r3?: number; // Resistance 3
    s1: number; // Support 1
    s2: number; // Support 2
    s3?: number; // Support 3
}

// Volume Analysis
export interface VolumeAnalysis {
    avgVolume: number;
    highVolumeLevels: number[]; // רמות מחיר עם נפח גבוה
    volumeStrength: number; // 1-5
    volumeNodes: SupportResistanceLevel[]; // רמות תמיכה/התנגדות על בסיס נפח
}

// Market Structure Summary
export interface MarketStructureSummary {
    trend: 'Bullish' | 'Bearish' | 'Sideways' | 'Unknown';
    strength: number; // 1-5
    confidence: number; // 1-100
    keyLevels: SupportResistanceLevel[]; // הרמות החשובות ביותר
    breakoutLevels: SupportResistanceLevel[]; // רמות פריצה פוטנציאליות
}

// Main Market Structure Result
export interface MarketStructureResult {
    symbol: string;
    name: string;
    currentPrice: number;
    analysisDate: string;
    calculationDate: string;
    
    // Support Levels
    supportLevels: {
        primary: SupportResistanceLevel;
        secondary: SupportResistanceLevel;
        tertiary: SupportResistanceLevel;
    };
    
    // Resistance Levels
    resistanceLevels: {
        primary: SupportResistanceLevel;
        secondary: SupportResistanceLevel;
        tertiary: SupportResistanceLevel;
    };
    
    // MA Levels
    maLevels: MALevels;
    
    // Pivot Points
    pivotPoints: PivotPoints;
    
    // Volume Analysis
    volumeAnalysis: VolumeAnalysis;
    
    // Summary
    summary: MarketStructureSummary;
    
    // Historical data used for analysis
    historicalData: OHLCData[];
    
    // Analysis metadata
    analysisMetadata: {
        dataPoints: number; // כמה נקודות נתונים נותחו
        timeFrame: string; // '20 days' | '50 days' | '100 days'
        lastUpdated: string;
        confidence: number; // 1-100
    };
}

// Input for FSupportResist analysis
export interface FSupportResistInput {
    symbol: string;
    name: string;
    currentPrice: number;
    analysisDate: string;
    historicalData: OHLCData[];
}

// Configuration for FSupportResist analysis
export interface MarketStructureConfig {
    // Time frames for analysis
    lookbackDays: number; // כמה ימים אחורה לנתח
    
    // Swing detection
    swingDetectionWindow: number; // חלון זיהוי swing (5-10 ימים)
    swingMinStrength: number; // חוזק מינימלי ל-swing
    
    // MA periods
    sma20Period: number;
    sma50Period: number;
    sma200Period: number;
    
    // Volume analysis
    volumeThreshold: number; // 1.5 = נפח גבוה פי 1.5 מהממוצע
    volumeLookback: number; // 20 = ממוצע נפח על 20 ימים
    
    // Pivot points
    usePivotPoints: boolean;
    
    // Level strength calculation
    strengthWeights: {
        touches: number; // משקל מספר נגיעות
        recency: number; // משקל עדכניות הנגיעה
        volume: number; // משקל נפח
        timeHeld: number; // משקל זמן החזקה ברמה
    };
    
    // Confidence calculation
    confidenceThresholds: {
        high: number; // 80+
        medium: number; // 60-79
        low: number; // <60
    };
}

// Default configuration
export const DEFAULT_MARKET_STRUCTURE_CONFIG: MarketStructureConfig = {
    lookbackDays: 50,
    swingDetectionWindow: 7,
    swingMinStrength: 2,
    sma20Period: 20,
    sma50Period: 50,
    sma200Period: 200,
    volumeThreshold: 1.5,
    volumeLookback: 20,
    usePivotPoints: true,
    strengthWeights: {
        touches: 0.3,
        recency: 0.25,
        volume: 0.25,
        timeHeld: 0.2
    },
    confidenceThresholds: {
        high: 80,
        medium: 60,
        low: 40
    }
};
