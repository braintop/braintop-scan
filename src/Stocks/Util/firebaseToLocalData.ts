import { db } from '../../Api/api';
import { collection, getDocs } from 'firebase/firestore';
import polygonApi from '../../Api/polygonApi';

// Interface עבור מניה מ-Firebase
interface FirebaseStock {
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

// Interface עבור נתוני OHLC מקומיים
interface LocalOHLCData {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjusted_close?: number;
}

// Interface עבור קובץ נתונים מקומי
interface LocalStockDataFile {
    metadata: {
        created: string;
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
        source: string;
        description: string;
    };
    data: LocalOHLCData[];
}

/**
 * טוען מניות מועדפות מ-Firebase
 */
export async function loadFavoriteStocksFromFirebase(): Promise<FirebaseStock[]> {
    try {
        console.log('🔍 Loading favorite stocks from Firebase...');
        
        const docSnap = await getDocs(collection(db, 'favorite'));
        let favoriteStocks: FirebaseStock[] = [];
        
        docSnap.forEach((doc) => {
            if (doc.id === 'my-favorites') {
                const data = doc.data();
                if (data.stocks && Array.isArray(data.stocks)) {
                    favoriteStocks = data.stocks.map((stock: any) => ({
                        symbol: stock.symbol,
                        name: stock.name,
                        price: stock.price,
                        market: stock.market,
                        volume: stock.volume,
                        dollarVolume: stock.dollarVolume,
                        float: stock.float,
                        spread: stock.spread,
                        marketCap: stock.marketCap,
                        avgVolume20: stock.avgVolume20
                    }));
                }
            }
        });
        
        console.log(`✅ Loaded ${favoriteStocks.length} favorite stocks from Firebase`);
        return favoriteStocks;
        
    } catch (error) {
        console.error('❌ Error loading favorite stocks from Firebase:', error);
        throw error;
    }
}

/**
 * מוריד נתוני OHLC עבור מניה ספציפית מ-1/11/2024 עד היום
 */
export async function fetchOHLCDataForStock(
    symbol: string, 
    startDate: string = '2024-11-01'
): Promise<LocalOHLCData[]> {
    try {
        console.log(`📊 Fetching OHLC data for ${symbol} from ${startDate}...`);
        
        const endDate = new Date().toISOString().split('T')[0];
        
        // קבלת נתונים היסטוריים מ-Polygon
        const historicalData = await polygonApi.getHistoricalData(symbol, startDate, endDate);
        
        if (!historicalData?.results || historicalData.results.length === 0) {
            console.warn(`⚠️ No historical data found for ${symbol}`);
            return [];
        }
        
        // המרה לפורמט מקומי
        const ohlcData: LocalOHLCData[] = historicalData.results.map((item: any) => ({
            date: new Date(item.t).toISOString().split('T')[0],
            symbol: symbol,
            open: item.o,
            high: item.h,
            low: item.l,
            close: item.c,
            volume: item.v,
            adjusted_close: item.c // Polygon כבר מחזיר נתונים מותאמים
        }));
        
        console.log(`✅ Fetched ${ohlcData.length} OHLC records for ${symbol}`);
        return ohlcData;
        
    } catch (error) {
        console.error(`❌ Error fetching OHLC data for ${symbol}:`, error);
        return [];
    }
}

/**
 * מוריד נתוני OHLC עבור כל המניות המועדפות
 */
export async function fetchAllFavoriteStocksOHLC(
    startDate: string = '2024-11-01',
    batchSize: number = 10,
    delayBetweenBatches: number = 1000
): Promise<LocalStockDataFile> {
    try {
        console.log('🚀 Starting bulk OHLC data fetch for all favorite stocks...');
        
        // טעינת מניות מועדפות
        const favoriteStocks = await loadFavoriteStocksFromFirebase();
        
        if (favoriteStocks.length === 0) {
            throw new Error('No favorite stocks found in Firebase');
        }
        
        console.log(`📈 Processing ${favoriteStocks.length} favorite stocks...`);
        
        const allOHLCData: LocalOHLCData[] = [];
        const symbols: string[] = [];
        let processedCount = 0;
        
        // עיבוד בקבוצות כדי לא להעמיס על API
        for (let i = 0; i < favoriteStocks.length; i += batchSize) {
            const batch = favoriteStocks.slice(i, i + batchSize);
            
            console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(favoriteStocks.length / batchSize)} (${batch.length} stocks)`);
            
            // עיבוד מקביל של המניות בקבוצה
            const batchPromises = batch.map(async (stock) => {
                try {
                    const ohlcData = await fetchOHLCDataForStock(stock.symbol, startDate);
                    
                    if (ohlcData.length > 0) {
                        allOHLCData.push(...ohlcData);
                        symbols.push(stock.symbol);
                        processedCount++;
                        console.log(`✅ ${stock.symbol}: ${ohlcData.length} records`);
                    } else {
                        console.warn(`⚠️ ${stock.symbol}: No data available`);
                    }
                } catch (error) {
                    console.error(`❌ Error processing ${stock.symbol}:`, error);
                }
            });
            
            // המתנה לסיום הקבוצה
            await Promise.all(batchPromises);
            
            // השהיה בין קבוצות
            if (i + batchSize < favoriteStocks.length) {
                console.log(`⏳ Waiting ${delayBetweenBatches}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }
        
        // מיון נתונים
        allOHLCData.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.symbol.localeCompare(b.symbol);
        });
        
        // יצירת קובץ נתונים מקומי
        const localDataFile: LocalStockDataFile = {
            metadata: {
                created: new Date().toISOString(),
                startDate,
                endDate: new Date().toISOString().split('T')[0],
                totalRecords: allOHLCData.length,
                symbols: [...new Set(symbols)].sort(),
                source: 'Firebase + Polygon API',
                description: `Local OHLC data for ${symbols.length} favorite stocks from ${startDate} to ${new Date().toISOString().split('T')[0]} - ${allOHLCData.length} total records`
            },
            data: allOHLCData
        };
        
        console.log('🎉 Bulk OHLC data fetch completed!');
        console.log(`📊 Total records: ${allOHLCData.length}`);
        console.log(`📈 Unique symbols: ${symbols.length}`);
        console.log(`✅ Successfully processed: ${processedCount}/${favoriteStocks.length} stocks`);
        
        return localDataFile;
        
    } catch (error) {
        console.error('❌ Error in bulk OHLC data fetch:', error);
        throw error;
    }
}

