// Type definitions for the pattern detection system
interface CandleData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface PatternData {
    ticker: string;
    date: string;
    pattern: string;
    price: number;
    volume: number;
    time: number;
    pricesAfter: (number | null)[];
    trend: string | null;
    fin: any;
}

export const calculateSMA = (prices: number[], period: number): number[] => {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            sma.push(NaN);
            continue;
        }
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
};

export const analyzeMovingAverages = (sma50: number, sma200: number) => {
    let grade = 50;
    let explanation = '';

    const difference = ((sma50 - sma200) / sma200) * 100;

    if (difference > 10) {
        grade = 90;
        explanation = 'Strong uptrend: SMA50 well above SMA200';
    } else if (difference > 5) {
        grade = 75;
        explanation = 'Uptrend: SMA50 above SMA200';
    } else if (difference > 0) {
        grade = 60;
        explanation = 'Slight uptrend: SMA50 slightly above SMA200';
    } else if (difference > -5) {
        grade = 40;
        explanation = 'Slight downtrend: SMA50 slightly below SMA200';
    } else if (difference > -10) {
        grade = 25;
        explanation = 'Downtrend: SMA50 below SMA200';
    } else {
        grade = 10;
        explanation = 'Strong downtrend: SMA50 well below SMA200';
    }

    return { grade, explanation };
};

export const analyzeVolume = (data: CandleData[]) => {
    const recentVolumes = data.slice(-10).map(d => d.volume);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const latestVolume = recentVolumes[recentVolumes.length - 1];

    let grade = 50;
    let explanation = '';

    const volumeRatio = latestVolume / avgVolume;

    if (volumeRatio > 2) {
        grade = 90;
        explanation = 'Very high volume: Significant market interest';
    } else if (volumeRatio > 1.5) {
        grade = 75;
        explanation = 'Above average volume: Strong market interest';
    } else if (volumeRatio > 1) {
        grade = 60;
        explanation = 'Slightly above average volume';
    } else if (volumeRatio > 0.75) {
        grade = 40;
        explanation = 'Slightly below average volume';
    } else if (volumeRatio > 0.5) {
        grade = 25;
        explanation = 'Low volume: Limited market interest';
    } else {
        grade = 10;
        explanation = 'Very low volume: Minimal market interest';
    }

    return { grade, explanation, currentVolume: latestVolume, averageVolume: avgVolume };
};

export const analyzeCandlesticks = (data: CandleData[]) => {
    const recentCandles = data.slice(-5);
    let grade = 50;
    let explanation = '';

    // Simple analysis based on recent price action
    const priceChange = (recentCandles[recentCandles.length - 1].close - recentCandles[0].close) / recentCandles[0].close * 100;

    if (priceChange > 5) {
        grade = 90;
        explanation = 'Strong bullish candlestick patterns';
    } else if (priceChange > 2) {
        grade = 75;
        explanation = 'Bullish candlestick patterns';
    } else if (priceChange > 0) {
        grade = 60;
        explanation = 'Slightly bullish candlestick patterns';
    } else if (priceChange > -2) {
        grade = 40;
        explanation = 'Slightly bearish candlestick patterns';
    } else if (priceChange > -5) {
        grade = 25;
        explanation = 'Bearish candlestick patterns';
    } else {
        grade = 10;
        explanation = 'Strong bearish candlestick patterns';
    }

    return { grade, explanation };
};

const isUptrend = (data: CandleData[], endIndex: number, windowSize: number = 3): boolean => {
    if (endIndex < windowSize - 1) return false;
    return data.slice(endIndex - windowSize + 1, endIndex + 1).every((candle, index, arr) => index === 0 || candle.close > arr[index - 1].close);
};

const isDowntrend = (data: CandleData[], endIndex: number, windowSize: number = 3): boolean => {
    if (endIndex < windowSize - 1) return false;
    return data.slice(endIndex - windowSize + 1, endIndex + 1).every((candle, index, arr) => index === 0 || candle.close < arr[index - 1].close);
};

