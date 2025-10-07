// DTCandles Logic - לוגיקה לניתוח נרות
import * as DTCandlesTypes from '../Types/DTCandlesTypes';
import { CANDLE_CONFIG } from '../Components/CandleConfig';

export class DTCandlesLogic {
    
    // ניתוח נרות למניה
    static async analyzeCandles(
        stock: DTCandlesTypes.FavoriteStock,
        dSignalsResult: DTCandlesTypes.DSignalsInput,
        historicalData: DTCandlesTypes.OHLCData[],
        targetDate: string
    ): Promise<DTCandlesTypes.CandleResult> {
        console.log(`🕯️ Analyzing candles for ${stock.symbol}...`);
        
        try {
            if (historicalData.length < 3) {
                console.warn(`⚠️ Not enough data for candle analysis: ${stock.symbol}`);
                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.price,
                    candleScore: 0,
                    detectedPatterns: [],
                    analysisDate: targetDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                };
            }

            const currentCandle = historicalData[historicalData.length - 1];
            const prevCandle = historicalData[historicalData.length - 2];
            
            let score = 0;
            const detectedPatterns: DTCandlesTypes.CandlePattern[] = [];

            // בדיקת Hammer - דורש ירידה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Hammer', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                this.detectHammer(currentCandle)) {
                score += CANDLE_CONFIG.WEIGHTS.HAMMER;
                detectedPatterns.push('Hammer');
                console.log(`✅ Hammer detected for ${stock.symbol}`);
            }

