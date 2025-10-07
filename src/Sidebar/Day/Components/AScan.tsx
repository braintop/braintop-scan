import { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    LinearProgress, 
    Table, 
    TableBody, 
    TableCell, 
    TableContainer, 
    TableHead, 
    TableRow, 
    Paper,
    Chip,
    Alert,
    Card,
    CardContent,
    Stack
} from '@mui/material';
import { PlayArrow, Stop, Save } from '@mui/icons-material';
import polygonApi from '../../../Api/polygonApi';
import { NASDAQ_STOCKS } from '../../../Stocks/Util/NASDAQ_STOCKS';
import { NYSE_STOCKS } from '../../../Stocks/Util/NYSE_STOCKS';
import { db } from '../../../Api/api';
import { setDoc, doc } from 'firebase/firestore';

interface StockScanResult {
    candleDate: string;  // תאריך הנר - השדה החשוב!
    scanDate: string;    // תאריך הסריקה
    symbol: string;
    name: string;
    price: number;
    market: string;
    volume: number;
    dollarVolume: number;
    float: number;
    spread: number;
    passed: boolean;
    marketCap?: number;
    avgVolume20?: number;
    shortable?: boolean;
}

interface ScanFilters {
    minPrice: number;
    minAvgVolume: number;
    minDollarVolume: number;
    minFloat: number;
    maxSpread: number;
}