const isDumplingTop = (data: CandleData[], endIndex: number, windowSize: number = 20): boolean => {
    console.log('Checking Dumpling Top at index:', endIndex);

    if (endIndex < windowSize - 1) {
        console.log('Window size check failed');
        return false;
    }

    let peakIndex = endIndex - windowSize + 1;
    for (let i = peakIndex + 1; i <= endIndex; i++) {
        if (data[i].close > data[peakIndex].close) {
            peakIndex = i;
        }
    }

    console.log('Peak found at relative position:', (peakIndex - (endIndex - windowSize + 1)) / windowSize);

    // Check if the peak is roughly in the middle of the window
    if (peakIndex <= endIndex - windowSize / 2 || peakIndex >= endIndex - windowSize / 4) {
        console.log('Peak position check failed');
        return false;
    }

    // Verify downtrend after peak
    const downtrendStartIndex = peakIndex + 1;
    for (let i = downtrendStartIndex + 1; i <= endIndex; i++) {
        if (data[i].close >= data[i - 1].close) {
            console.log('Downtrend check failed at index:', i);
            return false;
        }
    }

    console.log('Dumpling Top pattern found!');
    return true;
};

// Helper function to determine success based on the prices after the pattern
/*
const isSuccess = (pricesAfter: any, pattern: any, currentPrice: any) => {
    if (!pricesAfter[0] || !pricesAfter[1]) return false; // Ensure there is data to compare
    switch (pattern) {
        case "Hammer":
        case "Bullish Engulfing":
        case "Piercing Pattern":
        case "Morning Star":
            return pricesAfter[0] > currentPrice && pricesAfter[1] > currentPrice; // Success if prices are higher on the next two days
        case "Shooting Star":
        case "Bearish Engulfing":
        case "Dark Cloud Cover":
        case "Evening Star":
            return pricesAfter[0] < currentPrice && pricesAfter[1] < currentPrice; // Success if prices are lower on the next two days
        default:
            return false; // No success condition met or pattern not supported
    }
};
*/

