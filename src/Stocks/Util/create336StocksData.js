const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-auth-domain",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-storage-bucket",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-messaging-sender-id",
    appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * טוען 336 מניות מועדפות מ-Firebase
 */
async function load336FavoriteStocksFromFirebase() {
    try {
        console.log('🔍 Loading 336 favorite stocks from Firebase...');
        
        const docSnap = await getDocs(collection(db, 'favorite'));
        let favoriteStocks = [];
        
        docSnap.forEach((doc) => {
            if (doc.id === 'my-favorites') {
                const data = doc.data();
                if (data.stocks && Array.isArray(data.stocks)) {
                    favoriteStocks = data.stocks.map((stock) => ({
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
        console.log(`📊 Expected: 336 stocks, Got: ${favoriteStocks.length} stocks`);
        
        if (favoriteStocks.length !== 336) {
            console.warn(`⚠️ Warning: Expected 336 stocks but got ${favoriteStocks.length}`);
        }
        
        return favoriteStocks;
        
    } catch (error) {
        console.error('❌ Error loading favorite stocks from Firebase:', error);
        throw error;
    }
}

/**
 * מוריד נתוני OHLC עבור מניה ספציפית מ-Polygon API
 */
async function fetchOHLCDataForStock(symbol, startDate = '2024-11-01') {
    try {
        console.log(`📊 Fetching OHLC data for ${symbol} from ${startDate}...`);
        
        const endDate = new Date().toISOString().split('T')[0];
        const apiKey = process.env.VITE_POLYGON_API_KEY;
        
        if (!apiKey) {
            throw new Error('VITE_POLYGON_API_KEY not found in environment variables');
        }
        
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}?adjusted=true&apikey=${apiKey}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            console.warn(`⚠️ No historical data found for ${symbol}`);
            return [];
        }
        
        // המרה לפורמט מקומי
        const ohlcData = data.results.map((item) => ({
            date: new Date(item.t).toISOString().split('T')[0],
            symbol: symbol,
            open: item.o,
            high: item.h,
            low: item.l,
            close: item.c,
            volume: item.v,
            adjusted_close: item.c
        }));
        
        console.log(`✅ ${symbol}: ${ohlcData.length} OHLC records`);
        return ohlcData;
        
    } catch (error) {
        console.error(`❌ Error fetching OHLC data for ${symbol}:`, error);
        return [];
    }
}

/**
 * מוריד נתוני OHLC עבור 336 המניות המועדפות
 */
async function fetch336StocksOHLC(
    startDate = '2024-11-01',
    batchSize = 15, // הגדלת batch size עבור 336 מניות
    delayBetweenBatches = 1500 // השהיה קצרה יותר
) {
    try {
        console.log('🚀 Starting OHLC data fetch for 336 favorite stocks...');
        console.log(`📅 Date range: ${startDate} to ${new Date().toISOString().split('T')[0]}`);
        console.log(`📦 Batch size: ${batchSize} stocks per batch`);
        console.log(`⏱️ Delay between batches: ${delayBetweenBatches}ms`);
        console.log('');
        
        // טעינת 336 מניות מועדפות
        const favoriteStocks = await load336FavoriteStocksFromFirebase();
        
        if (favoriteStocks.length === 0) {
            throw new Error('No favorite stocks found in Firebase');
        }
        
        console.log(`📈 Processing ${favoriteStocks.length} favorite stocks...`);
        console.log('');
        
        const allOHLCData = [];
        const symbols = [];
        let processedCount = 0;
        let failedCount = 0;
        const startTime = Date.now();
        
        // עיבוד בקבוצות
        for (let i = 0; i < favoriteStocks.length; i += batchSize) {
            const batch = favoriteStocks.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(favoriteStocks.length / batchSize);
            
            console.log(`📦 Batch ${batchNumber}/${totalBatches} - Processing ${batch.length} stocks:`);
            console.log(`   Symbols: ${batch.map(s => s.symbol).join(', ')}`);
            
            // עיבוד מקביל של המניות בקבוצה
            const batchPromises = batch.map(async (stock) => {
                try {
                    const ohlcData = await fetchOHLCDataForStock(stock.symbol, startDate);
                    
                    if (ohlcData.length > 0) {
                        allOHLCData.push(...ohlcData);
                        symbols.push(stock.symbol);
                        processedCount++;
                        return { success: true, symbol: stock.symbol, records: ohlcData.length };
                    } else {
                        failedCount++;
                        return { success: false, symbol: stock.symbol, error: 'No data' };
                    }
                } catch (error) {
                    failedCount++;
                    return { success: false, symbol: stock.symbol, error: error.message };
                }
            });
            
            // המתנה לסיום הקבוצה
            const batchResults = await Promise.all(batchPromises);
            
            // הצגת תוצאות הקבוצה
            const successful = batchResults.filter(r => r.success);
            const failed = batchResults.filter(r => !r.success);
            
            console.log(`   ✅ Successful: ${successful.length}/${batch.length}`);
            successful.forEach(r => console.log(`      ${r.symbol}: ${r.records} records`));
            
            if (failed.length > 0) {
                console.log(`   ❌ Failed: ${failed.length}/${batch.length}`);
                failed.forEach(r => console.log(`      ${r.symbol}: ${r.error}`));
            }
            
            // השהיה בין קבוצות
            if (i + batchSize < favoriteStocks.length) {
                console.log(`   ⏳ Waiting ${delayBetweenBatches}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
            
            console.log('');
        }
        
        // מיון נתונים
        allOHLCData.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.symbol.localeCompare(b.symbol);
        });
        
        const endTime = Date.now();
        const totalTime = Math.round((endTime - startTime) / 1000);
        const minutes = Math.floor(totalTime / 60);
        const seconds = totalTime % 60;
        
        // יצירת קובץ נתונים מקומי
        const localDataFile = {
            metadata: {
                created: new Date().toISOString(),
                startDate,
                endDate: new Date().toISOString().split('T')[0],
                totalRecords: allOHLCData.length,
                symbols: [...new Set(symbols)].sort(),
                source: 'Firebase + Polygon API',
                processingTime: `${minutes}m ${seconds}s`,
                description: `Local OHLC data for ${symbols.length} favorite stocks from ${startDate} to ${new Date().toISOString().split('T')[0]} - ${allOHLCData.length} total records`
            },
            data: allOHLCData
        };
        
        console.log('🎉 OHLC data fetch completed!');
        console.log(`📊 Total records: ${allOHLCData.length}`);
        console.log(`📈 Unique symbols: ${symbols.length}`);
        console.log(`✅ Successfully processed: ${processedCount}/${favoriteStocks.length} stocks`);
        console.log(`❌ Failed: ${failedCount}/${favoriteStocks.length} stocks`);
        console.log(`⏱️ Total time: ${minutes}m ${seconds}s`);
        
        return localDataFile;
        
    } catch (error) {
        console.error('❌ Error in OHLC data fetch:', error);
        throw error;
    }
}

/**
 * שומר נתונים מקומיים לקובץ JSON
 */
function saveLocalDataToFile(data, filePath) {
    try {
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
        console.log(`⏱️ Processing time: ${data.metadata.processingTime}`);
        
    } catch (error) {
        console.error('❌ Error saving local data to file:', error);
        throw error;
    }
}

// הפעלה אם הקובץ רץ ישירות
if (require.main === module) {
    const startDate = process.argv[2] || '2024-11-01';
    const outputPath = process.argv[3] || 'C:\\Users\\asafa\\OneDrive\\Desktop\\Desk\\braintop-temp\\braintop-scan-v2\\src\\Stocks\\Util\\local_336_stocks_data.json';
    
    console.log('🚀 336 Stocks OHLC Data Creator');
    console.log(`📅 Start Date: ${startDate}`);
    console.log(`📁 Output Path: ${outputPath}`);
    console.log('');
    
    fetch336StocksOHLC(startDate)
        .then((localData) => {
            saveLocalDataToFile(localData, outputPath);
            console.log('');
            console.log('🎉 336 stocks data creation completed successfully!');
            console.log(`📁 File saved: ${outputPath}`);
        })
        .catch((error) => {
            console.error('');
            console.error('💥 Data creation failed:', error.message);
            process.exit(1);
        });
}

module.exports = { 
    load336FavoriteStocksFromFirebase, 
    fetchOHLCDataForStock, 
    fetch336StocksOHLC, 
    saveLocalDataToFile 
};