export default function AScan() {
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStock, setCurrentStock] = useState('');
    const [, setResults] = useState<StockScanResult[]>([]);
    const [passedStocks, setPassedStocks] = useState<StockScanResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [scanStats, setScanStats] = useState({
        total: 0,
        scanned: 0,
        passed: 0,
        failed: 0,
        startTime: 0,
        estimatedTimeRemaining: 0
    });

    const filters: ScanFilters = {
        minPrice: 5.0,           // מחיר מינימלי ≥ 5$
        minAvgVolume: 5000000,   // נפח ממוצע 20 ימים ≥ 5M מניות
        minDollarVolume: 30000000, // Dollar Volume ≥ 30M$
        minFloat: 30000000,      // Float ≥ 30M מניות או שווי ציפה ≥ 500M$
        maxSpread: 0.5           // Spread ≤ 0.5%
    };

    // איחוד כל המניות מנסדק + NYSE
    const allStocks = [...NASDAQ_STOCKS, ...NYSE_STOCKS];

    useEffect(() => {
        console.log('AScan component loaded with', allStocks.length, 'stocks');
    }, []);

    // פונקציה לחילוץ תאריך הנר מנתוני Polygon
    const getCandleDate = (snapshot: any): string => {
        try {
            // נסה לחלץ תאריך מה-snapshot
            if (snapshot.updated && snapshot.updated > 0) {
                const date = new Date(snapshot.updated);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
            
            if (snapshot.last_trade?.sip_timestamp) {
                const date = new Date(snapshot.last_trade.sip_timestamp);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
            
            // אם אין timestamp תקין, השתמש בתאריך היום
            const today = new Date();
            return today.toISOString().split('T')[0];
        } catch (error) {
            console.warn('Failed to extract candle date:', error);
            // ברירת מחדל - תאריך היום
            const today = new Date();
            return today.toISOString().split('T')[0];
        }
    };

    const checkStockCriteria = async (symbol: string): Promise<StockScanResult | null> => {
        try {
            console.log(`🔍 Checking criteria for ${symbol}...`);
            
            // קבלת נתונים בסיסיים - אחד אחד כדי לראות איפה זה נכשל
            console.log(`📡 Getting snapshot for ${symbol}...`);
            const snapshot = await polygonApi.getSnapshot(symbol);
            
            if (!snapshot) {
                console.log(`❌ No snapshot data for ${symbol}, skipping...`);
                return null;
            }
            
            console.log(`📋 Getting ticker details for ${symbol}...`);
            let tickerDetails = null;
            try {
                tickerDetails = await polygonApi.getTickerDetails(symbol);
            } catch (error) {
                console.warn(`⚠️ Failed to get ticker details for ${symbol}:`, error);
                // המשך עם tickerDetails = null
            }
            
            console.log(`📈 Getting historical data for ${symbol}...`);
            const historicalData = await getHistoricalDataForVolume(symbol);

            // Extract real data from API response
            const currentPrice = snapshot.day?.close || snapshot.last_trade?.price || 0;
            const volume = snapshot.day?.volume || 0;
            const dollarVolume = polygonApi.calculateDollarVolume(volume, currentPrice);

            console.log(`💰 ${symbol} - Price: $${currentPrice}, Volume: ${volume.toLocaleString()}`);

            if (currentPrice === 0) {
                console.log(`⚠️ ${symbol} has no valid price data, skipping...`);
                return null;
            }

            // חישוב ממוצע נפח 20 ימים
            const avgVolume20 = historicalData ? 
                polygonApi.calculateAverageVolume(historicalData.results || []) : volume; // Use current volume if no historical

            // חישוב Spread
            const spread = snapshot.last_quote ? 
                polygonApi.calculateSpread(snapshot.last_quote.bid, snapshot.last_quote.ask) : 0.1; // Default small spread

            // קבלת נתוני Float ו-Market Cap
            const marketCap = tickerDetails?.market_cap || 0;
            const sharesOutstanding = tickerDetails?.weighted_shares_outstanding || 
                                    tickerDetails?.share_class_shares_outstanding || 
                                    (marketCap > 0 ? Math.round(marketCap / currentPrice) : 50000000); // Estimate if missing
            const floatShares = sharesOutstanding;

            // בדיקת Shortable - האם המניה ניתנת ל-short
            // רוב המניות ב-NASDAQ/NYSE ניתנות ל-short, חוץ מ-ETF ומניות קטנות
            const shortable = !snapshot.name?.toLowerCase().includes('etf') && 
                             !snapshot.name?.toLowerCase().includes('fund') &&
                             marketCap >= 100000000; // Market Cap >= $100M

            // בדיקת קריטריונים
            const pricePass = currentPrice >= filters.minPrice;
            const volumePass = avgVolume20 >= filters.minAvgVolume;
            const dollarVolumePass = dollarVolume >= filters.minDollarVolume;
            const floatPass = floatShares >= filters.minFloat || marketCap >= 500000000; // 500M$
            const spreadPass = spread >= 0 && spread <= filters.maxSpread;
            const shortablePass = shortable; // בדיקת Shortable

            // לא לכלול ETF, OTC, SPAC
            const typeFilter = !snapshot.name?.toLowerCase().includes('etf') && 
                             !snapshot.name?.toLowerCase().includes('spac') &&
                             snapshot.ticker && 
                             typeof snapshot.ticker === 'string' &&
                             !snapshot.ticker.includes('.');

            const passed: boolean = Boolean(pricePass && volumePass && dollarVolumePass && 
                          floatPass && spreadPass && shortablePass && typeFilter);

            const result: StockScanResult = {
                candleDate: getCandleDate(snapshot),  // תאריך הנר!
                scanDate: new Date().toISOString().split('T')[0], // תאריך הסריקה
                symbol: symbol,
                name: snapshot.name || tickerDetails?.name || `${symbol} (Real Data)`,
                price: currentPrice,
                market: tickerDetails?.primary_exchange || 'UNKNOWN',
                volume: volume,
                dollarVolume: dollarVolume,
                float: floatShares,
                spread: spread,
                passed: passed,
                marketCap: marketCap,
                avgVolume20: avgVolume20,
                shortable: shortable
            };

            console.log(`📊 ${symbol} analysis:`, {
                price: currentPrice,
                volume: volume.toLocaleString(),
                dollarVolume: `$${(dollarVolume/1000000).toFixed(1)}M`,
                shortable: shortable ? '✅' : '❌',
                candleDate: result.candleDate,
                passed: passed ? '✅' : '❌'
            });

            return result;

        } catch (error) {
            console.error(`Error scanning ${symbol}:`, error);
            return null;
        }
    };

    const getHistoricalDataForVolume = async (symbol: string) => {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30); // 30 ימים לאחור לוודא שיש מספיק נתונים

            const fromDate = startDate.toISOString().split('T')[0];
            const toDate = endDate.toISOString().split('T')[0];

            return await polygonApi.getHistoricalData(symbol, fromDate, toDate);
        } catch (error) {
            console.warn(`⚠️ Failed to get historical data for ${symbol}:`, error);
            return null; // החזר null במקום לזרוק שגיאה
        }
    };

    const startScan = async () => {
        console.log('🚀 Starting scan with', allStocks.length, 'stocks');
        setIsScanning(true);
        setProgress(0);
        setResults([]);
        setPassedStocks([]);
        setError(null);
        
        const totalStocks = allStocks.length;
        const startTime = Date.now();
        setScanStats({ total: totalStocks, scanned: 0, passed: 0, failed: 0, startTime, estimatedTimeRemaining: 0 });

        const scanResults: StockScanResult[] = [];
        const passed: StockScanResult[] = [];
        let isStillScanning = true;

        try {
            // בדיקה ראשונית של API
            console.log('🔑 Testing Polygon API connection...');
            const testMarketStatus = await polygonApi.getMarketStatus();
            console.log('📊 Market status:', testMarketStatus);

            for (let i = 0; i < totalStocks; i++) { // סורק את כל המניות
                if (!isStillScanning) {
                    console.log('⏹️ Scan stopped by user');
                    break;
                }

                const symbol = allStocks[i];
                console.log(`🔍 Scanning ${i + 1}/${totalStocks}: ${symbol}`);
                setCurrentStock(symbol);
                
                const result = await checkStockCriteria(symbol);
                
                if (result) {
                    scanResults.push(result);
                    if (result.passed) {
                        passed.push(result);
                        console.log(`✅ ${symbol} passed criteria!`);
                    } else {
                        console.log(`❌ ${symbol} failed criteria`);
                    }
                } else {
                    console.log(`⚠️ ${symbol} returned null result`);
                }

                // עדכון התקדמות
                const scannedCount = i + 1;
                const newProgress = (scannedCount / totalStocks) * 100;
                const currentTime = Date.now();
                const elapsedTime = currentTime - scanStats.startTime;
                const avgTimePerStock = elapsedTime / scannedCount;
                const estimatedTimeRemaining = Math.round((totalStocks - scannedCount) * avgTimePerStock / 1000);
                
                setProgress(newProgress);
                setScanStats(prev => ({
                    ...prev,
                    scanned: scannedCount,
                    passed: passed.length,
                    failed: scannedCount - scanResults.length,
                    estimatedTimeRemaining
                }));

                console.log(`📊 Progress: ${newProgress.toFixed(1)}% - Passed: ${passed.length}, Failed: ${scannedCount - scanResults.length}`);

                // השהייה כדי לא להעמיס על API
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            setResults(scanResults);
            setPassedStocks(passed);
            console.log(`🎉 Scan completed! Found ${passed.length} stocks that passed criteria`);
            
        } catch (error) {
            console.error('💥 Scan error:', error);
            setError(`שגיאה בסריקה: ${error}`);
        } finally {
            setIsScanning(false);
            setCurrentStock('');
            isStillScanning = false;
        }
    };

    const stopScan = () => {
        console.log('🛑 User stopped scan');
        setIsScanning(false);
        setCurrentStock('נעצר על ידי המשתמש');
    };

    const saveToFirebase = async () => {
        try {
            const documentId = 'my-favorites'; // רשומה קבועה
            
            console.log(`💾 Saving ${passedStocks.length} favorite stocks to Firebase...`);
            
            // מבנה הנתונים החדש - רק המניות הטובות ללא תאריך
            const favoriteData = {
                lastUpdated: new Date().toISOString(),
                scanDate: new Date().toISOString().split('T')[0], // תאריך הסריקה
                filters: filters, // הקריטריונים שהיו בשימוש
                totalScanned: scanStats.scanned,
                totalPassed: scanStats.passed,
                stocks: passedStocks.map(stock => ({
                    symbol: stock.symbol,
                    name: stock.name,
                    price: stock.price,
                    market: stock.market,
                    volume: stock.volume,
                    dollarVolume: stock.dollarVolume,
                    float: stock.float,
                    spread: stock.spread,
                    marketCap: stock.marketCap,
                    avgVolume20: stock.avgVolume20,
                    // לא שומרים candleDate - נשתמש בו רק ב-BSpy
                })),
                stats: scanStats,
                version: '3.0' // גרסה חדשה למניות מועדפות
            };

            // שמירה ב-favorite עם רשומה קבועה
            await setDoc(doc(db, 'favorite', documentId), favoriteData);
            
            alert(`מניות מועדפות נשמרו בהצלחה! 🌟\n\n` +
                  `🔍 סה"כ נסרקו: ${scanStats.scanned.toLocaleString()}\n` +
                  `⭐ מניות מועדפות: ${passedStocks.length}\n` +
                  `📊 קריטריונים: מחיר ≥$${filters.minPrice}, נפח ≥${filters.minAvgVolume}M\n` +
                  `💾 נשמר תחת: favorite/my-favorites\n\n` +
                  `כעת תוכל לעבור ל-BSpy לחישוב חוזק יחסי!`);
                  
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            alert('שגיאה בשמירה ל-Firebase');
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
        return num.toFixed(2);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                🔍 AScan - סריקת מניות מתקדמת
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold">
                    📊 המערכת משתמשת ב-Polygon API לקבלת נתונים אמיתיים ומעודכנים.
                    נתונים יכולים להיות מעוכבים ב-15 דקות עבור משתמשים חינמיים.
                    🗄️ שמירה ל-Firebase תתבצע עם תאריך הנר כמזהה!
                </Typography>
            </Alert>

            {/* סטטיסטיקות */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography variant="h6">סה"כ מניות</Typography>
                        <Typography variant="h4">{scanStats.total.toLocaleString()}</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography variant="h6">נסרקו</Typography>
                        <Typography variant="h4">{scanStats.scanned.toLocaleString()}</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, bgcolor: 'success.light' }}>
                    <CardContent>
                        <Typography variant="h6">עברו</Typography>
                        <Typography variant="h4" color="success.dark">
                            {scanStats.passed.toLocaleString()}
                        </Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, bgcolor: 'error.light' }}>
                    <CardContent>
                        <Typography variant="h6">נפלו</Typography>
                        <Typography variant="h4" color="error.dark">
                            {scanStats.failed.toLocaleString()}
                        </Typography>
                    </CardContent>
                </Card>
            </Stack>

            {/* קריטריונים */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>קריטריוני סינון</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
                        <Typography variant="body2">מחיר מינימלי: ${filters.minPrice}</Typography>
                        <Typography variant="body2">נפח ממוצע 20 ימים: {formatNumber(filters.minAvgVolume)}</Typography>
                        <Typography variant="body2">Dollar Volume: ${formatNumber(filters.minDollarVolume)}</Typography>
                        <Typography variant="body2">Float: {formatNumber(filters.minFloat)}</Typography>
                        <Typography variant="body2">Spread מקסימלי: {filters.maxSpread}%</Typography>
                    </Stack>
                </CardContent>
            </Card>

            {/* כפתורי בקרה */}
            <Box sx={{ mb: 3 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<PlayArrow />}
                        onClick={startScan}
                        disabled={isScanning}
                        size="large"
                    >
                        🚀 התחל סריקה מלאה ({allStocks.length.toLocaleString()} מניות)
                    </Button>
                    
                                         <Button
                         variant="contained"
                         color="secondary"
                         startIcon={<PlayArrow />}
                         onClick={async () => {
                             // סריקה מהירה של 500 מניות ראשונות
                             const originalLength = allStocks.length;
                             (allStocks as any).length = Math.min(500, originalLength);
                             await startScan();
                             (allStocks as any).length = originalLength;
                         }}
                         disabled={isScanning}
                     >
                         ⚡ סריקה מהירה (500 ראשונות)
                     </Button>
                    
                    <Button
                        variant="outlined"
                        startIcon={<Stop />}
                        onClick={stopScan}
                        disabled={!isScanning}
                        color="error"
                    >
                        🛑 עצור סריקה
                    </Button>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={async () => {
                            console.log('🧪 Testing API connection with AAL...');
                            setError(null);
                            try {
                                console.log('🔑 API Key:', import.meta.env.VITE_POLYGON_API_KEY ? `Present (${import.meta.env.VITE_POLYGON_API_KEY.slice(0,8)}...)` : 'Missing');
                                
                                // Test AAL specifically
                                console.log('✈️ Testing AAL snapshot...');
                                const aalResult = await polygonApi.getSnapshot('AAL');
                                console.log('AAL Result:', aalResult);
                                
                                // Test AAL ticker details
                                console.log('📋 Testing AAL ticker details...');
                                const aalDetails = await polygonApi.getTickerDetails('AAL');
                                console.log('AAL Details:', aalDetails);
                                
                                // Test AAL previous close
                                console.log('📊 Testing AAL previous close...');
                                const aalPrev = await polygonApi.getPreviousClose('AAL');
                                console.log('AAL Previous Close:', aalPrev);
                                
                                let alertMessage = 'AAL API Test Results:\n\n';
                                
                                if (aalResult) {
                                    if (aalResult.day?.close) {
                                        alertMessage += `📊 Day Close: $${aalResult.day.close}\n`;
                                        alertMessage += `📈 Volume: ${aalResult.day.volume?.toLocaleString()}\n`;
                                        alertMessage += `🏢 Market: ${aalResult.market_status}\n`;
                                    }
                                    if (aalResult.last_trade?.price) {
                                        alertMessage += `💰 Last Trade: $${aalResult.last_trade.price}\n`;
                                    }
                                    if (aalResult.last_quote) {
                                        alertMessage += `💹 Bid: $${aalResult.last_quote.bid} | Ask: $${aalResult.last_quote.ask}\n`;
                                    }
                                    
                                    // הוסף תאריך נר
                                    const candleDate = getCandleDate(aalResult);
                                    alertMessage += `📅 Candle Date: ${candleDate}\n`;
                                }
                                
                                if (aalPrev && aalPrev.results && aalPrev.results.length > 0) {
                                    const prev = aalPrev.results[0];
                                    alertMessage += `📅 Previous Close: $${prev.c}\n`;
                                    alertMessage += `📊 Previous Volume: ${prev.v?.toLocaleString()}\n`;
                                }
                                
                                if (aalDetails) {
                                    alertMessage += `🏢 Company: ${aalDetails.name}\n`;
                                    alertMessage += `🏛️ Exchange: ${aalDetails.primary_exchange}\n`;
                                }
                                
                                alert(alertMessage || 'לא התקבלו נתונים עבור AAL');
                                
                            } catch (error) {
                                console.error('❌ AAL API Test failed:', error);
                                setError(`שגיאת API: ${error}`);
                                alert(`שגיאת API: ${error}`);
                            }
                        }}
                        disabled={isScanning}
                    >
                        🧪 בדוק AAL
                    </Button>

                                         <Button
                         variant="contained"
                         color="info"
                         onClick={async () => {
                             console.log('🔗 Making direct API call to Polygon...');
                             try {
                                 const apiKey = import.meta.env.VITE_POLYGON_API_KEY;
                                 console.log('🔑 Using API Key:', apiKey ? `${apiKey.slice(0,8)}...` : 'MISSING');
                                 
                                 // Direct API call to last trade endpoint (real-time price)
                                 const lastTradeUrl = `https://api.polygon.io/v1/last/stocks/AAL?apikey=${apiKey}`;
                                 console.log('🌐 Last Trade URL:', lastTradeUrl);
                                 
                                 const lastTradeResponse = await fetch(lastTradeUrl);
                                 console.log('📡 Last Trade Response Status:', lastTradeResponse.status, lastTradeResponse.statusText);
                                 
                                 const lastTradeData = await lastTradeResponse.json();
                                 console.log('📊 Last Trade Data:', lastTradeData);
                                 
                                 // Also get snapshot for comparison
                                 const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/AAL?apikey=${apiKey}`;
                                 const snapshotResponse = await fetch(snapshotUrl);
                                 const snapshotData = await snapshotResponse.json();
                                 console.log('📊 Snapshot Data:', snapshotData);
                                 
                                 if (lastTradeData.last) {
                                     const lastTrade = lastTradeData.last;
                                     const snapshot = snapshotData.results?.ticker;
                                     
                                     alert(`Real-Time vs Daily Comparison! 🎯\n\n` +
                                           `💰 LAST TRADE (Real-Time): $${lastTrade.price}\n` +
                                           `📊 DAILY CLOSE: $${snapshot?.day?.c || 'N/A'}\n` +
                                           `📈 VOLUME: ${snapshot?.day?.v?.toLocaleString() || 'N/A'}\n` +
                                           `🕐 LAST TRADE TIME: ${new Date(lastTrade.timestamp).toLocaleString()}\n` +
                                           `🏛️ EXCHANGE: ${lastTrade.exchange}\n` +
                                           `📏 SIZE: ${lastTrade.size?.toLocaleString()}`);
                                 } else {
                                     alert(`API Response: ${JSON.stringify(lastTradeData, null, 2)}`);
                                 }
                             } catch (error) {
                                 console.error('❌ Direct API call failed:', error);
                                 alert(`Direct API Error: ${error}`);
                             }
                         }}
                         disabled={isScanning}
                     >
                         🔗 Direct API Call
                     </Button>

                     <Button
                         variant="contained"
                         color="secondary"
                         onClick={async () => {
                             console.log('🍎 Testing AAPL and ABNB specifically...');
                             setError(null);
                             try {
                                 // Test AAPL
                                 console.log('🍎 Testing AAPL...');
                                 const aaplResult = await checkStockCriteria('AAPL');
                                 console.log('AAPL Result:', aaplResult);
                                 
                                 // Test ABNB
                                 console.log('🏠 Testing ABNB...');
                                 const abnbResult = await checkStockCriteria('ABNB');
                                 console.log('ABNB Result:', abnbResult);
                                 
                                 let alertMessage = 'AAPL & ABNB Test Results:\n\n';
                                 
                                 if (aaplResult) {
                                     alertMessage += `🍎 AAPL:\n`;
                                     alertMessage += `💰 Price: $${aaplResult.price}\n`;
                                     alertMessage += `📈 Volume: ${aaplResult.volume.toLocaleString()}\n`;
                                     alertMessage += `💵 Dollar Volume: $${(aaplResult.dollarVolume/1000000).toFixed(1)}M\n`;
                                     alertMessage += `📊 Float: ${(aaplResult.float/1000000).toFixed(1)}M\n`;
                                     alertMessage += `📏 Spread: ${aaplResult.spread.toFixed(3)}%\n`;
                                     alertMessage += `✅ Passed: ${aaplResult.passed ? 'YES' : 'NO'}\n\n`;
                                 } else {
                                     alertMessage += `🍎 AAPL: ❌ No data\n\n`;
                                 }
                                 
                                 if (abnbResult) {
                                     alertMessage += `🏠 ABNB:\n`;
                                     alertMessage += `💰 Price: $${abnbResult.price}\n`;
                                     alertMessage += `📈 Volume: ${abnbResult.volume.toLocaleString()}\n`;
                                     alertMessage += `💵 Dollar Volume: $${(abnbResult.dollarVolume/1000000).toFixed(1)}M\n`;
                                     alertMessage += `📊 Float: ${(abnbResult.float/1000000).toFixed(1)}M\n`;
                                     alertMessage += `📏 Spread: ${abnbResult.spread.toFixed(3)}%\n`;
                                     alertMessage += `✅ Passed: ${abnbResult.passed ? 'YES' : 'NO'}\n\n`;
                                 } else {
                                     alertMessage += `🏠 ABNB: ❌ No data\n\n`;
                                 }
                                 
                                 alertMessage += `📋 Criteria:\n`;
                                 alertMessage += `💰 Min Price: $${filters.minPrice}\n`;
                                 alertMessage += `📈 Min Volume: ${(filters.minAvgVolume/1000000).toFixed(1)}M\n`;
                                 alertMessage += `💵 Min Dollar Volume: $${(filters.minDollarVolume/1000000).toFixed(1)}M\n`;
                                 alertMessage += `📊 Min Float: ${(filters.minFloat/1000000).toFixed(1)}M\n`;
                                 alertMessage += `📏 Max Spread: ${filters.maxSpread}%\n`;
                                 
                                 alert(alertMessage);
                                 
                             } catch (error) {
                                 console.error('❌ AAPL/ABNB Test failed:', error);
                                 setError(`שגיאת בדיקה: ${error}`);
                                 alert(`שגיאת בדיקה: ${error}`);
                             }
                         }}
                         disabled={isScanning}
                     >
                         🍎 Test AAPL/ABNB
                     </Button>

                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<Save />}
                        onClick={saveToFirebase}
                        disabled={passedStocks.length === 0}
                    >
                        ⭐ שמור כמועדפות ({passedStocks.length})
                    </Button>
                </Stack>
            </Box>

            {/* פרוגרס בר */}
            {isScanning && (
                <Box sx={{ mb: 3 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2" fontWeight="bold">
                            🔍 סריקה פעילה - אל תסגור את הדף!
                        </Typography>
                    </Alert>
                    <Typography variant="body1" gutterBottom fontWeight="bold">
                        סורק כעת: {currentStock || 'מכין נתונים...'}
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        התקדמות: {progress.toFixed(1)}% ({scanStats.scanned.toLocaleString()} מתוך {scanStats.total.toLocaleString()})
                    </Typography>
                    {scanStats.estimatedTimeRemaining > 0 && (
                        <Typography variant="body2" color="primary" gutterBottom>
                            ⏱️ זמן משוער נותר: {Math.floor(scanStats.estimatedTimeRemaining / 60)}:{(scanStats.estimatedTimeRemaining % 60).toString().padStart(2, '0')} דקות
                        </Typography>
                    )}
                    <LinearProgress 
                        variant="determinate" 
                        value={progress} 
                        sx={{ height: 12, borderRadius: 6, mb: 2 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                        ✅ עברו: {scanStats.passed} | ❌ נפלו: {scanStats.failed} | 🔍 מהירות: {scanStats.scanned > 0 ? Math.round(scanStats.scanned / ((Date.now() - scanStats.startTime) / 1000 / 60)) : 0} מניות/דקה
                    </Typography>
                </Box>
            )}

            {/* שגיאות */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* טבלת תוצאות */}
            {passedStocks.length > 0 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>תאריך נר</TableCell>
                                <TableCell>סימול</TableCell>
                                <TableCell>שם</TableCell>
                                <TableCell>מחיר</TableCell>
                                <TableCell>בורסה</TableCell>
                                <TableCell>נפח</TableCell>
                                <TableCell>Dollar Volume</TableCell>
                                <TableCell>Float</TableCell>
                                <TableCell>Spread %</TableCell>
                                <TableCell>סטטוס</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {passedStocks.map((stock, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight="bold" color="primary">
                                            {stock.candleDate}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight="bold">
                                            {stock.symbol}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" noWrap>
                                            {stock.name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>${stock.price.toFixed(2)}</TableCell>
                                    <TableCell>{stock.market}</TableCell>
                                    <TableCell>{formatNumber(stock.volume)}</TableCell>
                                    <TableCell>${formatNumber(stock.dollarVolume)}</TableCell>
                                    <TableCell>{formatNumber(stock.float)}</TableCell>
                                    <TableCell>{stock.spread.toFixed(3)}%</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label="עבר" 
                                            color="success" 
                                            size="small"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
