const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Firebase configuration
const firebaseConfig = {
    // הוסף כאן את הגדרות Firebase שלך
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
 * טוען מניות מועדפות מ-Firebase
 */
async function loadFavoriteStocksFromFirebase() {
    try {
        console.log('🔍 Loading favorite stocks from Firebase...');
        
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
async function fetchAllFavoriteStocksOHLC(
    startDate = '2024-11-01',
    batchSize = 5,
    delayBetweenBatches = 2000
) {
    try {
        console.log('🚀 Starting bulk OHLC data fetch for all favorite stocks...');
        
        // טעינת מניות מועדפות
        const favoriteStocks = await loadFavoriteStocksFromFirebase();
        
        if (favoriteStocks.length === 0) {
            throw new Error('No favorite stocks found in Firebase');
        }
        
        console.log(`📈 Processing ${favoriteStocks.length} favorite stocks...`);
        
        const allOHLCData = [];
        const symbols = [];
        let processedCount = 0;
        
        // עיבוד בקבוצות כדי לא להעמיס על API
        // הגדלת batch size עבור 336 מניות (יותר יעיל)
        const optimizedBatchSize = Math.min(batchSize, 10); // עד 10 מניות בקבוצה
        
        for (let i = 0; i < favoriteStocks.length; i += optimizedBatchSize) {
            const batch = favoriteStocks.slice(i, i + optimizedBatchSize);
            
            console.log(`📦 Processing batch ${Math.floor(i / optimizedBatchSize) + 1}/${Math.ceil(favoriteStocks.length / optimizedBatchSize)} (${batch.length} stocks)`);
            
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
            
            // השהיה קצרה יותר בין קבוצות (336 מניות זה הרבה פחות)
            if (i + optimizedBatchSize < favoriteStocks.length) {
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
        const localDataFile = {
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
        
    } catch (error) {
        console.error('❌ Error saving local data to file:', error);
        throw error;
    }
}

// הפעלה אם הקובץ רץ ישירות
if (require.main === module) {
    const startDate = process.argv[2] || '2024-11-01';
    const outputPath = process.argv[3] || 'C:\\Users\\asafa\\OneDrive\\Desktop\\Desk\\braintop-temp\\braintop-scan-v2\\src\\Stocks\\Util\\local_stock_data.json';
    
    console.log('🚀 Firebase to Local Data Creator');
    console.log(`📅 Start Date: ${startDate}`);
    console.log(`📁 Output Path: ${outputPath}`);
    console.log('');
    
    fetchAllFavoriteStocksOHLC(startDate)
        .then((localData) => {
            saveLocalDataToFile(localData, outputPath);
            console.log('');
            console.log('🎉 Local data creation completed successfully!');
        })
        .catch((error) => {
            console.error('');
            console.error('💥 Local data creation failed:', error.message);
            process.exit(1);
        });
}

module.exports = { 
    loadFavoriteStocksFromFirebase, 
    fetchOHLCDataForStock, 
    fetchAllFavoriteStocksOHLC, 
    saveLocalDataToFile 
};
