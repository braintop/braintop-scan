// CAtrPrice Logic - חילוץ הלוגיקה מ-CAtrPrice.tsx
// import * as CAtrPriceTypes from '../Types/CAtrPriceTypes';

// חישוב ATR (Average True Range)
export const calculateATR = (ohlcData: any[], period: number): number => {
    if (ohlcData.length < period + 1) {
        return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < ohlcData.length; i++) {
        const current = ohlcData[i];
        const previous = ohlcData[i - 1];
        
        const high = current.h;
        const low = current.l;
        const previousClose = previous.c;
        
        const tr1 = high - low;
        const tr2 = Math.abs(high - previousClose);
        const tr3 = Math.abs(low - previousClose);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
    }
    
    // Calculate ATR as simple moving average of true ranges
    const atrValues = trueRanges.slice(-period);
    return atrValues.reduce((sum, tr) => sum + tr, 0) / atrValues.length;
};

// חישוב Bollinger Bands
export const calculateBollingerBands = (ohlcData: any[], period: number, stdDev: number): { bbWidth: number; bbPosition: number } => {
    if (ohlcData.length < period) {
        return { bbWidth: 0, bbPosition: 0 };
    }

    const closes = ohlcData.slice(-period).map(d => d.c);
    const sma = closes.reduce((sum, close) => sum + close, 0) / closes.length;
    
    const variance = closes.reduce((sum, close) => sum + Math.pow(close - sma, 2), 0) / closes.length;
    const standardDeviation = Math.sqrt(variance);
    
    const upperBand = sma + (standardDeviation * stdDev);
    const lowerBand = sma - (standardDeviation * stdDev);
    const bbWidth = ((upperBand - lowerBand) / sma) * 100;
    
    const currentPrice = ohlcData[ohlcData.length - 1].c;
    const bbPosition = ((currentPrice - lowerBand) / (upperBand - lowerBand)) * 100;
    
    return { bbWidth, bbPosition };
};