export const detectPatterns = (
    data: CandleData[],
    ticker: string,
    startDate: string,
    endDate: string,
    volumeThreshold: number,
    minPrice: number,
    maxPrice: number
): PatternData[] => {
    console.log('Pattern detection starting:', {
        ticker,
        startDate,
        endDate,
        dataPoints: data.length,
        priceRange: `$${minPrice} - $${maxPrice}`
    });

    const targetStartDate = new Date(startDate);
    targetStartDate.setHours(0, 0, 0, 0);

    const targetEndDate = new Date(endDate);
    targetEndDate.setHours(23, 59, 59, 999);

    return data.map((candle, index, arr) => {
        if (index < 2) return null;

        const candlePrice = candle.close;
        if (minPrice > 0 && maxPrice > 0) {
            if (candlePrice < minPrice || candlePrice > maxPrice) {
                return null;
            }
        }

        const candleDate = new Date(candle.date);
        candleDate.setHours(0, 0, 0, 0);

        const isInTargetRange = candleDate >= targetStartDate && candleDate <= targetEndDate;
        if (!isInTargetRange) return null;

        const previousCandle = arr[index - 1];
        // const twoBeforeCandle = arr[index - 2]; // Unused variable

        const nextPrices = Array(5).fill(null).map((_, i) => {
            const futureIndex = index + i + 1;
            return futureIndex < arr.length ? arr[futureIndex].close : null;
        });

        let pattern: PatternData | null = null;

        if (previousCandle && isDowntrend(arr, index - 1) &&
            Math.min(candle.open, candle.close) - candle.low > 2 * Math.abs(candle.close - candle.open) &&
            candle.high - Math.max(candle.open, candle.close) < 0.1 * (candle.high - candle.low) &&
            Math.abs(candle.close - candle.open) < 0.3 * (candle.high - candle.low) &&
            candle.volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: candle.date,
                pattern: "Hammer",
                price: candlePrice,
                volume: candle.volume,
                time: new Date(candle.date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: null,
                fin: null
            };
        }

        if (previousCandle && isUptrend(arr, index - 1) &&
            candle.high - Math.max(candle.open, candle.close) > 2 * Math.abs(candle.close - candle.open) &&
            Math.min(candle.open, candle.close) - candle.low < 0.1 * (candle.high - candle.low) &&
            Math.abs(candle.close - candle.open) < 0.3 * (candle.high - candle.low) &&
            candle.volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: candle.date,
                pattern: "Shooting Star",
                price: candlePrice,
                volume: candle.volume,
                time: new Date(candle.date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: null,
                fin: null
            };
        }

        if (previousCandle && isDowntrend(arr, index - 1) &&
            previousCandle.close < previousCandle.open &&
            candle.open < previousCandle.close &&
            candle.close > previousCandle.open &&
            Math.abs(candle.close - candle.open) > Math.abs(previousCandle.close - previousCandle.open) &&
            candle.volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: candle.date,
                pattern: "Bullish Engulfing",
                price: candlePrice,
                volume: candle.volume,
                time: new Date(candle.date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: null,
                fin: null
            };
        }

        if (previousCandle && isUptrend(arr, index - 1) &&
            previousCandle.close > previousCandle.open &&
            candle.open > previousCandle.close &&
            candle.close < previousCandle.open &&
            Math.abs(candle.close - candle.open) > Math.abs(previousCandle.close - previousCandle.open) &&
            candle.volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: candle.date,
                pattern: "Bearish Engulfing",
                price: candlePrice,
                volume: candle.volume,
                time: new Date(candle.date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: null,
                fin: null
            };
        }

        if (previousCandle && isDowntrend(arr, index - 1) &&
            previousCandle.close < previousCandle.open &&
            candle.open < previousCandle.low &&
            candle.close > (previousCandle.open + previousCandle.close) / 2 &&
            candle.close < previousCandle.open &&
            candle.volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: candle.date,
                pattern: "Piercing Pattern",
                price: candlePrice,
                volume: candle.volume,
                time: new Date(candle.date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: null,
                fin: null
            };
        }

        if (index >= 2 && isDowntrend(arr, index - 2) &&
            arr[index - 2].close < arr[index - 2].open &&
            Math.abs(arr[index - 1].close - arr[index - 1].open) <= 0.2 * (arr[index - 2].close - arr[index - 2].open) &&
            arr[index - 1].open < arr[index - 2].close &&
            arr[index].close > arr[index].open &&
            arr[index].close > arr[index - 2].close + (arr[index - 2].open - arr[index - 2].close) / 2 &&
            arr[index].volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: arr[index].date,
                pattern: "Morning Star",
                price: arr[index].close,
                volume: arr[index].volume,
                time: new Date(arr[index].date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: null,
                fin: null
            };
        }

        if (previousCandle && isUptrend(arr, index - 1) &&
            previousCandle.close > previousCandle.open &&
            candle.open > previousCandle.high &&
            candle.close < (previousCandle.open + previousCandle.close) / 2 &&
            candle.close > previousCandle.open &&
            candle.volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: candle.date,
                pattern: "Dark Cloud Cover",
                price: candlePrice,
                volume: candle.volume,
                time: new Date(candle.date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: null,
                fin: null
            };
        }

        if (index >= 2 && isUptrend(arr, index - 2) &&
            arr[index - 2].open < arr[index - 2].close &&
            Math.abs(arr[index - 1].close - arr[index - 1].open) <= 0.2 * (arr[index - 2].close - arr[index - 2].open) &&
            arr[index - 1].open > arr[index - 2].close &&
            arr[index].close < arr[index].open &&
            arr[index].close < arr[index - 2].open + (arr[index - 2].close - arr[index - 2].open) / 2 &&
            arr[index].volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: arr[index].date,
                pattern: "Evening Star",
                price: arr[index].close,
                volume: arr[index].volume,
                time: new Date(arr[index].date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: null,
                fin: null
            };
        }

        if (index >= 1 &&
            arr[index].high < arr[index - 1].low &&
            arr[index].open < arr[index - 1].low &&
            arr[index - 1].close > arr[index - 1].low &&
            (arr[index - 1].low - arr[index].high) / arr[index - 1].low >= 0.005 &&
            arr[index].volume >= volumeThreshold) {
            pattern = {
                ticker,
                date: arr[index].date,
                pattern: "Falling Window",
                price: arr[index].close,
                volume: arr[index].volume,
                time: new Date(arr[index].date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: "down",
                fin: null
            };
        }

        if (index >= 20 && isUptrend(arr, index - 20, 10) && isDumplingTop(arr, index, 20)) {
            pattern = {
                ticker,
                date: arr[index].date,
                pattern: "Dumpling Top",
                price: arr[index].close,
                volume: arr[index].volume,
                time: new Date(arr[index].date).getTime() / 1000,
                pricesAfter: nextPrices as (number | null)[],
                trend: "down",
                fin: null
            };
        }

        if (pattern) {
            if (pattern.price < minPrice || pattern.price > maxPrice) {
                return null;
            }

            console.log('Pattern found:', {
                ticker,
                date: pattern.date,
                pattern: pattern.pattern,
                price: pattern.price,
                targetRange: { startDate, endDate }
            });
        }

        return pattern;
    }).filter((pattern): pattern is PatternData =>
        pattern !== null &&
        new Date(pattern.date) >= targetStartDate &&
        new Date(pattern.date) <= targetEndDate &&
        pattern.price >= minPrice &&
        pattern.price <= maxPrice
    );
};

// Function to calculate RSI
/*
function getRSI(data: any[], periods: number = 14): number {
    if (data.length < periods + 1) {
        return 0;
    }

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= periods; i++) {
        const difference = data[i].c - data[i - 1].c;
        if (difference >= 0) {
            gains += difference;
        } else {
            losses -= difference;
        }
    }

    let avgGain = gains / periods;
    let avgLoss = losses / periods;

    // Calculate subsequent values using smoothing
    for (let i = periods + 1; i < data.length; i++) {
        const difference = data[i].c - data[i - 1].c;
        if (difference >= 0) {
            avgGain = (avgGain * (periods - 1) + difference) / periods;
            avgLoss = (avgLoss * (periods - 1)) / periods;
        } else {
            avgGain = (avgGain * (periods - 1)) / periods;
            avgLoss = (avgLoss * (periods - 1) - difference) / periods;
        }
    }

    if (avgLoss === 0) {
        return 100;
    }

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}
*/

/*
export async function analyzeStock(symbol: string) {
    try {
        const historicalData = await fetchHistoricalData(symbol);

        if (!historicalData.results || historicalData.results.length === 0) {
            throw new Error(`No data available for ${symbol}`);
        }

        const results = historicalData.results;
        const rsi = getRSI(results);

        return {
            symbol,
            rsi,
            lastPrice: results[results.length - 1].c,
            data: results
        };
    } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
        throw error;
    }
}
*/

// Add helper function for final grade calculation
/*
const calculateFinalGrade = (grades: number[]): number => {
    const validGrades = grades.filter(grade => !isNaN(grade));
    if (validGrades.length === 0) return 0;
    return validGrades.reduce((sum, grade) => sum + grade, 0) / validGrades.length;
};
*/

export const calculateRSI = (data: any[], period: number = 14): number => {
    if (data.length < period + 1) return 0;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
        const change = data[i].c - data[i - 1].c;
        if (change >= 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate RSI
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

export const calculateEMA = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const emaData = [];
    let ema = data[0];

    // First value is the same as SMA
    emaData.push(ema);

    // Calculate EMA for each period
    for (let i = 1; i < data.length; i++) {
        ema = (data[i] * k) + (ema * (1 - k));
        emaData.push(ema);
    }

    return emaData;
};

export const calculateMACD = (data: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): {
    macd: number[];
    signal: number[];
    histogram: number[];
} => {
    // Calculate EMAs
    const fastEMA = calculateEMA(data, fastPeriod);
    const slowEMA = calculateEMA(data, slowPeriod);

    // Calculate MACD line
    const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);

    // Calculate Signal line (9-day EMA of MACD line)
    const signalLine = calculateEMA(macdLine, signalPeriod);

    // Calculate histogram
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

    return {
        macd: macdLine,
        signal: signalLine,
        histogram: histogram
    };
};

export const calculateVolume = (volumes: number[]): {
    trend: string;
    abnormal: boolean;
    ratio: number;
} => {
    if (volumes.length < 10) return { trend: 'neutral', abnormal: false, ratio: 1 };

    // Calculate average volume for last 10 periods
    const recentVolumes = volumes.slice(-10);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const currentVolume = volumes[volumes.length - 1];
    const ratio = currentVolume / avgVolume;

    return {
        trend: ratio > 1.5 ? 'increasing' : ratio < 0.5 ? 'decreasing' : 'neutral',
        abnormal: ratio > 2 || ratio < 0.3,
        ratio: ratio
    };
};