/**
 * שומר נתונים מקומיים לקובץ JSON
 */
export function saveLocalDataToFile(
    data: LocalStockDataFile, 
    filePath: string
): void {
    try {
        const fs = require('fs');
        const path = require('path');
        
        // יצירת תיקייה אם לא קיימת
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // שמירת קובץ
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        
        console.log(`💾 Local data saved to: ${filePath}`);
        console.log(`📊 Records: ${data.metadata.totalRecords}`);
        console.log(`📈 Symbols: ${data.metadata.symbols.length}`);
        
    } catch (error) {
        console.error('❌ Error saving local data to file:', error);
        throw error;
    }
}

/**
 * טוען נתונים מקומיים מקובץ JSON
 */
export function loadLocalDataFromFile(filePath: string): LocalStockDataFile {
    try {
        const fs = require('fs');
        const data = fs.readFileSync(filePath, 'utf-8');
        const localData: LocalStockDataFile = JSON.parse(data);
        
        console.log(`📊 Loaded local data: ${localData.metadata.description}`);
        return localData;
        
    } catch (error) {
        console.error('❌ Error loading local data from file:', error);
        throw error;
    }
}

/**
 * פונקציה עזר לקבלת נתונים עבור מניה ספציפית
 */
export function getStockDataFromLocal(
    localData: LocalStockDataFile,
    symbol: string,
    startDate?: string,
    endDate?: string
): LocalOHLCData[] {
    let filtered = localData.data.filter(stock => 
        stock.symbol.toUpperCase() === symbol.toUpperCase()
    );
    
    if (startDate) {
        filtered = filtered.filter(stock => stock.date >= startDate);
    }
    
    if (endDate) {
        filtered = filtered.filter(stock => stock.date <= endDate);
    }
    
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * פונקציה עזר לקבלת רשימת תאריכים זמינים
 */
export function getAvailableDatesFromLocal(localData: LocalStockDataFile): string[] {
    const dates = new Set(localData.data.map(stock => stock.date));
    return Array.from(dates).sort();
}

/**
 * פונקציה עזר לקבלת רשימת סימולים זמינים
 */
export function getAvailableSymbolsFromLocal(localData: LocalStockDataFile): string[] {
    return localData.metadata.symbols;
}

// דוגמה לשימוש:
export async function createLocalStockData() {
    try {
        console.log('🚀 Creating local stock data from Firebase favorites...');
        
        // הורדת נתונים
        const localData = await fetchAllFavoriteStocksOHLC('2024-11-01');
        
        // שמירה לקובץ
        const filePath = 'C:\\Users\\asafa\\OneDrive\\Desktop\\Desk\\braintop-temp\\braintop-scan-v2\\src\\Stocks\\Util\\local_stock_data.json';
        saveLocalDataToFile(localData, filePath);
        
        console.log('✅ Local stock data created successfully!');
        return localData;
        
    } catch (error) {
        console.error('❌ Error creating local stock data:', error);
        throw error;
    }
}