// חישוב ציון LongAtrPriceScore מדויק - פישוט ל-Long בלבד
export const calculateLongAtrPriceScore = async (
    symbol: string, 
    currentPrice: number, 
    ohlcData: any[]
): Promise<{ score: number, atrRatio: number, bbWidth: number, bbPosition: number }> => {
    try {
        console.log(`📊 Calculating LongAtrPriceScore for ${symbol}`);
        
        if (ohlcData.length < 20) {
            throw new Error('Not enough data for advanced calculations');
        }

        // 1. חישוב ATR מדויק (14 ימים)
        const atr = calculateATR(ohlcData, 14);
        const atrRatio = (atr / currentPrice) * 100;
        
        console.log(`🔍 ATR calculation for ${symbol}:`, {
            atr,
            currentPrice,
            atrRatio,
            dataLength: ohlcData.length
        });

        // 2. חישוב Bollinger Bands מדויק (20 ימים, 2 std)
        const bbData = calculateBollingerBands(ohlcData, 20, 2);
        
        console.log(`🔍 Bollinger Bands calculation for ${symbol}:`, {
            bbData,
            currentPrice,
            bbWidth: bbData.bbWidth,
            bbPosition: bbData.bbPosition
        });

        console.log(`📈 ${symbol} advanced metrics:`, {
            atr: atr.toFixed(3),
            atrRatio: `${atrRatio.toFixed(2)}%`,
            bbWidth: `${bbData.bbWidth.toFixed(2)}%`,
            bbPosition: bbData.bbPosition.toFixed(3)
        });

        // 3. ציון ATR/Price (40% מהציון)
        let atrScore = 0;
        if (atrRatio >= 2 && atrRatio <= 5) {
            atrScore = 80; // Sweet spot כמו ChatGPT
        } else if (atrRatio >= 1 && atrRatio < 2) {
            atrScore = 50 + (atrRatio - 1) * 30; // 1%-2% = 50-80
        } else if (atrRatio > 5 && atrRatio <= 10) {
            atrScore = 80 - (atrRatio - 5) * 10; // 5%-10% = 80-30
        } else if (atrRatio < 1) {
            atrScore = 20; // מתה מדי
        } else { // > 10%
            atrScore = 10; // מטורפת מדי
        }

        // 4. ציון BB Width (30% מהציון)
        let bbWidthScore = 0;
        if (bbData.bbWidth >= 3 && bbData.bbWidth <= 6) {
            bbWidthScore = 70; // אידיאל
        } else if (bbData.bbWidth >= 2 && bbData.bbWidth < 3) {
            bbWidthScore = 40 + (bbData.bbWidth - 2) * 30; // 2%-3% = 40-70
        } else if (bbData.bbWidth > 6 && bbData.bbWidth <= 12) {
            bbWidthScore = 70 - (bbData.bbWidth - 6) * 6.67; // 6%-12% = 70-30
        } else if (bbData.bbWidth > 12) {
            bbWidthScore = 35; // רחב מדי כמו AAPL
        } else if (bbData.bbWidth < 2) {
            bbWidthScore = 30; // דחוס מדי
        }

        // 5. ציון %b Position (30% מהציון) - פישוט ל-Long בלבד
        let bbPositionScore = 0;
        if (bbData.bbPosition >= 0.2 && bbData.bbPosition <= 0.3) {
            bbPositionScore = 90; // מעולה ללונג - מחיר נמוך ברצועות
        } else if (bbData.bbPosition < 0.2) {
            bbPositionScore = 85; // מצוין ללונג - Oversold
        } else if (bbData.bbPosition >= 0.3 && bbData.bbPosition < 0.4) {
            bbPositionScore = 75; // טוב ללונג
        } else if (bbData.bbPosition >= 0.4 && bbData.bbPosition <= 0.6) {
            bbPositionScore = 50; // ניטרלי
        } else if (bbData.bbPosition > 0.6 && bbData.bbPosition <= 0.7) {
            bbPositionScore = 30; // פחות טוב ללונג
        } else if (bbData.bbPosition > 0.7) {
            bbPositionScore = 20; // לא טוב ללונג - Overbought
        }

        // 6. ציון משוקלל כמו ChatGPT
        const finalScore = Math.round(
            (atrScore * 0.4) + (bbWidthScore * 0.3) + (bbPositionScore * 0.3)
        );

        console.log(`🎯 ${symbol} LongAtrPriceScore breakdown:`, {
            atrScore: `${atrScore} (40%)`,
            bbWidthScore: `${bbWidthScore} (30%)`,  
            bbPositionScore: `${bbPositionScore} (30%)`,
            finalScore: finalScore
        });

        // 7. ציון סופי מ-1 עד 100 עבור Long בלבד
        const finalLongScore = Math.max(1, Math.min(100, finalScore));

        return {
            score: finalLongScore,
            atrRatio,
            bbWidth: bbData.bbWidth,
            bbPosition: bbData.bbPosition
        };

    } catch (error) {
        console.error(`❌ Advanced calculation failed for ${symbol}:`, error);
        // חזרה לחישוב פשוט במקרה של שגיאה
        const dailyReturn = ((currentPrice - (ohlcData[ohlcData.length - 2]?.c || currentPrice)) / (ohlcData[ohlcData.length - 2]?.c || currentPrice)) * 100;
        const volatility = Math.abs(dailyReturn);
        
        let fallbackScore = 50;
        if (volatility >= 1 && volatility <= 3) {
            fallbackScore = 70;
        } else if (volatility > 3 && volatility <= 6) {
            fallbackScore = 50;
        } else {
            fallbackScore = 30;
        }

        return {
            score: fallbackScore,
            atrRatio: volatility,
            bbWidth: 0,
            bbPosition: 50
        };
    }
};

