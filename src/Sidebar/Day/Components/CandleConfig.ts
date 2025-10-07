// CandleConfig.ts - קונפיגורציה לניקוד נרות
// קובץ זה מכיל את כל הניקודים והמשקלים עבור DTCandles

// ניקוד פנימי של DTCandles (0-100)
export const CANDLE_WEIGHTS = {
    // נרות עדיפות גבוהה (50 נקודות)
    HAMMER: 25,                    // דחייה חזקה
    BULLISH_ENGULFING: 25,         // שינוי מגמה
    
    // נרות עדיפות בינונית (35 נקודות)
    PIERCING_LINE: 20,             // התאוששות
    MORNING_STAR: 15,              // סיום מגמה
    
    // נרות עדיפות נמוכה (15 נקודות)
    INVERTED_HAMMER: 10,           // דחייה למעלה
    THREE_WHITE_SOLDIERS: 5        // מגמה עולה
} as const;

// משקלים ב-MasterAnalysis (אחוזים)
export const MASTER_ANALYSIS_WEIGHTS = {
    bspy: 20,           // יחס ל-SPY
    dsignals: 25,       // מומנטום
    volume: 20,         // נפחים
    atrPrice: 15,       // מיקום יחסי
    eadx: 15,           // מגמה
    candles: 5          // נרות (DTCandles)
} as const;

// ספי פעולה לניקוד נרות
export const CANDLE_THRESHOLDS = {
    EXCELLENT: 50,      // מעולה (50+)
    GOOD: 25,           // טוב (25-49)
    WEAK: 0             // חלש (<25)
} as const;

// ספי פעולה למגמות (מ-DSignals)
export const MOMENTUM_THRESHOLDS = {
    BULLISH: 60,        // עלייה (60+)
    BEARISH: 40,        // ירידה (<40)
    NEUTRAL: 50         // ניטרלי (40-60)
} as const;

// קריטריונים לזיהוי נרות
export const CANDLE_CRITERIA = {
    // Hammer
    HAMMER: {
        SMALL_BODY_RATIO: 0.3,         // גוף קטן ≤ 30% מהטווח
        LONG_LOWER_SHADOW_RATIO: 2,     // צל תחתון ≥ פי 2 מהגוף
        SHORT_UPPER_SHADOW_RATIO: 0.5,  // צל עליון ≤ 50% מהגוף
        CLOSE_TO_HIGH_RATIO: 0.8        // סגירה ≥ 80% מהטווח
    },
    
    // Bullish Engulfing
    BULLISH_ENGULFING: {
        MIN_BODY_RATIO: 1.0             // גוף ירוק ≥ גוף אדום
    },
    
    // Piercing Line
    PIERCING_LINE: {
        LONG_BODY_RATIO: 0.6,           // נר אדום ארוך ≥ 60% מהטווח
        CLOSE_ABOVE_MID: true            // סגירה מעל אמצע הגוף האדום
    },
    
    // Morning Star
    MORNING_STAR: {
        LONG_BODY_RATIO: 0.6,           // נר ראשון ארוך ≥ 60% מהטווח
        SMALL_BODY_RATIO: 0.3,          // נר שני קטן ≤ 30% מהטווח
        LONG_THIRD_BODY_RATIO: 0.6      // נר שלישי ארוך ≥ 60% מהטווח
    },
    
    // Inverted Hammer
    INVERTED_HAMMER: {
        SMALL_BODY_RATIO: 0.3,          // גוף קטן ≤ 30% מהטווח
        LONG_UPPER_SHADOW_RATIO: 2,     // צל עליון ≥ פי 2 מהגוף
        SHORT_LOWER_SHADOW_RATIO: 0.5,  // צל תחתון ≤ 50% מהגוף
        CLOSE_TO_LOW_RATIO: 0.2         // סגירה ≤ 20% מהטווח
    },
    
    // Three White Soldiers
    THREE_WHITE_SOLDIERS: {
        MIN_BODY_INCREASE: 0.1          // כל נר גדול ב-10% מהקודם
    }
} as const;

