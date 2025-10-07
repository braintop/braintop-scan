// Short Analysis Orchestrator - אורקסטרטור מרכזי לכל התהליכים של Short
import * as ShortBSpyLogic from './ShortBSpyLogic';
import * as ShortCAtrPriceLogic from './ShortCAtrPriceLogic';
import * as ShortDSignalsLogic from './ShortDSignalsLogic';
import * as ShortEAdxLogic from './ShortEAdxLogic';
import { calculateShortSpyScore } from './ShortBSpyLogic';
import { calculateShortMomentumScore } from './ShortDSignalsLogic';
import { calculateShortAdxScore } from './ShortEAdxLogic';
import * as BSpyTypes from '../Types/BSpyTypes';
import * as CAtrPriceTypes from '../Types/CAtrPriceTypes';
import * as DSignalsTypes from '../Types/DSignalsTypes';
import * as EAdxTypes from '../Types/EAdxTypes';

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
    
    // EAdx Results
    adxValue?: number;
    LongAdxScore?: number;
    trendStrength?: 'No Trend' | 'Weak Trend' | 'Strong Trend' | 'Very Strong' | 'Extreme';
    
    // Final Results
    finalScore?: number;
    analysisDate: string;
    calculationDate: string;
}

export class ShortAnalysisOrchestrator {
    private localData: any = null;
    private dataIndex: any = null;
    private dataSource: 'local' | 'api' = 'local';
    private dataLoadingPromise: Promise<void> | null = null;
    // availableDates removed - using single file now

    constructor() {
        this.dataLoadingPromise = this.loadLocalData();
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
        
        // המתנה לטעינת הנתונים
        if (this.dataLoadingPromise) {
            console.log('⏳ Waiting for local data to load...');
            await this.dataLoadingPromise;
        }
        
        // בדיקה שהנתונים נטענו
        if (!this.dataIndex || !this.localData) {
            throw new Error('Local data not loaded. Please refresh the page and try again.');
        }
        
        // Data loaded and ready for analysis
        
        onProgress?.(0, 'Starting BSpy analysis...');
        
        // קבלת נתוני SPY
        const spyData = await ShortBSpyLogic.getSPYData(targetDate, this.dataSource, this.localData, this.dataIndex);
        
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
            
            const result = await ShortBSpyLogic.calculateBSpyForStock(
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
        
        // המתנה לטעינת הנתונים
        if (this.dataLoadingPromise) {
            await this.dataLoadingPromise;
        }
        
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
                const localData = ShortBSpyLogic.getLocalHistoricalData(this.dataIndex, stock.symbol, targetDate, 30);
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
            
            const result = await ShortCAtrPriceLogic.calculateShortAtrPriceScore(
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
        
        // המתנה לטעינת הנתונים
        if (this.dataLoadingPromise) {
            await this.dataLoadingPromise;
        }
        
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
            
            const result = await ShortDSignalsLogic.calculateDSignalsForStock(
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

    // הרצת תהליך EAdx
    async runEAdx(
        dSignalsResults: DSignalsTypes.MomentumResult[],
        targetDate: string,
        onProgress?: (progress: number, message: string) => void
    ): Promise<EAdxTypes.TrendResult[]> {
        console.log(`🚀 Starting EAdx analysis for ${dSignalsResults.length} stocks on ${targetDate}`);
        
        // המתנה לטעינת הנתונים
        if (this.dataLoadingPromise) {
            await this.dataLoadingPromise;
        }
        
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
            
            const result = await ShortEAdxLogic.calculateEAdxForStock(
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
            onProgress?.(50, 'Starting DSignals analysis...');
            const dSignalsResults = await this.runDSignals(cAtrPriceResults, targetDate, (progress, message) => {
                onProgress?.(50 + progress * 0.25, message);
            });
            
            // EAdx
            onProgress?.(75, 'Starting EAdx analysis...');
            const eAdxResults = await this.runEAdx(dSignalsResults, targetDate, (progress, message) => {
                onProgress?.(75 + progress * 0.25, message);
            });
            
            // חישוב ציון סופי
            onProgress?.(95, 'Calculating final scores...');
            const finalResults = this.calculateFinalScores(bSpyResults, cAtrPriceResults, dSignalsResults, eAdxResults);
            
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
        eAdxResults: EAdxTypes.TrendResult[]
    ): StockAnalysisResult[] {
        const results: StockAnalysisResult[] = [];
        
        for (const bSpy of bSpyResults) {
            const cAtrPrice = cAtrPriceResults.find(r => r.symbol === bSpy.symbol);
            const dSignals = dSignalsResults.find(r => r.symbol === bSpy.symbol);
            const eAdx = eAdxResults.find(r => r.symbol === bSpy.symbol);
            
            // חישוב ציון סופי לשורט (ממוצע משוקלל) - שימוש בפונקציות השורט האמיתיות
            const shortSpyScore = calculateShortSpyScore(
                bSpy.stockReturn || 0, 
                bSpy.spyReturn || 0
            );
            const shortAtrPriceScore = cAtrPrice?.LongAtrPriceScore ? 
                (100 - cAtrPrice.LongAtrPriceScore) : 50; // זמנית עד שנשתמש ב-calculateShortAtrPriceScore
            const shortMomentumScore = calculateShortMomentumScore(
                dSignals?.crossoverType || 'None',
                dSignals?.macdHistogram || 0
            );
            const shortAdxScore = calculateShortAdxScore(
                eAdx?.adxValue || 25
            ).score;
            
            const finalScore = Math.round(
                (shortSpyScore * 0.25) +
                (shortAtrPriceScore * 0.25) +
                (shortMomentumScore * 0.25) +
                (shortAdxScore * 0.25)
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
                
                // EAdx
                adxValue: eAdx?.adxValue,
                LongAdxScore: eAdx?.LongAdxScore,
                trendStrength: eAdx?.trendStrength,
                
                // Final
                finalScore,
                analysisDate: bSpy.analysisDate,
                calculationDate: new Date().toISOString()
            });
        }
        
        return results;
    }
}