            // בדיקת Bullish Engulfing - דורש עלייה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Bullish Engulfing', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                this.detectBullishEngulfing(prevCandle, currentCandle)) {
                score += CANDLE_CONFIG.WEIGHTS.BULLISH_ENGULFING;
                detectedPatterns.push('Bullish Engulfing');
                console.log(`✅ Bullish Engulfing detected for ${stock.symbol}`);
            }

            // בדיקת Piercing Line - דורש ירידה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Piercing Line', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                this.detectPiercingLine(prevCandle, currentCandle)) {
                score += CANDLE_CONFIG.WEIGHTS.PIERCING_LINE;
                detectedPatterns.push('Piercing Line');
                console.log(`✅ Piercing Line detected for ${stock.symbol}`);
            }

            // בדיקת Morning Star - דורש ירידה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Morning Star', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                this.detectMorningStar(historicalData)) {
                score += CANDLE_CONFIG.WEIGHTS.MORNING_STAR;
                detectedPatterns.push('Morning Star');
                console.log(`✅ Morning Star detected for ${stock.symbol}`);
            }

            // בדיקת Inverted Hammer - דורש ירידה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Inverted Hammer', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                this.detectInvertedHammer(currentCandle)) {
                score += CANDLE_CONFIG.WEIGHTS.INVERTED_HAMMER;
                detectedPatterns.push('Inverted Hammer');
                console.log(`✅ Inverted Hammer detected for ${stock.symbol}`);
            }

            // בדיקת Three White Soldiers - דורש עלייה
            if (CANDLE_CONFIG.UTILS.isPatternCompatible('Three White Soldiers', dSignalsResult.LongMomentumScore, dSignalsResult.crossoverType) && 
                this.detectThreeWhiteSoldiers(historicalData)) {
                score += CANDLE_CONFIG.WEIGHTS.THREE_WHITE_SOLDIERS;
                detectedPatterns.push('Three White Soldiers');
                console.log(`✅ Three White Soldiers detected for ${stock.symbol}`);
            }

            console.log(`📊 ${stock.symbol} candle analysis:`, {
                score,
                patterns: detectedPatterns,
                dSignalsScore: dSignalsResult.LongMomentumScore,
                crossoverType: dSignalsResult.crossoverType
            });

            return {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.price,
                candleScore: Math.min(score, 100), // מקסימום 100
                detectedPatterns,
                analysisDate: targetDate,
                calculationDate: new Date().toISOString().split('T')[0]
            };

        } catch (error) {
            console.error(`❌ Error analyzing candles for ${stock.symbol}:`, error);
            return {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.price,
                candleScore: 0,
                detectedPatterns: [],
                analysisDate: targetDate,
                calculationDate: new Date().toISOString().split('T')[0]
            };
        }
    }

    // זיהוי Hammer
    static detectHammer(candle: DTCandlesTypes.OHLCData): boolean {
        const body = Math.abs(candle.close - candle.open);
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        const upperShadow = candle.high - Math.max(candle.open, candle.close);
        const totalRange = candle.high - candle.low;
        
        const smallBody = body <= totalRange * CANDLE_CONFIG.CRITERIA.HAMMER.SMALL_BODY_RATIO;
        const longLowerShadow = lowerShadow >= body * CANDLE_CONFIG.CRITERIA.HAMMER.LONG_LOWER_SHADOW_RATIO;
        const shortUpperShadow = upperShadow <= body * CANDLE_CONFIG.CRITERIA.HAMMER.SHORT_UPPER_SHADOW_RATIO;
        const closesNearHigh = candle.close >= candle.low + (totalRange * CANDLE_CONFIG.CRITERIA.HAMMER.CLOSE_TO_HIGH_RATIO);
        
        return smallBody && longLowerShadow && shortUpperShadow && closesNearHigh;
    }

    // זיהוי Bullish Engulfing
    static detectBullishEngulfing(prevCandle: DTCandlesTypes.OHLCData, currentCandle: DTCandlesTypes.OHLCData): boolean {
        const prevIsRed = prevCandle.close < prevCandle.open;
        const currentIsGreen = currentCandle.close > currentCandle.open;
        const engulfs = currentCandle.open < prevCandle.close && 
                       currentCandle.close > prevCandle.open;
        
        const greenBody = currentCandle.close - currentCandle.open;
        const redBody = prevCandle.open - prevCandle.close;
        const largerBody = greenBody >= redBody * CANDLE_CONFIG.CRITERIA.BULLISH_ENGULFING.MIN_BODY_RATIO;
        
        return prevIsRed && currentIsGreen && engulfs && largerBody;
    }

    // זיהוי Piercing Line
    static detectPiercingLine(prevCandle: DTCandlesTypes.OHLCData, currentCandle: DTCandlesTypes.OHLCData): boolean {
        const prevIsRed = prevCandle.close < prevCandle.open;
        const prevBody = prevCandle.open - prevCandle.close;
        const prevIsLong = prevBody > (prevCandle.high - prevCandle.low) * CANDLE_CONFIG.CRITERIA.PIERCING_LINE.LONG_BODY_RATIO;
        
        const currentIsGreen = currentCandle.close > currentCandle.open;
        const gapsDown = currentCandle.open < prevCandle.close;
        const closesInRedBody = currentCandle.close > prevCandle.open && 
                               currentCandle.close < prevCandle.close;
        const closesAboveMid = currentCandle.close > (prevCandle.open + prevCandle.close) / 2;
        
        return prevIsRed && prevIsLong && currentIsGreen && 
               gapsDown && closesInRedBody && closesAboveMid;
    }

    // זיהוי Morning Star
    static detectMorningStar(candles: DTCandlesTypes.OHLCData[]): boolean {
        if (candles.length < 3) return false;
        
        const [prev2, prev1, current] = candles.slice(-3);
        
        const firstIsRed = prev2.close < prev2.open;
        const firstIsLong = (prev2.open - prev2.close) > (prev2.high - prev2.low) * CANDLE_CONFIG.CRITERIA.MORNING_STAR.LONG_BODY_RATIO;
        
        const secondIsSmall = Math.abs(prev1.close - prev1.open) < (prev1.high - prev1.low) * CANDLE_CONFIG.CRITERIA.MORNING_STAR.SMALL_BODY_RATIO;
        const secondGapsDown = prev1.open < prev2.close;
        
        const thirdIsGreen = current.close > current.open;
        const thirdIsLong = (current.close - current.open) > (current.high - current.low) * CANDLE_CONFIG.CRITERIA.MORNING_STAR.LONG_THIRD_BODY_RATIO;
        const thirdGapsUp = current.open > prev1.close;
        
        const closesAboveFirstMid = current.close > (prev2.open + prev2.close) / 2;
        
        return firstIsRed && firstIsLong && secondIsSmall && secondGapsDown &&
               thirdIsGreen && thirdIsLong && thirdGapsUp && closesAboveFirstMid;
    }

    // זיהוי Inverted Hammer
    static detectInvertedHammer(candle: DTCandlesTypes.OHLCData): boolean {
        const body = Math.abs(candle.close - candle.open);
        const upperShadow = candle.high - Math.max(candle.open, candle.close);
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        const totalRange = candle.high - candle.low;
        
        const smallBody = body <= totalRange * CANDLE_CONFIG.CRITERIA.INVERTED_HAMMER.SMALL_BODY_RATIO;
        const longUpperShadow = upperShadow >= body * CANDLE_CONFIG.CRITERIA.INVERTED_HAMMER.LONG_UPPER_SHADOW_RATIO;
        const shortLowerShadow = lowerShadow <= body * CANDLE_CONFIG.CRITERIA.INVERTED_HAMMER.SHORT_LOWER_SHADOW_RATIO;
        const closesNearLow = candle.close <= candle.low + (totalRange * CANDLE_CONFIG.CRITERIA.INVERTED_HAMMER.CLOSE_TO_LOW_RATIO);
        
        return smallBody && longUpperShadow && shortLowerShadow && closesNearLow;
    }

    // זיהוי Three White Soldiers
    static detectThreeWhiteSoldiers(candles: DTCandlesTypes.OHLCData[]): boolean {
        if (candles.length < 3) return false;
        
        const [prev2, prev1, current] = candles.slice(-3);
        
        const allGreen = prev2.close > prev2.open && 
                        prev1.close > prev1.open && 
                        current.close > current.open;
        
        const increasingBodies = (prev1.close - prev1.open) > (prev2.close - prev2.open) &&
                               (current.close - current.open) > (prev1.close - prev1.open);
        
        const opensInPrevBody = prev1.open > prev2.open && prev1.open < prev2.close &&
                              current.open > prev1.open && current.open < prev1.close;
        
        const higherCloses = prev1.close > prev2.close && current.close > prev1.close;
        
        return allGreen && increasingBodies && opensInPrevBody && higherCloses;
    }

    // חישוב ציון כולל
    static calculateTotalScore(patterns: DTCandlesTypes.CandlePattern[]): number {
        return CANDLE_CONFIG.UTILS.calculateTotalScore(patterns);
    }

    // בדיקת קטגוריית ניקוד
    static getScoreCategory(score: number): string {
        return CANDLE_CONFIG.UTILS.getScoreCategory(score);
    }

    // בדיקת תאימות מגמה
    static isPatternCompatible(pattern: DTCandlesTypes.CandlePattern, momentumScore: number, crossoverType: string): boolean {
        return CANDLE_CONFIG.UTILS.isPatternCompatible(pattern, momentumScore, crossoverType);
    }
}