// הודעות למשתמש
export const CANDLE_MESSAGES = {
    EXCELLENT: '🔥 מעולה ללונג',
    GOOD: '✅ טוב ללונג',
    WEAK: '❄️ חלש ללונג',
    NO_PATTERNS: 'אין נרות',
    
    ANALYSIS_COMPLETE: 'ניתוח נרות ללונג הושלם! 🕯️',
    SAVE_SUCCESS: 'תוצאות ניתוח נרות ללונג עודכנו ב-relative-strength בהצלחה! 🕯️',
    
    PATTERNS: {
        HAMMER: 'Hammer - דחייה חזקה',
        BULLISH_ENGULFING: 'Bullish Engulfing - שינוי מגמה',
        PIERCING_LINE: 'Piercing Line - התאוששות',
        MORNING_STAR: 'Morning Star - סיום מגמה',
        INVERTED_HAMMER: 'Inverted Hammer - דחייה למעלה',
        THREE_WHITE_SOLDIERS: 'Three White Soldiers - מגמה עולה'
    }
} as const;

// סטטיסטיקות ברירת מחדל
export const DEFAULT_STATS = {
    TOTAL_PATTERNS: 6,
    MAX_SCORE: 100,
    MIN_SCORE: 0,
    PATTERNS_PER_STOCK: 3 // מקסימום נרות למניה
} as const;

// פונקציות עזר
export const CandleUtils = {
    // בדיקת סף ניקוד
    getScoreCategory: (score: number): string => {
        if (score >= CANDLE_THRESHOLDS.EXCELLENT) return CANDLE_MESSAGES.EXCELLENT;
        if (score >= CANDLE_THRESHOLDS.GOOD) return CANDLE_MESSAGES.GOOD;
        return CANDLE_MESSAGES.WEAK;
    },
    
    // בדיקת מגמה
    getMomentumCategory: (score: number): string => {
        if (score >= MOMENTUM_THRESHOLDS.BULLISH) return 'Bullish';
        if (score <= MOMENTUM_THRESHOLDS.BEARISH) return 'Bearish';
        return 'Neutral';
    },
    
    // חישוב ציון כולל
    calculateTotalScore: (patterns: string[]): number => {
        let totalScore = 0;
        
        patterns.forEach(pattern => {
            switch (pattern) {
                case 'Hammer':
                    totalScore += CANDLE_WEIGHTS.HAMMER;
                    break;
                case 'Bullish Engulfing':
                    totalScore += CANDLE_WEIGHTS.BULLISH_ENGULFING;
                    break;
                case 'Piercing Line':
                    totalScore += CANDLE_WEIGHTS.PIERCING_LINE;
                    break;
                case 'Morning Star':
                    totalScore += CANDLE_WEIGHTS.MORNING_STAR;
                    break;
                case 'Inverted Hammer':
                    totalScore += CANDLE_WEIGHTS.INVERTED_HAMMER;
                    break;
                case 'Three White Soldiers':
                    totalScore += CANDLE_WEIGHTS.THREE_WHITE_SOLDIERS;
                    break;
            }
        });
        
        return Math.min(totalScore, CANDLE_WEIGHTS.HAMMER + CANDLE_WEIGHTS.BULLISH_ENGULFING + 
                        CANDLE_WEIGHTS.PIERCING_LINE + CANDLE_WEIGHTS.MORNING_STAR + 
                        CANDLE_WEIGHTS.INVERTED_HAMMER + CANDLE_WEIGHTS.THREE_WHITE_SOLDIERS);
    },
    
    // בדיקת תאימות מגמה לנר
    isPatternCompatible: (pattern: string, momentumScore: number, crossoverType: string): boolean => {
        const isBullish = momentumScore >= MOMENTUM_THRESHOLDS.BULLISH || crossoverType === 'Bullish';
        const isBearish = momentumScore <= MOMENTUM_THRESHOLDS.BEARISH || crossoverType === 'Bearish';
        
        switch (pattern) {
            case 'Hammer':
            case 'Piercing Line':
            case 'Morning Star':
            case 'Inverted Hammer':
                return isBearish; // נרות אלה דורשים ירידה
            
            case 'Bullish Engulfing':
            case 'Three White Soldiers':
                return isBullish; // נרות אלה דורשים עלייה
            
            default:
                return true; // ניטרלי
        }
    }
};

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

// קונפיגורציה מלאה
export const CANDLE_CONFIG = {
    WEIGHTS: CANDLE_WEIGHTS,
    MASTER_WEIGHTS: MASTER_ANALYSIS_WEIGHTS,
    THRESHOLDS: CANDLE_THRESHOLDS,
    MOMENTUM_THRESHOLDS,
    CRITERIA: CANDLE_CRITERIA,
    MESSAGES: CANDLE_MESSAGES,
    STATS: DEFAULT_STATS,
    UTILS: CandleUtils
} as const;
