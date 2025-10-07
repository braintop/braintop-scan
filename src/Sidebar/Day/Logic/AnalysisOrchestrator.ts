// Analysis Orchestrator - אורקסטרטור מרכזי לכל התהליכים
import * as BSpyLogic from './BSpyLogic';
import * as CAtrPriceLogic from './CAtrPriceLogic';
import * as DSignalsLogic from './DSignalsLogic';
import * as EAdxLogic from './EAdxLogic';
import * as FSupportResistLogic from './FSupportResistLogic';
import * as BSpyTypes from '../Types/BSpyTypes';
import * as CAtrPriceTypes from '../Types/CAtrPriceTypes';
import * as DSignalsTypes from '../Types/DSignalsTypes';
import * as DTCandlesTypes from '../Types/DTCandlesTypes';
import * as EAdxTypes from '../Types/EAdxTypes';
import * as MarketStructureTypes from '../Types/MarketStructureTypes';

export interface AnalysisOrchestratorResult {
    date: string;
    frequency: string;
    stocks: StockAnalysisResult[];
    totalStocks: number;
    processedStocks: number;
    skippedStocks: number;
    analysisTime: number;
    calculationDate: string;
}

export interface StockAnalysisResult {
    symbol: string;
    name: string;
    currentPrice: number;
    
    // BSpy Results
    previousPrice?: number;
    stockReturn?: number;
    spyReturn?: number;
    relativeStrength?: number;
    LongSpyScore?: number;
    
    // CAtrPrice Results
    longAtrPriceScore?: number;
    atrValue?: number;
    atrRatio?: number;
    bbWidth?: number;
    bbPosition?: number;
    
    // DSignals Results
    sma3Current?: number;
    sma3Previous?: number;
    sma12Current?: number;
    sma12Previous?: number;
    crossoverType?: 'Bullish' | 'Bearish' | 'None';
    macdHistogram?: number;
    LongMomentumScore?: number;
    
    // DTCandles Results
    candleScore?: number;
    detectedPatterns?: DTCandlesTypes.CandlePattern[];
    
    // EAdx Results
    adxValue?: number;
    LongAdxScore?: number;
    trendStrength?: 'No Trend' | 'Weak Trend' | 'Strong Trend' | 'Very Strong' | 'Extreme';
    
    // FSupportResist Results
    marketStructure?: MarketStructureTypes.MarketStructureResult;
    
    // Final Results
    finalScore?: number;
    analysisDate: string;
    calculationDate: string;
}

export class AnalysisOrchestrator {
    private localData: any = null;
    private dataIndex: any = null;
    private dataSource: 'local' | 'api' = 'local';
    // availableDates removed - using single file now

    constructor(filePath?: string) {
        if (filePath) {
            this.loadLocalDataFromPath(filePath);
        } else {
            this.loadLocalData();
        }
    }

