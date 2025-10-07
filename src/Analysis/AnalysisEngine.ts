import { FirebaseService } from '../Services/FirebaseService';
import { DateUtils } from '../Utils/DateUtils';
// import localStockData from '../Stocks/Util/local_stock_data.json'; // Removed - using daily files now
import { db } from '../Api/api';
import { collection, getDocs, query } from 'firebase/firestore';
// import polygonApi from '../Api/polygonApi';
import { calculateLongAtrPriceScore } from '../Sidebar/Day/Logic/CAtrPriceLogic';
import { AnalysisOrchestrator } from '../Sidebar/Day/Logic/AnalysisOrchestrator';

export interface AnalysisResult {
    date: string;
    frequency: string;
    stocks: StockAnalysisResult[];
    totalStocks: number;
    analysisTime: string;
    finalScore: number;
}

export interface StockAnalysisResult {
    symbol: string;
    name: string;
    currentPrice: number;
    
    // AScan results
    aScanScore?: number;
    aScanSignal?: string;
    
    // BSpy results
    longSpyScore?: number;
    relativeStrength?: number;
    stockReturn?: number;
    spyReturn?: number;
    
    // CAtrPrice results
    longAtrPriceScore?: number;
    atrValue?: number;
    atrRatio?: number;
    bbWidth?: number;
    bbPosition?: number;
    
    // DSignals results
    longMomentumScore?: number;
    sma3Current?: number;
    sma12Current?: number;
    crossoverType?: string;
    macdHistogram?: number;
    
    // EAdx results
    longAdxScore?: number;
    adxValue?: number;
    trendStrength?: string;
    
    // Final calculation
    finalScore: number;
    finalSignal: string;
    
    // Future prices (5 days)
    prices?: {
        day_1?: DayPrice;
        day_2?: DayPrice;
        day_3?: DayPrice;
        day_4?: DayPrice;
        day_5?: DayPrice;
    };
}

export interface DayPrice {
    date: string;
    open: number;
    high: number;
    low: number;
    price: number;
    volume: number;
}

export class AnalysisEngine {
    static async runFullAnalysis(date: string, frequency: 'daily' | 'weekly' | 'monthly', onProgress?: (step: string, progress: number) => void): Promise<AnalysisResult> {
        console.log(`🚀 Starting full analysis for ${date} (${frequency})`);
        const startTime = Date.now();

        try {
            // Step 1: BSpy (Starting point)
            console.log('📊 Running BSpy...');
            onProgress?.('BSpy - טוען נתונים...', 10);
            const bResults = await this.runBSpy(date, frequency);
            await FirebaseService.saveAnalysisResults(date, 'bspy', bResults, frequency);
            console.log(`✅ BSpy completed: ${bResults.length} stocks`);
            onProgress?.('BSpy הושלם', 20);

            // Step 2: CAtrPrice
            console.log('📊 Running CAtrPrice...');
            onProgress?.('CAtrPrice - מחשב ATR ו-Bollinger Bands...', 30);
            const cResults = await this.runCAtrPrice(date, frequency, bResults);
            await FirebaseService.saveAnalysisResults(date, 'catrprice', cResults, frequency);
            console.log(`✅ CAtrPrice completed: ${cResults.length} stocks`);
            onProgress?.('CAtrPrice הושלם', 50);

            // Step 3: DSignals
            console.log('📊 Running DSignals...');
            onProgress?.('DSignals - מחשב SMA ו-MACD...', 60);
            const dResults = await this.runDSignals(date, frequency, bResults);
            await FirebaseService.saveAnalysisResults(date, 'dsignals', dResults, frequency);
            console.log(`✅ DSignals completed: ${dResults.length} stocks`);
            onProgress?.('DSignals הושלם', 70);

            // Step 4: EAdx
            console.log('📊 Running EAdx...');
            onProgress?.('EAdx - מחשב ADX...', 80);
            const eResults = await this.runEAdx(date, frequency, bResults);
            await FirebaseService.saveAnalysisResults(date, 'eadx', eResults, frequency);
            console.log(`✅ EAdx completed: ${eResults.length} stocks`);
            onProgress?.('EAdx הושלם', 90);

            // Step 5: Calculate Final Score and combine results
            console.log('📊 Calculating final scores...');
            onProgress?.('מחשב ציון סופי...', 95);
            const finalResults = await this.calculateFinalScore(bResults, cResults, dResults, eResults);

            // Step 7: Add future prices (5 days)
            console.log('📊 Adding future prices...');
            onProgress?.('מוסיף מחירים עתידיים...', 98);
            const resultsWithFuturePrices = await this.addFuturePrices(finalResults, date);

            // Step 8: Save final results
            await FirebaseService.saveAnalysisResults(date, 'final', resultsWithFuturePrices, frequency);
            onProgress?.('שמירה הושלמה', 100);

            const analysisTime = Date.now() - startTime;
            console.log(`🎉 Full analysis completed in ${analysisTime}ms`);

            return {
                date,
                frequency,
                stocks: resultsWithFuturePrices,
                totalStocks: resultsWithFuturePrices.length,
                analysisTime: `${analysisTime}ms`,
                finalScore: this.calculateAverageFinalScore(resultsWithFuturePrices)
            };

        } catch (error) {
            console.error('❌ Error in full analysis:', error);
            throw error;
        }
    }

