import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Stack,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    LinearProgress,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { CloudDownload, CheckCircle, Error } from '@mui/icons-material';
import { db } from '../../../Api/api';
import { collection, getDocs } from 'firebase/firestore';
import polygonApi from '../../../Api/polygonApi';

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

// Interface עבור נתוני OHLC
interface OHLCData {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjusted_close?: number;
}


// Interface עבור קובץ נתונים מקומי גדול
interface LocalStockDataFile {
    metadata: {
        created: string;
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
        source: string;
        description: string;
        lastUpdate: string;
    };
    data: OHLCData[];
}

export default function ACreateData() {
    const [favoriteStocks, setFavoriteStocks] = useState<FirebaseStock[]>([]);
    const [availableFavorites, setAvailableFavorites] = useState<{id: string, name: string, count: number}[]>([]);
    const [selectedFavorite, setSelectedFavorite] = useState<string>('my-favorites');
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStock, setCurrentStock] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [downloadStats, setDownloadStats] = useState({
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        startTime: 0,
        estimatedTimeRemaining: 0,
        currentBatch: 0,
        totalBatches: 0,
        batchProgress: 0
    });
    
    // מצבי הורדה
    const [startDate, setStartDate] = useState<string>('2024-11-01');
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadAvailableFavorites();
    }, []);

    useEffect(() => {
        if (selectedFavorite) {
            loadFavoriteStocks();
        }
    }, [selectedFavorite]);

    // טעינת רשימת כל ה-favorites הזמינים
    const loadAvailableFavorites = async () => {
        try {
            console.log('🔍 Loading available favorites from Firebase...');
            setError(null);
            
            const docSnap = await getDocs(collection(db, 'favorite'));
            
            const favorites: {id: string, name: string, count: number}[] = [];
            docSnap.forEach((doc) => {
                const data = doc.data();
                if (data.stocks && Array.isArray(data.stocks)) {
                    const name = doc.id === 'my-favorites' ? 'my-favorites' : doc.id;
                    favorites.push({
                        id: doc.id,
                        name: name,
                        count: data.stocks.length
                    });
                }
            });
            
            // מיון לפי תאריך (החדשים קודם)
            favorites.sort((a, b) => {
                if (a.id === 'my-favorites') return 1; // my-favorites בסוף
                if (b.id === 'my-favorites') return -1;
                return b.id.localeCompare(a.id); // תאריכים יורדים
            });
            
            console.log(`✅ Found ${favorites.length} available favorites:`, favorites);
            setAvailableFavorites(favorites);
            
            if (favorites.length === 0) {
                setError('לא נמצאו favorites. אנא רוץ AScan תחילה');
            }
            
        } catch (error) {
            console.error('❌ Error loading available favorites:', error);
            setError(`שגיאה בטעינת רשימת favorites: ${error}`);
        }
    };

    // טעינת מניות מועדפות מ-Firebase לפי ה-favorite שנבחר
    const loadFavoriteStocks = async () => {
        try {
            console.log(`🔍 Loading favorite stocks from Firebase for: ${selectedFavorite}...`);
            setError(null);
            
            const docSnap = await getDocs(collection(db, 'favorite'));
            
            let foundStocks: FirebaseStock[] = [];
            docSnap.forEach((doc) => {
                if (doc.id === selectedFavorite) {
                    const data = doc.data();
                    if (data.stocks && Array.isArray(data.stocks)) {
                        foundStocks = data.stocks.map((stock: any) => ({
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
            
            console.log(`✅ Loaded ${foundStocks.length} favorite stocks from Firebase for ${selectedFavorite}`);
            setFavoriteStocks(foundStocks);
            
            if (foundStocks.length === 0) {
                setError(`לא נמצאו מניות עבור ${selectedFavorite}. אנא רוץ AScan תחילה`);
            }
            
        } catch (error) {
            console.error('❌ Error loading favorite stocks:', error);
            setError(`שגיאה בטעינת מניות מועדפות: ${error}`);
        }
    };

    // הורדת נתוני OHLC עבור מניה ספציפית
    const fetchOHLCDataForStock = async (symbol: string, startDate: string = '2024-11-01', endDate?: string): Promise<OHLCData[]> => {
        try {
            const targetEndDate = endDate || new Date().toISOString().split('T')[0];
            
            console.log(`📊 Fetching OHLC data for ${symbol} from ${startDate} to ${targetEndDate}...`);
            
            const historicalData = await polygonApi.getHistoricalData(symbol, startDate, targetEndDate);
            
            if (!historicalData?.results || historicalData.results.length === 0) {
                console.warn(`⚠️ No historical data found for ${symbol}`);
                return [];
            }
            
            const ohlcData: OHLCData[] = historicalData.results.map((item: any) => ({
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
    };

    // הורדת נתונים עבור כל 337 המניות + SPY
    const downloadAllStocksData = async () => {
        if (favoriteStocks.length === 0) {
            setError('אין מניות מועדפות להורדה');
            return;
        }

        setIsDownloading(true);
        setProgress(0);
        setError(null);
        setSuccess(null);
        
        const startTime = Date.now();
        const batchSize = 5; // הקטנת batch size לראות יותר פרטים
        
        // הוספת SPY לרשימת המניות
        const allStocks = [...favoriteStocks, { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' }];
        const totalBatches = Math.ceil(allStocks.length / batchSize);
        
        setDownloadStats({
            total: allStocks.length,
            processed: 0,
            successful: 0,
            failed: 0,
            startTime,
            estimatedTimeRemaining: 0,
            currentBatch: 0,
            totalBatches,
            batchProgress: 0
        });

        try {
            console.log(`🚀 Starting bulk OHLC data download for ${allStocks.length} stocks (${favoriteStocks.length} + SPY)...`);
            console.log(`📦 Processing in ${totalBatches} batches of ${batchSize} stocks each`);
            
            const allOHLCData: OHLCData[] = [];
            const symbols: string[] = [];
            let processedCount = 0;
            let successfulCount = 0;
            let failedCount = 0;
            
            for (let i = 0; i < allStocks.length; i += batchSize) {
                const batch = allStocks.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                
                console.log(`📦 Batch ${batchNumber}/${totalBatches} - Processing ${batch.length} stocks`);
                console.log(`   Stocks: ${batch.map(s => s.symbol).join(', ')}`);
                
                // עדכון סטטיסטיקות קבוצה
                setDownloadStats(prev => ({
                    ...prev,
                    currentBatch: batchNumber,
                    totalBatches,
                    batchProgress: 0
                }));
                
                // עיבוד מקביל של המניות בקבוצה
                const batchPromises = batch.map(async (stock, stockIndex) => {
                    try {
                        setCurrentStock(`${stock.symbol} (${stockIndex + 1}/${batch.length} בקבוצה ${batchNumber})`);
                        
                        const ohlcData = await fetchOHLCDataForStock(stock.symbol, startDate, endDate);
                        
                        if (ohlcData.length > 0) {
                            allOHLCData.push(...ohlcData);
                            symbols.push(stock.symbol);
                            successfulCount++;
                            console.log(`✅ ${stock.symbol}: ${ohlcData.length} records`);
                        } else {
                            failedCount++;
                            console.warn(`⚠️ ${stock.symbol}: No data available`);
                        }
                    } catch (error) {
                        failedCount++;
                        console.error(`❌ Error processing ${stock.symbol}:`, error);
                    }
                    
                    processedCount++;
                    
                    // עדכון התקדמות כללית
                    const newProgress = (processedCount / allStocks.length) * 100;
                    setProgress(newProgress);
                    
                    // עדכון התקדמות קבוצה
                    const batchProgress = ((stockIndex + 1) / batch.length) * 100;
                    setDownloadStats(prev => ({
                        ...prev,
                        processed: processedCount,
                        successful: successfulCount,
                        failed: failedCount,
                        batchProgress
                    }));
                    
                    // עדכון זמן נותר
                    const elapsed = Date.now() - startTime;
                    const estimatedTotal = (elapsed / processedCount) * allStocks.length;
                    const remaining = estimatedTotal - elapsed;
                    
                    setDownloadStats(prev => ({
                        ...prev,
                        estimatedTimeRemaining: Math.round(remaining / 1000)
                    }));
                });
                
                // המתנה לסיום הקבוצה
                await Promise.all(batchPromises);
                
                // השהיה בין קבוצות
                if (i + batchSize < allStocks.length) {
                    console.log(`⏳ Waiting 2 seconds before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            // מיון נתונים
            allOHLCData.sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.symbol.localeCompare(b.symbol);
            });
            
            
            // יצירת קובץ נתונים מקומי גדול
            const localDataFile: LocalStockDataFile = {
                metadata: {
                    created: new Date().toISOString(),
                    startDate: startDate,
                    endDate: endDate,
                    totalRecords: allOHLCData.length,
                    symbols: [...new Set(symbols)].sort(),
                    source: 'Firebase + Polygon API',
                    description: `Local OHLC data for ${symbols.length} favorite stocks from ${startDate} to ${endDate} - ${allOHLCData.length} total records`,
                    lastUpdate: new Date().toISOString()
                },
                data: allOHLCData
            };
            
            // שמירה מקומית
            await saveDataToLocalFile(localDataFile);
            
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            const minutes = Math.floor(totalTime / 60);
            const seconds = totalTime % 60;
            
            setSuccess(`הורדה הושלמה בהצלחה! 🎉\n\n📊 סה"כ רשומות: ${allOHLCData.length}\n📈 מניות מוצלחות: ${successfulCount}/${allStocks.length} (${favoriteStocks.length} + SPY)\n❌ מניות נכשלו: ${failedCount}\n⏱️ זמן עיבוד: ${minutes}m ${seconds}s\n💾 נשמר ב: src/Stocks/Util/local_stock_data.json`);
            
            console.log('🎉 Bulk OHLC data download completed!');
            console.log(`📊 Total records: ${allOHLCData.length}`);
            console.log(`📈 Successful stocks: ${successfulCount}/${allStocks.length} (${favoriteStocks.length} + SPY)`);
            console.log(`❌ Failed stocks: ${failedCount}`);
            
        } catch (error) {
            console.error('❌ Error in bulk download:', error);
            setError(`שגיאה בהורדה: ${error}`);
        } finally {
            setIsDownloading(false);
            setCurrentStock('');
        }
    };

    // שמירה מקומית לקובץ JSON גדול
    const saveDataToLocalFile = async (data: LocalStockDataFile) => {
        try {
            console.log('💾 Saving data to local file...');
            
            // יצירת JSON string
            const jsonData = JSON.stringify(data, null, 2);
            
            // יצירת Blob
            const blob = new Blob([jsonData], { type: 'application/json' });
            
            // יצירת URL להורדה
            const url = URL.createObjectURL(blob);
            
            // יצירת קישור להורדה
            const link = document.createElement('a');
            link.href = url;
            link.download = 'local_stock_data.json';
            
            // הוספה לדום וקליק
            document.body.appendChild(link);
            link.click();
            
            // ניקוי
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log('✅ Data saved to local file: local_stock_data.json');
            
        } catch (error) {
            console.error('❌ Error saving to local file:', error);
            throw error;
        }
    };


    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                📊 ACreateData - יצירת נתונים מקומיים (מניות + SPY)
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold">
                    🎯 הקומפוננטה מורידה נתוני OHLC + Volume עבור {favoriteStocks.length} המניות המועדפות + SPY מ-{startDate} עד {endDate}
                    <br />
                    💾 הנתונים נשמרים כקובץ JSON מקומי גדול לשימוש בקומפוננטים B, C, D, E
                    <br />
                    ⚡ זה יחסוך זמן רב בהמשך - אין צורך ב-API calls נוספים!
                </Typography>
            </Alert>

            {/* בחירת Favorite */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>בחירת Favorite</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <FormControl sx={{ minWidth: 200 }}>
                            <InputLabel>בחר Favorite</InputLabel>
                            <Select
                                value={selectedFavorite}
                                label="בחר Favorite"
                                onChange={(e) => setSelectedFavorite(e.target.value)}
                            >
                                {availableFavorites.map((favorite) => (
                                    <MenuItem key={favorite.id} value={favorite.id}>
                                        {favorite.name} ({favorite.count} מניות)
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={loadAvailableFavorites}
                        >
                            🔄 רענן רשימה
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* סטטיסטיקות מניות */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>מניות מועדפות זמינות</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Chip 
                            label={`${favoriteStocks.length} מניות`}
                            color={favoriteStocks.length > 0 ? 'success' : 'error'}
                            icon={favoriteStocks.length > 0 ? <CheckCircle /> : <Error />}
                        />
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={loadFavoriteStocks}
                        >
                            🔄 טען מחדש
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* בחירת טווח תאריכים */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>טווח תאריכים להורדה</Typography>
                    <Stack direction="row" spacing={2}>
                        <TextField
                            label="תאריך התחלה"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            helperText="תאריך התחלה (ברירת מחדל: 2024-11-01)"
                        />
                        <TextField
                            label="תאריך סיום"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            helperText="תאריך סיום (ברירת מחדל: היום)"
                        />
                    </Stack>
                </CardContent>
            </Card>

            {/* כפתור הורדה */}
            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<CloudDownload />}
                    onClick={downloadAllStocksData}
                    disabled={isDownloading || favoriteStocks.length === 0}
                >
                    {isDownloading ? 'מוריד נתונים...' : `הורד נתונים (${favoriteStocks.length} מניות + SPY)`}
                </Button>
            </Stack>

            {/* פרוגרס בר מפורט */}
            {isDownloading && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            🔍 מוריד נתוני OHLC - אל תסגור את הדף!
                        </Typography>
                        
                        {/* מניה נוכחית */}
                        <Typography variant="body1" gutterBottom fontWeight="bold" color="primary">
                            📊 מעבד כעת: {currentStock || 'מכין נתונים...'}
                        </Typography>
                        
                        {/* התקדמות כללית */}
                        <Typography variant="body2" gutterBottom>
                            התקדמות כללית: {progress.toFixed(1)}% ({downloadStats.processed}/{downloadStats.total} מניות)
                        </Typography>
                        
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{ height: 12, borderRadius: 6, mb: 2 }}
                        />
                        
                        {/* התקדמות קבוצה */}
                        <Typography variant="body2" gutterBottom>
                            קבוצה נוכחית: {downloadStats.currentBatch}/{downloadStats.totalBatches} 
                            ({downloadStats.batchProgress.toFixed(1)}% בקבוצה)
                        </Typography>
                        
                        <LinearProgress
                            variant="determinate"
                            value={downloadStats.batchProgress}
                            color="secondary"
                            sx={{ height: 8, borderRadius: 4, mb: 2 }}
                        />
                        
                        {/* סטטיסטיקות */}
                        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
                            <Chip 
                                label={`✅ מוצלח: ${downloadStats.successful}`}
                                color="success"
                                size="small"
                            />
                            <Chip 
                                label={`❌ נכשל: ${downloadStats.failed}`}
                                color="error"
                                size="small"
                            />
                            <Chip 
                                label={`⏱️ זמן נותר: ${downloadStats.estimatedTimeRemaining}s`}
                                color="info"
                                size="small"
                            />
                            <Chip 
                                label={`📦 קבוצה: ${downloadStats.currentBatch}/${downloadStats.totalBatches}`}
                                color="primary"
                                size="small"
                            />
                        </Stack>
                        
                        {/* מידע נוסף */}
                        <Typography variant="caption" color="text.secondary">
                            💡 הנתונים יישמרו אוטומטית כקובץ JSON גדול להורדה (local_stock_data.json)
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {/* הודעות הצלחה/שגיאה */}
            {success && (
                <Alert severity="success" sx={{ mt: 3 }}>
                    <Typography variant="body2" style={{ whiteSpace: 'pre-line' }}>
                        {success}
                    </Typography>
                </Alert>
            )}

            {error && (
                <Alert severity="error" sx={{ mt: 3 }}>
                    {error}
                </Alert>
            )}

            {/* טבלת מניות */}
            {favoriteStocks.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            📈 מניות מועדפות ({favoriteStocks.length})
                        </Typography>
                        
                        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>סימול</strong></TableCell>
                                        <TableCell><strong>שם</strong></TableCell>
                                        <TableCell><strong>מחיר</strong></TableCell>
                                        <TableCell><strong>שוק</strong></TableCell>
                                        <TableCell><strong>נפח</strong></TableCell>
                                        <TableCell><strong>שווי שוק</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {favoriteStocks.slice(0, 20).map((stock, index) => (
                                        <TableRow key={index}>
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
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${stock.price.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {stock.market}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {stock.volume.toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${stock.marketCap ? (stock.marketCap / 1000000).toFixed(1) + 'M' : 'N/A'}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        
                        {favoriteStocks.length > 20 && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                ... ועוד {favoriteStocks.length - 20} מניות
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}