    // Method to wait for data loading to complete
    async waitForDataLoading(): Promise<void> {
        // Wait for data to be loaded
        while (!this.localData || !this.dataIndex) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Method to get loaded data
    getLocalData(): any {
        return this.localData;
    }

    // Method to get data index
    getDataIndex(): any {
        return this.dataIndex;
    }

    private async loadLocalDataFromPath(filePath: string) {
        try {
            console.log(`📁 Loading local data from path: ${filePath}`);
            
            // טעינת הקובץ מהנתיב הנתון
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load local data: ${response.status}`);
            }
            this.localData = await response.json();
            
            this.buildDataIndex();
        } catch (error) {
            console.error('❌ Error loading local data from path:', error);
            throw error;
        }
    }

    private buildDataIndex() {
        // יצירת אינדקס מהיר
        const index: any = {};
        this.localData.data.forEach((item: any) => {
            if (!index[item.symbol]) {
                index[item.symbol] = {};
            }
            index[item.symbol][item.date] = item;
        });
        this.dataIndex = index;
        
        console.log('📊 Data index built:', {
            symbols: Object.keys(index).length,
            sampleSymbol: Object.keys(index)[0],
            sampleDate: Object.keys(index[Object.keys(index)[0]])[0]
        });
    }

    private async loadLocalData() {
        try {
            console.log('📁 Loading local data for AnalysisOrchestrator from single file...');
            
            // טעינת הקובץ הגדול עם dynamic import
            const timestamp = new Date().getTime();
            const localDataModule = await import(/* @vite-ignore */ `../../../Stocks/Util/local_stock_data.json?t=${timestamp}`);
            this.localData = localDataModule.default;
            
            console.log('📊 Raw local data loaded:', {
                hasData: !!this.localData.data,
                dataLength: this.localData.data?.length,
                metadata: this.localData.metadata
            });
            
            // יצירת אינדקס מהיר
            const index: any = {};
            this.localData.data.forEach((item: any) => {
                if (!index[item.symbol]) {
                    index[item.symbol] = {};
                }
                index[item.symbol][item.date] = item;
            });
            
            this.dataIndex = index;
            this.dataSource = 'local';
            
            console.log('✅ Local data loaded and indexed for AnalysisOrchestrator:', {
                symbols: this.localData.metadata.symbols.length,
                records: this.localData.metadata.totalRecords,
                indexedSymbols: Object.keys(index).length,
                sampleSymbol: Object.keys(index)[0],
                sampleDates: Object.keys(index[Object.keys(index)[0]] || {}).slice(0, 5)
            });
            
        } catch (error) {
            console.error('❌ Error loading local data:', error);
            this.dataSource = 'api';
        }
    }
    

    // הרצת תהליך BSpy
    async runBSpy(
        favoriteStocks: BSpyTypes.FavoriteStock[],
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<BSpyTypes.RelativeStrengthResult[]> {
        console.log(`🚀 Starting BSpy analysis for ${favoriteStocks.length} stocks on ${targetDate}`);
        
        // בדיקה שהנתונים נטענו
        if (!this.dataIndex || !this.localData) {
            console.log('⏳ Waiting for local data to load...');
            // טעינת הנתונים אם הם לא נטענו
            await this.loadLocalData();
            
            // המתנה קצרה לוודא שהטעינה הושלמה
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!this.dataIndex || !this.localData) {
                throw new Error('Local data not loaded. Please refresh the page and try again.');
            }
        }
        
        // Data loaded and ready for analysis
        
        onProgress?.(0, 'Starting BSpy analysis...');
        
        // קבלת נתוני SPY
        const spyData = await BSpyLogic.getSPYData(targetDate, this.dataSource, this.localData, this.dataIndex);
        
        if (!spyData) {
            throw new Error('Failed to get SPY data');
        }
        
        onProgress?.(10, 'SPY data loaded, processing stocks...');
        
        const results: BSpyTypes.RelativeStrengthResult[] = [];
        const totalStocks = favoriteStocks.length;
        
        console.log(`📊 BSpy - Processing ${totalStocks} stocks...`);
        
        for (let i = 0; i < totalStocks; i++) {
            const stock = favoriteStocks[i];
            const progress = 10 + (i / totalStocks) * 80;
            onProgress?.(progress, `Processing ${stock.symbol} (${i + 1}/${totalStocks})`);
            
            console.log(`📊 BSpy - Processing stock ${i + 1}/${totalStocks}: ${stock.symbol}`);
            
            const result = await BSpyLogic.calculateBSpyForStock(
                stock,
                targetDate,
                spyData,
                this.dataSource,
                this.localData,
                this.dataIndex
            );
            
            if (result) {
                results.push(result);
                console.log(`✅ BSpy - ${stock.symbol} processed successfully`);
            } else {
                console.warn(`⚠️ BSpy - ${stock.symbol} failed to process`);
            }
        }
        
        onProgress?.(100, `BSpy analysis completed: ${results.length} stocks processed`);
        console.log(`✅ BSpy analysis completed: ${results.length}/${totalStocks} stocks processed`);
        
        return results;
    }

    // הרצת תהליך CAtrPrice
    async runCAtrPrice(
        bSpyResults: BSpyTypes.RelativeStrengthResult[],
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<CAtrPriceTypes.VolatilityResult[]> {
        console.log(`🚀 Starting CAtrPrice analysis for ${bSpyResults.length} stocks on ${targetDate}`);
        
        onProgress?.(0, 'Starting CAtrPrice analysis...');
        
        const results: CAtrPriceTypes.VolatilityResult[] = [];
        const totalStocks = bSpyResults.length;
        
        for (let i = 0; i < totalStocks; i++) {
            const stock = bSpyResults[i];
            const progress = (i / totalStocks) * 100;
            onProgress?.(progress, `Processing ${stock.symbol} (${i + 1}/${totalStocks})`);
            
            // קבלת נתונים היסטוריים
            let historicalData: any[] = [];
            
            if (this.dataSource === 'local' && this.dataIndex) {
                const localData = BSpyLogic.getLocalHistoricalData(this.dataIndex, stock.symbol, targetDate, 30);
                console.log(`📊 CAtrPrice - Local data for ${stock.symbol}:`, {
                    found: localData.length,
                    needed: 20,
                    hasEnough: localData.length >= 20
                });
                
                // המרה מפורמט localData ל-OHLC
                historicalData = localData.map((item: any) => ({
                    h: item.high,
                    l: item.low,
                    c: item.close,
                    o: item.open
                }));
                
                console.log(`📊 CAtrPrice - Converted OHLC data for ${stock.symbol}:`, {
                    length: historicalData.length,
                    firstItem: historicalData[0],
                    lastItem: historicalData[historicalData.length - 1]
                });
            } else {
                // שימוש בנתונים מקומיים בלבד
                console.log(`📁 CAtrPrice - Using local data for ${stock.symbol}`);
                
                if (!this.dataIndex[stock.symbol]) {
                    console.warn(`⚠️ No local data index for ${stock.symbol}`);
                    results.push({
                        symbol: stock.symbol,
                        name: stock.name,
                        currentPrice: stock.currentPrice,
                        atr: 0,
                        atrRatio: 0,
                        bbWidth: 0,
                        bbPosition: 0,
                        LongAtrPriceScore: 50,
                        analysisDate: targetDate,
                        calculationDate: new Date().toISOString().split('T')[0]
                    });
                    continue;
                }
                
                // קבלת נתונים היסטוריים מהאינדקס המקומי
                const availableDates = Object.keys(this.dataIndex[stock.symbol]).sort();
                const endDateObj = new Date(targetDate);
                
                // מציאת התאריך הקרוב ביותר לתאריך המטרה
                let closestDate = null;
                let closestIndex = -1;
                
                for (let i = availableDates.length - 1; i >= 0; i--) {
                    const dateObj = new Date(availableDates[i]);
                    if (dateObj <= endDateObj) {
                        closestDate = availableDates[i];
                        closestIndex = i;
                        break;
                    }
                }
                
                if (!closestDate || closestIndex === -1) {
                    console.warn(`⚠️ No local data found for ${stock.symbol} on or before ${targetDate}`);
                    results.push({
                        symbol: stock.symbol,
                        name: stock.name,
                        currentPrice: stock.currentPrice,
                        atr: 0,
                        atrRatio: 0,
                        bbWidth: 0,
                        bbPosition: 0,
                        LongAtrPriceScore: 50,
                        analysisDate: targetDate,
                        calculationDate: new Date().toISOString().split('T')[0]
                    });
                    continue;
                }
                
                // קבלת 30 הימים האחרונים
                const startIndex = Math.max(0, closestIndex - 29);
                const endIndex = closestIndex + 1;
                const recentDates = availableDates.slice(startIndex, endIndex);
                
                historicalData = recentDates.map(date => {
                    const data = this.dataIndex[stock.symbol][date];
                    return {
                        h: data.high,
                        l: data.low,
                        c: data.close,
                        o: data.open
                    };
                });
                
                console.log(`📊 CAtrPrice - Local historical data for ${stock.symbol}:`, {
                    length: historicalData.length,
                    dateRange: `${recentDates[0]} to ${recentDates[recentDates.length - 1]}`,
                    firstItem: historicalData[0],
                    lastItem: historicalData[historicalData.length - 1]
                });
            }
            
            if (historicalData.length < 20) {
                console.warn(`⚠️ Insufficient data for ${stock.symbol}: ${historicalData.length} days`);
                results.push({
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.currentPrice,
                    atr: 0,
                    atrRatio: 0,
                    bbWidth: 0,
                    bbPosition: 0,
                    LongAtrPriceScore: 50,
                    analysisDate: targetDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                });
                continue;
            }
            
            const result = await CAtrPriceLogic.calculateLongAtrPriceScore(
                stock.symbol,
                stock.currentPrice,
                historicalData
            );
            
            results.push({
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.currentPrice,
                atr: result.atrRatio * stock.currentPrice / 100,
                atrRatio: result.atrRatio,
                bbWidth: result.bbWidth,
                bbPosition: result.bbPosition,
                LongAtrPriceScore: result.score,
                analysisDate: targetDate,
                calculationDate: new Date().toISOString().split('T')[0]
            });
        }
        
        onProgress?.(100, `CAtrPrice analysis completed: ${results.length} stocks processed`);
        console.log(`✅ CAtrPrice analysis completed: ${results.length}/${totalStocks} stocks processed`);
        
        return results;
    }

    // הרצת תהליך DSignals
    async runDSignals(
        cAtrPriceResults: CAtrPriceTypes.VolatilityResult[],
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<DSignalsTypes.MomentumResult[]> {
        console.log(`🚀 Starting DSignals analysis for ${cAtrPriceResults.length} stocks on ${targetDate}`);
        
        onProgress?.(0, 'Starting DSignals analysis...');
        
        const results: DSignalsTypes.MomentumResult[] = [];
        const totalStocks = cAtrPriceResults.length;
        
        for (let i = 0; i < totalStocks; i++) {
            const stock = cAtrPriceResults[i];
            const progress = (i / totalStocks) * 100;
            onProgress?.(progress, `Processing ${stock.symbol} (${i + 1}/${totalStocks})`);
            
            const favoriteStock: DSignalsTypes.FavoriteStock = {
                candleDate: targetDate,
                scanDate: targetDate,
                symbol: stock.symbol,
                name: stock.name,
                price: stock.currentPrice,
                market: 'NASDAQ',
                volume: 0,
                dollarVolume: 0,
                float: 0,
                spread: 0,
                passed: true
            };
            
            const result = await DSignalsLogic.calculateDSignalsForStock(
                favoriteStock,
                targetDate,
                this.dataSource,
                this.localData,
                this.dataIndex
            );
            
            if (result) {
                results.push(result);
            }
        }
        
        onProgress?.(100, `DSignals analysis completed: ${results.length} stocks processed`);
        console.log(`✅ DSignals analysis completed: ${results.length}/${totalStocks} stocks processed`);
        
        return results;
    }

    // הרצת תהליך DTCandles
    async runDTCandles(
        dSignalsResults: DSignalsTypes.MomentumResult[],
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<DTCandlesTypes.CandleResult[]> {
        console.log(`🚀 Starting DTCandles analysis for ${dSignalsResults.length} stocks on ${targetDate}`);
        
        onProgress?.(0, 'Starting DTCandles analysis...');
        
        const results: DTCandlesTypes.CandleResult[] = [];
        const totalStocks = dSignalsResults.length;
        
        for (let i = 0; i < totalStocks; i++) {
            const stock = dSignalsResults[i];
            const progress = (i / totalStocks) * 100;
            onProgress?.(progress, `Processing ${stock.symbol} (${i + 1}/${totalStocks})`);
            
            try {
                console.log(`🕯️ Processing DTCandles for ${i + 1}/${totalStocks}: ${stock.symbol}`);
                
                // קבלת נתונים היסטוריים
                const historicalData = BSpyLogic.getLocalHistoricalData(this.dataIndex, stock.symbol, targetDate, 10);
                if (historicalData.length < 3) {
                    console.warn(`⚠️ Not enough data for candle analysis: ${stock.symbol}`);
                    continue;
                }

                // ניתוח נרות (פשטות - רק Hammer ו-Bullish Engulfing)
                let candleScore = 0;
                const detectedPatterns: DTCandlesTypes.CandlePattern[] = [];
                
                const currentCandle = historicalData[historicalData.length - 1];
                const prevCandle = historicalData[historicalData.length - 2];
                
                // בדיקת Hammer - דורש ירידה
                if ((stock.crossoverType === 'Bearish' || stock.LongMomentumScore < 40) && 
                    this.detectHammer(currentCandle)) {
                    candleScore += 25;
                    detectedPatterns.push('Hammer');
                }

                // בדיקת Bullish Engulfing - דורש עלייה
                if ((stock.crossoverType === 'Bullish' || stock.LongMomentumScore > 60) && 
                    this.detectBullishEngulfing(prevCandle, currentCandle)) {
                    candleScore += 25;
                    detectedPatterns.push('Bullish Engulfing');
                }

                const result: DTCandlesTypes.CandleResult = {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.currentPrice,
                    candleScore: Math.min(candleScore, 100),
                    detectedPatterns,
                    analysisDate: targetDate,
                    calculationDate: new Date().toISOString().split('T')[0]
                };

                results.push(result);
                
                console.log(`✅ ${stock.symbol} candle analysis completed:`, {
                    score: result.candleScore,
                    patterns: result.detectedPatterns
                });

            } catch (error) {
                console.error(`❌ Error processing DTCandles for ${stock.symbol}:`, error);
            }
        }
        
        onProgress?.(100, `DTCandles analysis completed: ${results.length} stocks processed`);
        console.log(`✅ DTCandles analysis completed: ${results.length}/${totalStocks} stocks processed`);
        
        return results;
    }

    // זיהוי Hammer
    private detectHammer(candle: any): boolean {
        const body = Math.abs(candle.close - candle.open);
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        const upperShadow = candle.high - Math.max(candle.open, candle.close);
        const totalRange = candle.high - candle.low;
        
        const smallBody = body <= totalRange * 0.3;
        const longLowerShadow = lowerShadow >= body * 2;
        const shortUpperShadow = upperShadow <= body * 0.5;
        const closesNearHigh = candle.close >= candle.low + (totalRange * 0.8);
        
        return smallBody && longLowerShadow && shortUpperShadow && closesNearHigh;
    }

    // זיהוי Bullish Engulfing
    private detectBullishEngulfing(prevCandle: any, currentCandle: any): boolean {
        const prevIsRed = prevCandle.close < prevCandle.open;
        const currentIsGreen = currentCandle.close > currentCandle.open;
        const engulfs = currentCandle.open < prevCandle.close && 
                       currentCandle.close > prevCandle.open;
        
        const greenBody = currentCandle.close - currentCandle.open;
        const redBody = prevCandle.open - prevCandle.close;
        const largerBody = greenBody > redBody;
        
        return prevIsRed && currentIsGreen && engulfs && largerBody;
    }

    // הרצת תהליך EAdx
    async runEAdx(
        dSignalsResults: DSignalsTypes.MomentumResult[],
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<EAdxTypes.TrendResult[]> {
        console.log(`🚀 Starting EAdx analysis for ${dSignalsResults.length} stocks on ${targetDate}`);
        
        onProgress?.(0, 'Starting EAdx analysis...');
        
        const results: EAdxTypes.TrendResult[] = [];
        const totalStocks = dSignalsResults.length;
        
        for (let i = 0; i < totalStocks; i++) {
            const stock = dSignalsResults[i];
            const progress = (i / totalStocks) * 100;
            onProgress?.(progress, `Processing ${stock.symbol} (${i + 1}/${totalStocks})`);
            
            const favoriteStock: EAdxTypes.FavoriteStock = {
                candleDate: targetDate,
                scanDate: targetDate,
                symbol: stock.symbol,
                name: stock.name,
                price: stock.currentPrice,
                market: 'NASDAQ',
                volume: 0,
                dollarVolume: 0,
                float: 0,
                spread: 0,
                passed: true
            };
            
            const result = await EAdxLogic.calculateEAdxForStock(
                favoriteStock,
                targetDate,
                this.dataSource,
                this.localData,
                this.dataIndex
            );
            
            if (result) {
                results.push(result);
            }
        }
        
        onProgress?.(100, `EAdx analysis completed: ${results.length} stocks processed`);
        console.log(`✅ EAdx analysis completed: ${results.length}/${totalStocks} stocks processed`);
        
        return results;
    }

    // הרצת תהליך FSupportResist
    async runFSupportResist(
        eAdxResults: EAdxTypes.TrendResult[],
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<MarketStructureTypes.MarketStructureResult[]> {
        console.log(`🚀 Starting FSupportResist analysis for ${eAdxResults.length} stocks on ${targetDate}`);
        
        onProgress?.(0, 'Starting FSupportResist analysis...');
        
        const results: MarketStructureTypes.MarketStructureResult[] = [];
        const totalStocks = eAdxResults.length;
        
        for (let i = 0; i < totalStocks; i++) {
            const stock = eAdxResults[i];
            const progress = (i / totalStocks) * 100;
            onProgress?.(progress, `Processing ${stock.symbol} (${i + 1}/${totalStocks})`);
            
            try {
                // Load historical data for the stock
                const historicalData = await this.loadStockHistoricalData(stock.symbol, targetDate);
                
                if (!historicalData || historicalData.length < 20) {
                    console.warn(`⚠️ Insufficient historical data for ${stock.symbol}. Need at least 20 days, got ${historicalData?.length || 0}.`);
                    continue;
                }
                
                // Prepare input for analysis
                const input: MarketStructureTypes.FSupportResistInput = {
                    symbol: stock.symbol,
                    name: stock.name,
                    currentPrice: stock.currentPrice,
                    analysisDate: targetDate,
                    historicalData
                };
                
                // Run market structure analysis
                const result = FSupportResistLogic.analyzeMarketStructure(input);
                results.push(result);
                
            } catch (error) {
                console.error(`❌ Error analyzing market structure for ${stock.symbol}:`, error);
                // Continue with next stock
            }
        }
        
        onProgress?.(100, `FSupportResist analysis completed: ${results.length} stocks processed`);
        console.log(`✅ FSupportResist analysis completed: ${results.length}/${totalStocks} stocks processed`);
        
        return results;
    }

    // Load historical data for a stock
    private async loadStockHistoricalData(symbol: string, targetDate: string): Promise<MarketStructureTypes.OHLCData[]> {
        try {
            if (!this.dataIndex || !this.localData) {
                throw new Error('Local data not loaded');
            }
            
            // Get all data for the symbol up to the target date
            const symbolData = this.dataIndex[symbol];
            if (!symbolData) {
                console.error(`❌ No data found for symbol ${symbol} in dataIndex`);
                console.error(`Available symbols:`, Object.keys(this.dataIndex).slice(0, 10));
                throw new Error(`No data found for symbol ${symbol}`);
            }
            
            // Get all available dates and sort them
            const allDates = Object.keys(symbolData).sort();
            
            // Find the last available date up to target date
            const availableDates = allDates.filter(date => date <= targetDate);
            const lastAvailableDate = availableDates[availableDates.length - 1];
            
            // Use all available data (up to 200 days for SMA200 calculation)
            const recentDates = availableDates.slice(-Math.min(200, availableDates.length));
            
            const historicalData: MarketStructureTypes.OHLCData[] = recentDates.map(date => {
                const record = symbolData[date];
                return {
                    date: record.date,
                    open: record.open,
                    high: record.high,
                    low: record.low,
                    close: record.close,
                    volume: record.volume
                };
            });
            
            return historicalData;
            
        } catch (error) {
            console.error(`❌ Error loading historical data for ${symbol}:`, error);
            throw error;
        }
    }

    // הרצת התהליך המלא
    async runFullAnalysis(
        favoriteStocks: BSpyTypes.FavoriteStock[],
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<AnalysisOrchestratorResult> {
        const startTime = Date.now();
        console.log(`🚀 Starting full analysis for ${favoriteStocks.length} stocks on ${targetDate}`);
        
        try {
            // BSpy
            onProgress?.(0, 'Starting BSpy analysis...');
            const bSpyResults = await this.runBSpy(favoriteStocks, targetDate, (progress, message) => {
                onProgress?.(progress * 0.25, message);
            });
            
            // CAtrPrice
            onProgress?.(25, 'Starting CAtrPrice analysis...');
            const cAtrPriceResults = await this.runCAtrPrice(bSpyResults, targetDate, (progress, message) => {
                onProgress?.(25 + progress * 0.25, message);
            });
            
            // DSignals
            onProgress?.(40, 'Starting DSignals analysis...');
            const dSignalsResults = await this.runDSignals(cAtrPriceResults, targetDate, (progress, message) => {
                onProgress?.(40 + progress * 0.2, message);
            });
            
            // DTCandles
            onProgress?.(60, 'Starting DTCandles analysis...');
            const dTCandlesResults = await this.runDTCandles(dSignalsResults, targetDate, (progress, message) => {
                onProgress?.(60 + progress * 0.2, message);
            });
            
            // EAdx
            onProgress?.(80, 'Starting EAdx analysis...');
            const eAdxResults = await this.runEAdx(dSignalsResults, targetDate, (progress, message) => {
                onProgress?.(80 + progress * 0.1, message);
            });
            
            // FSupportResist
            onProgress?.(90, 'Starting FSupportResist analysis...');
            const fSupportResistResults = await this.runFSupportResist(eAdxResults, targetDate, (progress, message) => {
                onProgress?.(90 + progress * 0.05, message);
            });
            
            // חישוב ציון סופי
            onProgress?.(95, 'Calculating final scores...');
            const finalResults = this.calculateFinalScores(bSpyResults, cAtrPriceResults, dSignalsResults, dTCandlesResults, eAdxResults, fSupportResistResults);
            
            const analysisTime = Date.now() - startTime;
            
            onProgress?.(100, `Analysis completed in ${(analysisTime / 1000).toFixed(1)}s`);
            
            return {
                date: targetDate,
                frequency: 'daily',
                stocks: finalResults,
                totalStocks: favoriteStocks.length,
                processedStocks: finalResults.length,
                skippedStocks: favoriteStocks.length - finalResults.length,
                analysisTime,
                calculationDate: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Error in full analysis:', error);
            throw error;
        }
    }

    // חישוב ציונים סופיים
    private calculateFinalScores(
        bSpyResults: BSpyTypes.RelativeStrengthResult[],
        cAtrPriceResults: CAtrPriceTypes.VolatilityResult[],
        dSignalsResults: DSignalsTypes.MomentumResult[],
        dTCandlesResults: DTCandlesTypes.CandleResult[],
        eAdxResults: EAdxTypes.TrendResult[],
        fSupportResistResults: MarketStructureTypes.MarketStructureResult[]
    ): StockAnalysisResult[] {
        const results: StockAnalysisResult[] = [];
        
        for (const bSpy of bSpyResults) {
            const cAtrPrice = cAtrPriceResults.find(r => r.symbol === bSpy.symbol);
            const dSignals = dSignalsResults.find(r => r.symbol === bSpy.symbol);
            const dTCandles = dTCandlesResults.find(r => r.symbol === bSpy.symbol);
            const eAdx = eAdxResults.find(r => r.symbol === bSpy.symbol);
            const fSupportResist = fSupportResistResults.find(r => r.symbol === bSpy.symbol);
            
            // חישוב ציון סופי (ממוצע משוקלל עם נרות ותמיכה/התנגדות)
            const finalScore = Math.round(
                ((bSpy.LongSpyScore || 50) * 0.18) +           // 18% (הוקטן מ-20%)
                ((cAtrPrice?.LongAtrPriceScore || 50) * 0.18) + // 18% (הוקטן מ-20%)
                ((dSignals?.LongMomentumScore || 50) * 0.22) +  // 22% (הוקטן מ-25%)
                ((dTCandles?.candleScore || 0) * 0.05) +        // 5% (נשאר)
                ((eAdx?.LongAdxScore || 50) * 0.27) +           // 27% (הוקטן מ-30%)
                ((fSupportResist?.summary.strength || 3) * 20) * 0.10 // 10% (חדש - תמיכה/התנגדות)
            );
            
            results.push({
                symbol: bSpy.symbol,
                name: bSpy.name,
                currentPrice: bSpy.currentPrice,
                
                // BSpy
                previousPrice: bSpy.previousPrice,
                stockReturn: bSpy.stockReturn,
                spyReturn: bSpy.spyReturn,
                relativeStrength: bSpy.relativeStrength,
                LongSpyScore: bSpy.LongSpyScore,
                
                // CAtrPrice
                longAtrPriceScore: cAtrPrice?.LongAtrPriceScore,
                atrValue: cAtrPrice?.atr,
                atrRatio: cAtrPrice?.atrRatio,
                bbWidth: cAtrPrice?.bbWidth,
                bbPosition: cAtrPrice?.bbPosition,
                
                // DSignals
                sma3Current: dSignals?.sma3Current,
                sma3Previous: dSignals?.sma3Previous,
                sma12Current: dSignals?.sma12Current,
                sma12Previous: dSignals?.sma12Previous,
                crossoverType: dSignals?.crossoverType,
                macdHistogram: dSignals?.macdHistogram,
                LongMomentumScore: dSignals?.LongMomentumScore,
                
                // DTCandles
                candleScore: dTCandles?.candleScore,
                detectedPatterns: dTCandles?.detectedPatterns,
                
                // EAdx
                adxValue: eAdx?.adxValue,
                LongAdxScore: eAdx?.LongAdxScore,
                trendStrength: eAdx?.trendStrength,
                
                // FSupportResist
                marketStructure: fSupportResist,
                
                // Final
                finalScore,
                analysisDate: bSpy.analysisDate,
                calculationDate: new Date().toISOString()
            });
        }
        
        return results;
    }
}