    static async runAScan(date: string, frequency: string): Promise<StockAnalysisResult[]> {
        console.log(`🔍 Running AScan for ${date} (${frequency})`);
        
        try {
            // Load favorite stocks from Firebase
            const favoriteStocks = await this.loadFavoriteStocks();
            if (favoriteStocks.length === 0) {
                throw new Error('No favorite stocks found - run AScan first');
            }

            const localData = await this.loadLocalData();
            const results: StockAnalysisResult[] = [];

            for (const stock of favoriteStocks) {
                try {
                    // Get stock data for the date
                    const stockData = localData[stock.symbol]?.[date];
                    if (!stockData) {
                        console.warn(`No data for ${stock.symbol} on ${date}`);
                        continue;
                    }

                    results.push({
                        symbol: stock.symbol,
                        name: stock.name,
                        currentPrice: stockData.close,
                        aScanScore: 85, // AScan already passed
                        aScanSignal: 'Strong Buy',
                        finalScore: 0,
                        finalSignal: ''
                    });

                } catch (stockError) {
                    console.error(`Error processing ${stock.symbol}:`, stockError);
                }
            }

            console.log(`✅ AScan completed: ${results.length} stocks`);
            return results;

        } catch (error) {
            console.error('❌ Error in AScan:', error);
            throw error;
        }
    }

    static async runBSpy(date: string, frequency: string): Promise<StockAnalysisResult[]> {
        console.log(`📊 Running REAL BSpy for ${date} (${frequency})`);
        
        try {
            // Load favorite stocks from Firebase
            console.log('🔍 Step 1: Loading favorite stocks from Firebase...');
            const favoriteStocks = await this.loadFavoriteStocks();
            console.log(`✅ Loaded ${favoriteStocks.length} favorite stocks:`, favoriteStocks.map(s => s.symbol).slice(0, 10).join(', '));
            
            if (favoriteStocks.length === 0) {
                throw new Error('No favorite stocks found - BSpy is the starting point');
            }

            // Get SPY data
            console.log('🔍 Step 2: Loading SPY data...');
            const spyData = await this.getSPYData(date);
            console.log(`✅ SPY data loaded:`, {
                currentPrice: spyData?.currentPrice,
                previousPrice: spyData?.previousPrice,
                return: spyData?.return
            });
            
            if (!spyData) {
                throw new Error('Failed to get SPY data');
            }

            // Load local data
            console.log('🔍 Step 3: Loading local stock data...');
            const results: StockAnalysisResult[] = [];
            const localData = await this.loadLocalData();
            console.log(`✅ Local data loaded: ${Object.keys(localData).length} symbols available`);

            console.log(`🔍 Step 4: Processing ${favoriteStocks.length} stocks...`);
            let processedCount = 0;
            let skippedCount = 0;
            
            for (const stock of favoriteStocks) {
                try {
                    // Get stock data for the date
                    const stockData = localData[stock.symbol]?.[date];
                    if (!stockData) {
                        console.warn(`⚠️ No data for ${stock.symbol} on ${date}`);
                        skippedCount++;
                        continue;
                    }

                    // Get previous day data
                    const previousDate = DateUtils.getPreviousTradingDay(date);
                    const previousStockData = localData[stock.symbol]?.[previousDate];
                    if (!previousStockData) {
                        console.warn(`⚠️ No previous data for ${stock.symbol} on ${previousDate}`);
                        skippedCount++;
                        continue;
                    }
                    
                    console.log(`📊 Processing ${stock.symbol}:`, {
                        currentPrice: stockData.close,
                        previousPrice: previousStockData.close,
                        date: date,
                        previousDate: previousDate
                    });

                    // Calculate returns
                    const stockReturn = ((stockData.close - previousStockData.close) / previousStockData.close) * 100;
                    const spyReturn = spyData.return;

                    // Calculate relative strength
                    let relativeStrength = stockReturn === 0 ? 1 : (stockReturn > 0 ? 2 : 0.5);
                    if (Math.abs(spyReturn) >= 0.001) {
                        const stockMultiplier = 1 + (stockReturn / 100);
                        const spyMultiplier = 1 + (spyReturn / 100);
                        relativeStrength = stockMultiplier / spyMultiplier;
                    }

                    // Calculate LongSpyScore
                    const relativePerformance = stockReturn - spyReturn;
                    let longSpyScore = 50 + (relativePerformance * 2);
                    longSpyScore = Math.max(0, Math.min(100, Math.round(longSpyScore)));

                    results.push({
                        symbol: stock.symbol,
                        name: stock.name,
                        currentPrice: stockData.close,
                        longSpyScore,
                        relativeStrength,
                        stockReturn,
                        spyReturn: spyData.return,
                        finalScore: 0,
                        finalSignal: ''
                    });
                    
                    processedCount++;
                    
                    if (processedCount % 50 === 0) {
                        console.log(`📈 Progress: ${processedCount}/${favoriteStocks.length} stocks processed`);
                    }

                } catch (stockError) {
                    console.error(`❌ Error processing ${stock.symbol}:`, stockError);
                    skippedCount++;
                }
            }

            console.log(`✅ BSpy completed:`, {
                totalStocks: favoriteStocks.length,
                processed: processedCount,
                skipped: skippedCount,
                results: results.length,
                successRate: `${Math.round((processedCount / favoriteStocks.length) * 100)}%`
            });
            return results;

        } catch (error) {
            console.error('❌ Error in BSpy:', error);
            throw error;
        }
    }