// חישוב ציון ShortAtrPriceScore - לוגיקה הפוכה מ-Long
export const calculateShortAtrPriceScore = async (
    symbol: string, 
    currentPrice: number, 
    ohlcData: any[]
): Promise<{ score: number, atrRatio: number, bbWidth: number, bbPosition: number }> => {
    try {
        console.log(`📊 Calculating ShortAtrPriceScore for ${symbol}`);
        
        if (ohlcData.length < 20) {
            throw new Error('Not enough data for advanced calculations');
        }

        // 1. חישוב ATR מדויק (14 ימים)
        const atr = calculateATR(ohlcData, 14);
        const atrRatio = (atr / currentPrice) * 100;
        
        console.log(`🔍 ATR calculation for ${symbol}:`, {
            atr,
            currentPrice,
            atrRatio,
            dataLength: ohlcData.length
        });

        // 2. חישוב Bollinger Bands מדויק (20 ימים, 2 std)
        const bbData = calculateBollingerBands(ohlcData, 20, 2);
        
        console.log(`🔍 Bollinger Bands calculation for ${symbol}:`, {
            bbData,
            currentPrice,
            bbWidth: bbData.bbWidth,
            bbPosition: bbData.bbPosition
        });

        console.log(`📈 ${symbol} advanced metrics:`, {
            atr: atr.toFixed(3),
            atrRatio: `${atrRatio.toFixed(2)}%`,
            bbWidth: `${bbData.bbWidth.toFixed(2)}%`,
            bbPosition: bbData.bbPosition.toFixed(3)
        });

        // 3. ציון ATR/Price (40% מהציון) - Short logic: תנודתיות נמוכה = טוב ל-Short
        let atrScore = 0;
        if (atrRatio >= 2 && atrRatio <= 5) {
            atrScore = 60; // בינוני ל-Short (תנודתיות רגילה)
        } else if (atrRatio >= 1 && atrRatio < 2) {
            atrScore = 80 - (atrRatio - 1) * 20; // 1%-2% = 80-60 (טוב ל-Short)
        } else if (atrRatio > 5 && atrRatio <= 10) {
            atrScore = 60 + (atrRatio - 5) * 6; // 5%-10% = 60-90 (רע ל-Short)
        } else if (atrRatio < 1) {
            atrScore = 90; // מעולה ל-Short (תנודתיות נמוכה)
        } else { // > 10%
            atrScore = 100; // מצוין ל-Short (תנודתיות נמוכה מאוד)
        }

        // 4. ציון BB Width (30% מהציון) - Short logic: דחיסות = טוב ל-Short
        let bbWidthScore = 0;
        if (bbData.bbWidth >= 3 && bbData.bbWidth <= 6) {
            bbWidthScore = 50; // בינוני ל-Short
        } else if (bbData.bbWidth >= 2 && bbData.bbWidth < 3) {
            bbWidthScore = 70 + (3 - bbData.bbWidth) * 20; // 2%-3% = 90-70 (טוב ל-Short)
        } else if (bbData.bbWidth > 6 && bbData.bbWidth <= 12) {
            bbWidthScore = 50 - (bbData.bbWidth - 6) * 5; // 6%-12% = 50-20 (רע ל-Short)
        } else if (bbData.bbWidth > 12) {
            bbWidthScore = 10; // רע מאוד ל-Short
        } else if (bbData.bbWidth < 2) {
            bbWidthScore = 100; // מעולה ל-Short (דחוס מאוד)
        }

        // 5. ציון %b Position (30% מהציון) - Short logic: מחיר גבוה = טוב ל-Short
        let bbPositionScore = 0;
        if (bbData.bbPosition >= 0.7 && bbData.bbPosition <= 0.8) {
            bbPositionScore = 90; // מעולה ל-Short - מחיר גבוה ברצועות
        } else if (bbData.bbPosition > 0.8) {
            bbPositionScore = 85; // מצוין ל-Short - Overbought
        } else if (bbData.bbPosition >= 0.6 && bbData.bbPosition < 0.7) {
            bbPositionScore = 75; // טוב ל-Short
        } else if (bbData.bbPosition >= 0.4 && bbData.bbPosition <= 0.6) {
            bbPositionScore = 50; // ניטרלי
        } else if (bbData.bbPosition >= 0.3 && bbData.bbPosition < 0.4) {
            bbPositionScore = 30; // פחות טוב ל-Short
        } else if (bbData.bbPosition < 0.3) {
            bbPositionScore = 20; // לא טוב ל-Short - Oversold
        }

        // 6. ציון משוקלל כמו ChatGPT - Short logic
        const finalScore = Math.round(
            (atrScore * 0.4) + (bbWidthScore * 0.3) + (bbPositionScore * 0.3)
        );

        console.log(`🎯 ${symbol} ShortAtrPriceScore breakdown:`, {
            atrScore: `${atrScore} (40%)`,
            bbWidthScore: `${bbWidthScore} (30%)`,  
            bbPositionScore: `${bbPositionScore} (30%)`,
            finalScore: finalScore
        });

        // 7. ציון סופי מ-1 עד 100 עבור Short בלבד
        const finalShortScore = Math.max(1, Math.min(100, finalScore));

        return {
            score: finalShortScore,
            atrRatio,
            bbWidth: bbData.bbWidth,
            bbPosition: bbData.bbPosition
        };

    } catch (error) {
        console.error(`❌ Advanced calculation failed for ${symbol}:`, error);
        // חזרה לחישוב פשוט במקרה של שגיאה - Short logic
        const dailyReturn = ((currentPrice - (ohlcData[ohlcData.length - 2]?.c || currentPrice)) / (ohlcData[ohlcData.length - 2]?.c || currentPrice)) * 100;
        const volatility = Math.abs(dailyReturn);
        
        let fallbackScore = 50;
        if (volatility >= 1 && volatility <= 3) {
            fallbackScore = 30; // רע ל-Short (תנודתיות רגילה)
        } else if (volatility > 3 && volatility <= 6) {
            fallbackScore = 50; // בינוני ל-Short
        } else {
            fallbackScore = 70; // טוב ל-Short (תנודתיות נמוכה)
        }

        return {
            score: fallbackScore,
            atrRatio: volatility,
            bbWidth: 0,
            bbPosition: 50
        };
    }
};