    static async runCAtrPrice(date: string, frequency: string, bResults: StockAnalysisResult[]): Promise<StockAnalysisResult[]> {
        console.log(`💰 Running REAL CAtrPrice for ${date} (${frequency})`);
        
        try {
            console.log(`🔍 CAtrPrice: Processing ${bResults.length} stocks from BSpy results...`);
            
            // Load local data for OHLC calculations
            console.log('🔍 Loading local data for ATR and Bollinger Bands calculations...');
            const localData = await this.loadLocalData();
            console.log(`✅ Local data loaded: ${Object.keys(localData).length} symbols available`);
            
            const results: StockAnalysisResult[] = [];
            let processedCount = 0;
            let skippedCount = 0;
            
            for (const stock of bResults) {
                try {
                    // Get historical data for ATR calculation (need 20+ days)
                    const historicalData = this.getHistoricalDataForSymbol(localData, stock.symbol, date, 30);
                    
                    if (historicalData.length < 20) {
                        console.warn(`⚠️ Insufficient data for ${stock.symbol}: ${historicalData.length} days (need 20+) - using default CAtrPrice values`);
                        // Add stock with default values instead of skipping
                        results.push({
                            ...stock,
                            longAtrPriceScore: 50, // Default neutral score
                            atrValue: 0,
                            atrRatio: 0,
                            bbWidth: 0,
                            bbPosition: 50
                        });
                        processedCount++;
                        continue;
                    }
                    
                    // Use CAtrPriceLogic for calculation
                    const result = await calculateLongAtrPriceScore(stock.symbol, stock.currentPrice, historicalData);
                    
                    console.log(`🎯 ${stock.symbol} CAtrPrice calculation:`, {
                        atrValue: result.atrRatio * stock.currentPrice / 100,
                        atrRatio: result.atrRatio,
                        bbWidth: result.bbWidth,
                        bbPosition: result.bbPosition,
                        longAtrPriceScore: result.score
                    });
                    
                    results.push({
                        ...stock,
                        longAtrPriceScore: result.score,
                        atrValue: result.atrRatio * stock.currentPrice / 100,
                        atrRatio: result.atrRatio,
                        bbWidth: result.bbWidth,
                        bbPosition: result.bbPosition
                    });
                    
                    processedCount++;
                    
                    if (processedCount % 50 === 0) {
                        console.log(`📈 CAtrPrice Progress: ${processedCount}/${bResults.length} stocks processed`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing ${stock.symbol} in CAtrPrice:`, error);
                    skippedCount++;
                }
            }
            
            console.log(`✅ CAtrPrice completed:`, {
                totalStocks: bResults.length,
                processed: processedCount,
                skipped: skippedCount,
                results: results.length,
                successRate: `${Math.round((processedCount / bResults.length) * 100)}%`
            });
            
            return results;
            
        } catch (error) {
            console.error('❌ Error in CAtrPrice:', error);
            throw error;
        }
    }

    static async runDSignals(date: string, frequency: string, bResults: StockAnalysisResult[]): Promise<StockAnalysisResult[]> {
        console.log(`📈 Running REAL DSignals for ${date} (${frequency})`);
        
        try {
            console.log(`🔍 DSignals: Processing ${bResults.length} stocks from BSpy results...`);
            
            // Load local data for OHLC calculations
            console.log('🔍 Loading local data for SMA and MACD calculations...');
            const localData = await this.loadLocalData();
            console.log(`✅ Local data loaded: ${Object.keys(localData).length} symbols available`);
            
            const results: StockAnalysisResult[] = [];
            let processedCount = 0;
            let skippedCount = 0;
            
            for (const stock of bResults) {
                try {
                    // Get historical data for SMA and MACD calculation (need 26+ days)
                    const historicalData = this.getHistoricalDataForSymbol(localData, stock.symbol, date, 30);
                    
                    if (historicalData.length < 26) {
                        console.warn(`⚠️ Insufficient data for ${stock.symbol}: ${historicalData.length} days (need 26+) - skipping DSignals calculation`);
                        // Add stock with default values instead of skipping
                        results.push({
                            ...stock,
                            longMomentumScore: 50, // Default neutral score
                            sma3Current: stock.currentPrice,
                            sma12Current: stock.currentPrice,
                            crossoverType: 'Neutral',
                            macdHistogram: 0
                        });
                        processedCount++;
                        continue;
                    }
                    
                    // Calculate SMA3 and SMA12
                    const sma3Values = this.calculateSMA(historicalData, 3);
                    const sma12Values = this.calculateSMA(historicalData, 12);
                    const macdData = this.calculateMACD(historicalData, 12, 26, 9);
                    
                    if (sma3Values.length < 2 || sma12Values.length < 2 || macdData.histogram.length < 1) {
                        console.warn(`⚠️ Not enough calculated data for ${stock.symbol}`);
                        skippedCount++;
                        continue;
                    }
                    
                    const sma3Current = sma3Values[sma3Values.length - 1];
                    const sma3Previous = sma3Values[sma3Values.length - 2];
                    const sma12Current = sma12Values[sma12Values.length - 1];
                    const sma12Previous = sma12Values[sma12Values.length - 2];
                    const macdHistogram = macdData.histogram[macdData.histogram.length - 1];
                    
                    // Determine crossover type
                    let crossoverType = 'Neutral';
                    if (sma3Current > sma12Current && sma3Previous <= sma12Previous) {
                        crossoverType = 'Bullish';
                    } else if (sma3Current < sma12Current && sma3Previous >= sma12Previous) {
                        crossoverType = 'Bearish';
                    }
                    
                    // Calculate momentum score
                    const longMomentumScore = this.calculateMomentumScore(sma3Current, sma12Current, macdHistogram, crossoverType);
                    
                    results.push({
                        ...stock,
                        longMomentumScore,
                        sma3Current,
                        sma12Current,
                        crossoverType,
                        macdHistogram
                    });
                    
                    processedCount++;
                    
                    if (processedCount % 50 === 0) {
                        console.log(`📈 DSignals Progress: ${processedCount}/${bResults.length} stocks processed`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing ${stock.symbol} in DSignals:`, error);
                    skippedCount++;
                }
            }
            
            console.log(`✅ DSignals completed:`, {
                totalStocks: bResults.length,
                processed: processedCount,
                skipped: skippedCount,
                results: results.length,
                successRate: `${Math.round((processedCount / bResults.length) * 100)}%`
            });
            
            return results;
            
        } catch (error) {
            console.error('❌ Error in DSignals:', error);
            throw error;
        }
    }

    static async runEAdx(date: string, frequency: string, bResults: StockAnalysisResult[]): Promise<StockAnalysisResult[]> {
        console.log(`🎯 Running REAL EAdx for ${date} (${frequency})`);
        
        try {
            console.log(`🔍 EAdx: Processing ${bResults.length} stocks from BSpy results...`);
            
            // Load local data for OHLC calculations
            console.log('🔍 Loading local data for ADX calculations...');
            const localData = await this.loadLocalData();
            console.log(`✅ Local data loaded: ${Object.keys(localData).length} symbols available`);
            
            const results: StockAnalysisResult[] = [];
            let processedCount = 0;
            let skippedCount = 0;
            
            for (const stock of bResults) {
                try {
                    // Get historical data for ADX calculation (need 20+ days)
                    const historicalData = this.getHistoricalDataForSymbol(localData, stock.symbol, date, 35);
                    
                    if (historicalData.length < 20) {
                        console.warn(`⚠️ Insufficient data for ${stock.symbol}: ${historicalData.length} days (need 20+) - using default EAdx values`);
                        // Add stock with default values instead of skipping
                        results.push({
                            ...stock,
                            longAdxScore: 50, // Default neutral score
                            adxValue: 0,
                            trendStrength: 'No Trend'
                        });
                        processedCount++;
                        continue;
                    }
                    
                    // Calculate ADX
                    const adxValue = this.calculateADX(historicalData, 14);
                    const trendStrength = this.getTrendStrength(adxValue);
                    const longAdxScore = this.calculateAdxScore(adxValue);
                    
                    results.push({
                        ...stock,
                        longAdxScore,
                        adxValue,
                        trendStrength
                    });
                    
                    processedCount++;
                    
                    if (processedCount % 50 === 0) {
                        console.log(`📈 EAdx Progress: ${processedCount}/${bResults.length} stocks processed`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing ${stock.symbol} in EAdx:`, error);
                    skippedCount++;
                }
            }
            
            console.log(`✅ EAdx completed:`, {
                totalStocks: bResults.length,
                processed: processedCount,
                skipped: skippedCount,
                results: results.length,
                successRate: `${Math.round((processedCount / bResults.length) * 100)}%`
            });
            
            return results;
            
        } catch (error) {
            console.error('❌ Error in EAdx:', error);
            throw error;
        }
    }

    static async calculateFinalScore(
        bResults: StockAnalysisResult[],
        cResults: StockAnalysisResult[],
        dResults: StockAnalysisResult[],
        eResults: StockAnalysisResult[]
    ): Promise<StockAnalysisResult[]> {
        console.log(`🏆 Calculating REAL Final Score`);
        
        // TODO: Call the actual final score calculation
        // This should:
        // 1. Combine all results
        // 2. Calculate weighted final score
        // 3. Return real results
        
        // For now, return mock data with delay to simulate real work
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        
        // Use BSpy results as the base since it's the starting point
        return bResults.map((bStock) => {
            // Find matching stocks by symbol instead of by index
            const cStock = cResults.find(c => c.symbol === bStock.symbol);
            const dStock = dResults.find(d => d.symbol === bStock.symbol);
            const eStock = eResults.find(e => e.symbol === bStock.symbol);

            console.log(`🔍 Calculating final score for ${bStock.symbol}:`, {
                bSpy: bStock.longSpyScore,
                cAtr: cStock?.longAtrPriceScore,
                dSignals: dStock?.longMomentumScore,
                eAdx: eStock?.longAdxScore
            });

            const finalScore = (
                (bStock.longSpyScore || 0) * 0.25 +
                (cStock?.longAtrPriceScore || 0) * 0.25 +
                (dStock?.longMomentumScore || 0) * 0.25 +
                (eStock?.longAdxScore || 0) * 0.25
            );

            let finalSignal = 'Neutral';
            if (finalScore >= 80) finalSignal = 'Strong Buy';
            else if (finalScore >= 60) finalSignal = 'Buy';
            else if (finalScore >= 40) finalSignal = 'Hold';
            else if (finalScore >= 20) finalSignal = 'Weak Sell';
            else finalSignal = 'Strong Sell';

            return {
                ...bStock,
                ...(cStock || {}),
                ...(dStock || {}),
                ...(eStock || {}),
                finalScore: Math.round(finalScore),
                finalSignal
            };
        });
    }

    static async addFuturePrices(stocks: StockAnalysisResult[], baseDate: string): Promise<StockAnalysisResult[]> {
        console.log(`📅 Adding REAL Future Prices for ${baseDate}`);
        
        // TODO: Call the actual future prices logic
        // This should:
        // 1. Fetch real OHLC data for next 5 days
        // 2. Calculate real prices
        // 3. Return real results
        
        // For now, return mock data with delay to simulate real work
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        
        const futureDates = DateUtils.getNext5TradingDays(baseDate);
        
        return Promise.all(stocks.map(async (stock) => {
            const prices: { [key: string]: DayPrice } = {};
            
            for (let i = 0; i < 5; i++) {
                const futureDate = futureDates[i];
                if (futureDate) {
                    // This would fetch actual OHLC data
                    prices[`day_${i + 1}`] = {
                        date: futureDate,
                        open: stock.currentPrice * (0.95 + Math.random() * 0.1),
                        high: stock.currentPrice * (1 + Math.random() * 0.1),
                        low: stock.currentPrice * (0.9 + Math.random() * 0.1),
                        price: stock.currentPrice * (0.95 + Math.random() * 0.1),
                        volume: Math.floor(Math.random() * 1000000)
                    };
                }
            }

            return {
                ...stock,
                prices
            };
        }));
    }

    static calculateAverageFinalScore(stocks: StockAnalysisResult[]): number {
        if (stocks.length === 0) return 0;
        const total = stocks.reduce((sum, stock) => sum + stock.finalScore, 0);
        return Math.round(total / stocks.length);
    }

    // Load local stock data and create index for fast lookup
    static async loadLocalData(): Promise<{ [symbol: string]: { [date: string]: any } }> {
        console.log('📊 Loading local stock data from daily files...');
        
        // Create index for fast lookup: {symbol: {date: data}}
        const dataIndex: { [symbol: string]: { [date: string]: any } } = {};
        
        try {
            // קבלת רשימת התאריכים הזמינים מ-localStorage
            const availableDatesStr = localStorage.getItem('availableTradingDates');
            if (!availableDatesStr) {
                console.error('❌ No available dates found in localStorage');
                return dataIndex;
            }
            
            const availableDates = JSON.parse(availableDatesStr);
            console.log(`📅 Loading data for ${availableDates.length} available dates`);
            
            // טעינת כל הקבצים היומיים
            const allData: any[] = [];
            let loadedFiles = 0;
            
            for (const date of availableDates) {
                try {
                    const [year, month, day] = date.split('-');
                    const fileName = `${day}.${month}.${year}.json`;
                    const timestamp = new Date().getTime();
                    const response = await fetch(`/src/Stocks/data/${fileName}?t=${timestamp}`);
                    
                    if (response.ok) {
                        const fileData = await response.json();
                        if (fileData && fileData.records) {
                            allData.push(...fileData.records);
                            loadedFiles++;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load ${date}:`, error);
                }
            }
            
            console.log(`✅ Loaded ${loadedFiles} daily files with ${allData.length} total records`);
            
            // יצירת אינדקס מהיר
            allData.forEach((record: any) => {
                if (record.symbol && record.date) {
                    if (!dataIndex[record.symbol]) {
                        dataIndex[record.symbol] = {};
                    }
                    dataIndex[record.symbol][record.date] = record;
                }
            });
            
        } catch (error) {
            console.error('❌ Error loading local data:', error);
        }
        
        console.log(`✅ Loaded local data for ${Object.keys(dataIndex).length} symbols`);
        return dataIndex;
    }

    // Load favorite stocks from Firebase
    static async loadFavoriteStocks(): Promise<any[]> {
        try {
            console.log('🔍 Loading favorite stocks from Firebase...');
            const querySnapshot = await getDocs(query(collection(db, 'favorite')));
            
            let foundStocks: any[] = [];
            querySnapshot.forEach((doc) => {
                if (doc.id === 'my-favorites') {
                    const data = doc.data();
                    if (data.stocks && Array.isArray(data.stocks)) {
                        foundStocks = data.stocks;
                    }
                }
            });
            
            console.log(`✅ Found ${foundStocks.length} favorite stocks`);
            return foundStocks;
            
        } catch (error) {
            console.error('❌ Error loading favorite stocks:', error);
            throw error;
        }
    }

    // Get SPY data for a specific date
    static async getSPYData(date: string): Promise<{ currentPrice: number; previousPrice: number; return: number } | null> {
        try {
            console.log(`📊 Fetching SPY data for ${date}...`);
            
            const localData = await this.loadLocalData();
            const previousDate = DateUtils.getPreviousTradingDay(date);
            
            const spyCurrentData = localData['SPY']?.[date];
            const spyPreviousData = localData['SPY']?.[previousDate];
            
            if (!spyCurrentData || !spyPreviousData) {
                throw new Error(`No SPY data for ${date} or ${previousDate}`);
            }
            
            const currentPrice = spyCurrentData.close;
            const previousPrice = spyPreviousData.close;
            const spyReturn = ((currentPrice - previousPrice) / previousPrice) * 100;
            
            return {
                currentPrice,
                previousPrice,
                return: spyReturn
            };
            
        } catch (error) {
            console.error('❌ Error fetching SPY data:', error);
            throw error;
        }
    }

    // Helper function to get historical data for a symbol
    static getHistoricalDataForSymbol(localData: { [symbol: string]: { [date: string]: any } }, symbol: string, targetDate: string, days: number): any[] {
        const results: any[] = [];
        let currentDate = new Date(targetDate);
        let tradingDaysFound = 0;
        
        // Go back until we find enough trading days
        while (tradingDaysFound < days && currentDate >= new Date('2024-11-01')) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const data = localData[symbol]?.[dateStr];
            
            if (data) {
                results.unshift(data); // Add to beginning to maintain chronological order
                tradingDaysFound++;
            }
            
            // Go back one day
            currentDate.setDate(currentDate.getDate() - 1);
        }
        
        console.log(`📊 Found ${tradingDaysFound} trading days for ${symbol} (requested ${days})`);
        return results;
    }

    // Calculate ATR (Average True Range)
    static calculateATR(historicalData: any[], period: number): number {
        if (historicalData.length < period + 1) {
            return 0;
        }

        const trueRanges: number[] = [];
        
        for (let i = 1; i < historicalData.length; i++) {
            const current = historicalData[i];
            const previous = historicalData[i - 1];
            
            const high = current.high;
            const low = current.low;
            const previousClose = previous.close;
            
            const tr1 = high - low;
            const tr2 = Math.abs(high - previousClose);
            const tr3 = Math.abs(low - previousClose);
            
            const trueRange = Math.max(tr1, tr2, tr3);
            trueRanges.push(trueRange);
        }
        
        // Calculate ATR as simple moving average of true ranges
        const atrValues = trueRanges.slice(-period);
        return atrValues.reduce((sum, tr) => sum + tr, 0) / atrValues.length;
    }

    // Calculate Bollinger Bands
    static calculateBollingerBands(historicalData: any[], period: number, stdDev: number): { bbWidth: number; bbPosition: number } {
        if (historicalData.length < period) {
            return { bbWidth: 0, bbPosition: 0 };
        }

        const closes = historicalData.slice(-period).map(d => d.close);
        const sma = closes.reduce((sum, close) => sum + close, 0) / closes.length;
        
        const variance = closes.reduce((sum, close) => sum + Math.pow(close - sma, 2), 0) / closes.length;
        const standardDeviation = Math.sqrt(variance);
        
        const upperBand = sma + (standardDeviation * stdDev);
        const lowerBand = sma - (standardDeviation * stdDev);
        const bbWidth = ((upperBand - lowerBand) / sma) * 100;
        
        const currentPrice = historicalData[historicalData.length - 1].close;
        const bbPosition = ((currentPrice - lowerBand) / (upperBand - lowerBand)) * 100;
        
        return { bbWidth, bbPosition };
    }

    // Calculate ATR Price Score (same logic as CAtrPrice component)
    static calculateAtrPriceScore(atrRatio: number, bbPosition: number, bbWidth?: number): number {
        // ATR ratio scoring (lower is better for volatility)
        let atrScore = 100;
        if (atrRatio > 5) atrScore = 20;
        else if (atrRatio > 3) atrScore = 40;
        else if (atrRatio > 2) atrScore = 60;
        else if (atrRatio > 1) atrScore = 80;
        
        // Bollinger Bands width scoring (lower is better for volatility)
        let bbWidthScore = 100;
        if (bbWidth !== undefined) {
            if (bbWidth > 8) bbWidthScore = 20;
            else if (bbWidth > 6) bbWidthScore = 40;
            else if (bbWidth > 4) bbWidthScore = 60;
            else if (bbWidth > 2) bbWidthScore = 80;
        } else {
            bbWidthScore = 50; // Default if not provided
        }
        
        // Bollinger Bands position scoring (optimal range for long)
        let bbPositionScore = 0;
        if (bbPosition >= 0.2 && bbPosition <= 0.3) {
            bbPositionScore = 90; // מעולה ללונג - מחיר נמוך ברצועות
        } else if (bbPosition < 0.2) {
            bbPositionScore = 85; // מצוין ללונג - Oversold
        } else if (bbPosition >= 0.3 && bbPosition < 0.4) {
            bbPositionScore = 75; // טוב ללונג
        } else if (bbPosition >= 0.4 && bbPosition <= 0.6) {
            bbPositionScore = 50; // ניטרלי
        } else if (bbPosition > 0.6 && bbPosition <= 0.7) {
            bbPositionScore = 30; // פחות טוב ללונג
        } else if (bbPosition > 0.7) {
            bbPositionScore = 20; // לא טוב ללונג - Overbought
        }
        
        // Weighted score like CAtrPrice component
        const finalScore = Math.round(
            (atrScore * 0.4) + (bbWidthScore * 0.3) + (bbPositionScore * 0.3)
        );
        
        return Math.max(1, Math.min(100, finalScore));
    }

    // Calculate SMA (Simple Moving Average)
    static calculateSMA(historicalData: any[], period: number): number[] {
        const smaValues: number[] = [];
        
        for (let i = period - 1; i < historicalData.length; i++) {
            const closes = historicalData.slice(i - period + 1, i + 1).map(d => d.close);
            const sma = closes.reduce((sum, close) => sum + close, 0) / closes.length;
            smaValues.push(sma);
        }
        
        return smaValues;
    }

    // Calculate MACD
    static calculateMACD(historicalData: any[], fastPeriod: number, slowPeriod: number, signalPeriod: number): { macd: number[], signal: number[], histogram: number[] } {
        const closes = historicalData.map(d => d.close);
        
        // Calculate EMAs
        const fastEMA = this.calculateEMA(closes, fastPeriod);
        const slowEMA = this.calculateEMA(closes, slowPeriod);
        
        // Calculate MACD line
        const macd = fastEMA.map((fast, i) => fast - slowEMA[i]);
        
        // Calculate signal line (EMA of MACD)
        const signal = this.calculateEMA(macd, signalPeriod);
        
        // Calculate histogram
        const histogram = macd.map((macdVal, i) => macdVal - signal[i]);
        
        return { macd, signal, histogram };
    }

    // Calculate EMA (Exponential Moving Average)
    static calculateEMA(data: number[], period: number): number[] {
        const ema: number[] = [];
        const multiplier = 2 / (period + 1);
        
        // First value is SMA
        const firstSMA = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
        ema.push(firstSMA);
        
        // Calculate EMA for remaining values
        for (let i = period; i < data.length; i++) {
            const emaValue = (data[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
            ema.push(emaValue);
        }
        
        return ema;
    }

    // Calculate Momentum Score
    static calculateMomentumScore(sma3: number, sma12: number, macdHistogram: number, crossoverType: string): number {
        let score = 50; // Base score
        
        // SMA crossover scoring
        if (crossoverType === 'Bullish') {
            score += 30;
        } else if (crossoverType === 'Bearish') {
            score -= 30;
        }
        
        // SMA position scoring
        const smaRatio = sma3 / sma12;
        if (smaRatio > 1.02) score += 20; // Strong bullish
        else if (smaRatio > 1.01) score += 10; // Mild bullish
        else if (smaRatio < 0.98) score -= 20; // Strong bearish
        else if (smaRatio < 0.99) score -= 10; // Mild bearish
        
        // MACD histogram scoring
        if (macdHistogram > 0.1) score += 15; // Strong positive momentum
        else if (macdHistogram > 0.05) score += 10; // Positive momentum
        else if (macdHistogram < -0.1) score -= 15; // Strong negative momentum
        else if (macdHistogram < -0.05) score -= 10; // Negative momentum
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    // Calculate ADX (Average Directional Index)
    static calculateADX(historicalData: any[], period: number): number {
        if (historicalData.length < period + 1) {
            return 0;
        }

        const trueRanges: number[] = [];
        const plusDMs: number[] = [];
        const minusDMs: number[] = [];

        // Calculate True Range, +DM, and -DM
        for (let i = 1; i < historicalData.length; i++) {
            const current = historicalData[i];
            const previous = historicalData[i - 1];
            
            const high = current.high;
            const low = current.low;
            const prevHigh = previous.high;
            const prevLow = previous.low;
            const prevClose = previous.close;
            
            // True Range
            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);
            const trueRange = Math.max(tr1, tr2, tr3);
            trueRanges.push(trueRange);
            
            // Directional Movement
            const highDiff = high - prevHigh;
            const lowDiff = prevLow - low;
            
            let plusDM = 0;
            let minusDM = 0;
            
            if (highDiff > lowDiff && highDiff > 0) {
                plusDM = highDiff;
            }
            if (lowDiff > highDiff && lowDiff > 0) {
                minusDM = lowDiff;
            }
            
            plusDMs.push(plusDM);
            minusDMs.push(minusDM);
        }

        // Calculate smoothed values
        const smoothedTR = this.calculateSmoothedValues(trueRanges, period);
        const smoothedPlusDM = this.calculateSmoothedValues(plusDMs, period);
        const smoothedMinusDM = this.calculateSmoothedValues(minusDMs, period);

        // Calculate +DI and -DI
        const plusDI = smoothedPlusDM.map((dm, i) => (dm / smoothedTR[i]) * 100);
        const minusDI = smoothedMinusDM.map((dm, i) => (dm / smoothedTR[i]) * 100);

        // Calculate DX
        const dx = plusDI.map((plus, i) => {
            const minus = minusDI[i];
            const sum = plus + minus;
            if (sum === 0) return 0;
            return Math.abs(plus - minus) / sum * 100;
        });

        // Calculate ADX as smoothed DX
        const adxValues = this.calculateSmoothedValues(dx, period);
        
        return adxValues[adxValues.length - 1] || 0;
    }

    // Calculate smoothed values (Wilder's smoothing)
    static calculateSmoothedValues(values: number[], period: number): number[] {
        const smoothed: number[] = [];
        
        // First value is sum of first period values
        const firstSum = values.slice(0, period).reduce((sum, val) => sum + val, 0);
        smoothed.push(firstSum);
        
        // Subsequent values use Wilder's smoothing
        for (let i = period; i < values.length; i++) {
            const smoothedValue = smoothed[smoothed.length - 1] - (smoothed[smoothed.length - 1] / period) + values[i];
            smoothed.push(smoothedValue);
        }
        
        return smoothed;
    }

    // Get trend strength based on ADX value
    static getTrendStrength(adxValue: number): string {
        if (adxValue >= 50) return 'Very Strong';
        if (adxValue >= 25) return 'Strong';
        if (adxValue >= 20) return 'Weak';
        return 'No Trend';
    }

    // Calculate ADX Score
    static calculateAdxScore(adxValue: number): number {
        if (adxValue >= 50) return 100; // Very strong trend
        if (adxValue >= 40) return 80;  // Strong trend
        if (adxValue >= 30) return 60;  // Moderate trend
        if (adxValue >= 20) return 40;  // Weak trend
        return 20; // No trend
    }

    // פונקציה חדשה להרצת התהליך המלא עם AnalysisOrchestrator
    static async runFullAnalysisWithOrchestrator(
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<AnalysisResult> {
        console.log(`🚀 Starting full analysis with orchestrator for ${targetDate}`);
        
        try {
            // קבלת מניות מועדפות
            const favoriteStocks = await AnalysisEngine.loadFavoriteStocks();
            if (favoriteStocks.length === 0) {
                throw new Error('No favorite stocks found');
            }
            
            // יצירת אורקסטרטור
            const orchestrator = new AnalysisOrchestrator();
            
            // הרצת התהליך המלא
            const result = await orchestrator.runFullAnalysis(favoriteStocks, targetDate, onProgress);
            
            return {
                date: result.date,
                frequency: result.frequency,
                stocks: result.stocks.map(stock => ({
                    ...stock,
                    finalScore: stock.finalScore || 50, // ציון ברירת מחדל
                    finalSignal: 'BUY' // הוספת signal ברירת מחדל
                })),
                totalStocks: result.totalStocks,
                analysisTime: result.analysisTime.toString(),
                finalScore: Math.round(result.stocks.reduce((sum, stock) => sum + (stock.finalScore || 50), 0) / result.stocks.length)
            };
            
        } catch (error) {
            console.error('❌ Error in full analysis with orchestrator:', error);
            throw error;
        }
    }
}
