import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
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
    Stack
} from '@mui/material';
import { CloudDownload, CheckCircle, Error, Refresh } from '@mui/icons-material';
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

// Interface עבור נתוני OHLC שבועיים
interface WeeklyOHLCData {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjusted_close?: number;
}

// Interface עבור קובץ נתונים מקומי שבועי
interface WeeklyLocalStockDataFile {
    metadata: {
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
        frequency: 'weekly';
        lastUpdated: string;
    };
    data: WeeklyOHLCData[];
}

export default function WeekACreateData() {
    const [favoriteStocks, setFavoriteStocks] = useState<FirebaseStock[]>([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStock, setCurrentStock] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [downloadResults, setDownloadResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Date range selection
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - (35 * 7 * 5)); // 35 weeks * 7 days * 5 trading days
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    // טעינת 337 מניות מועדפות מ-Firebase (אותו מקום כמו היומי)
    const loadFavoriteStocks = async () => {
        try {
            console.log('🔍 Loading 337 favorite stocks from Firebase...');
            setError(null);
            setIsLoading(true);

            const docSnap = await getDocs(collection(db, 'favorite'));
            
            let foundStocks: FirebaseStock[] = [];
            docSnap.forEach((doc) => {
                if (doc.id === 'my-favorites') {
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
            
            console.log(`✅ Loaded ${foundStocks.length} favorite stocks from Firebase`);
            setFavoriteStocks(foundStocks);
            
            if (foundStocks.length === 0) {
                setError('לא נמצאו מניות מועדפות. אנא רוץ AScan תחילה');
            }
            
        } catch (error) {
            console.error('❌ Error loading favorite stocks:', error);
            setError(`שגיאה בטעינת מניות מועדפות: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadFavoriteStocks();
    }, []);

    // הורדת נתוני OHLC יומיים ומרוכזים לשבועיים עבור מניה ספציפית
    const fetchWeeklyOHLCDataForStock = async (symbol: string): Promise<WeeklyOHLCData[]> => {
        try {
            console.log(`📊 Fetching daily data for ${symbol} from ${startDate} to ${endDate} to create weekly aggregates`);
            
            // הורדת נתונים יומיים
            const historicalData = await polygonApi.getHistoricalData(symbol, startDate, endDate);
            
            if (!historicalData?.results || historicalData.results.length === 0) {
                console.warn(`⚠️ No historical data found for ${symbol}`);
                return [];
            }

            // עיבוד נתונים יומיים לשבועיים
            const dailyData = historicalData.results.map((item: any) => ({
                date: new Date(item.t).toISOString().split('T')[0],
                symbol: symbol,
                open: item.o,
                high: item.h,
                low: item.l,
                close: item.c,
                volume: item.v,
                adjusted_close: item.c
            }));

            // קיבוץ נתונים יומיים לשבועיים
            const weeklyData = aggregateDailyToWeekly(dailyData);

            console.log(`✅ Created ${weeklyData.length} weekly records from ${dailyData.length} daily records for ${symbol}`);
            return weeklyData;
        } catch (error) {
            console.error(`❌ Error fetching weekly data for ${symbol}:`, error);
            return [];
        }
    };

    // פונקציה לקיבוץ נתונים יומיים לשבועיים
    const aggregateDailyToWeekly = (dailyData: any[]): WeeklyOHLCData[] => {
        const weeklyMap = new Map<string, any[]>();
        
        // קיבוץ נתונים לפי שבוע (שנה + שבוע בשנה)
        dailyData.forEach(day => {
            const date = new Date(day.date);
            const year = date.getFullYear();
            const weekNumber = getWeekNumber(date);
            const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
            
            if (!weeklyMap.has(weekKey)) {
                weeklyMap.set(weekKey, []);
            }
            weeklyMap.get(weekKey)!.push(day);
        });

        // יצירת נתונים שבועיים
        const weeklyData: WeeklyOHLCData[] = [];
        weeklyMap.forEach((weekDays, weekKey) => {
            if (weekDays.length === 0) return;
            
            // מיון לפי תאריך
            weekDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const firstDay = weekDays[0];
            const lastDay = weekDays[weekDays.length - 1];
            
            const weeklyRecord: WeeklyOHLCData = {
                date: `${weekKey}-${lastDay.date}`, // תאריך סיום השבוע
                symbol: firstDay.symbol,
                open: firstDay.open, // מחיר פתיחה של יום ראשון
                close: lastDay.close, // מחיר סגירה של יום שישי
                high: Math.max(...weekDays.map(d => d.high)), // הגבוה ביותר בשבוע
                low: Math.min(...weekDays.map(d => d.low)), // הנמוך ביותר בשבוע
                volume: weekDays.reduce((sum, d) => sum + d.volume, 0), // סכום נפח השבוע
                adjusted_close: lastDay.adjusted_close
            };
            
            weeklyData.push(weeklyRecord);
        });

        // מיון לפי תאריך
        return weeklyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    // פונקציה לחישוב מספר שבוע בשנה
    const getWeekNumber = (date: Date): number => {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    };

    // הורדת נתונים שבועיים עבור כל 337 המניות + SPY
    const downloadAllWeeklyStocksData = async () => {
        if (favoriteStocks.length === 0) {
            setError('אין מניות מועדפות להורדה');
            return;
        }

        // Validate date range
        if (!startDate || !endDate) {
            setError('נא לבחור תאריך התחלה וסיום');
            return;
        }

        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        
        if (startDateObj > endDateObj) {
            setError('תאריך התחלה לא יכול להיות אחרי תאריך סיום');
            return;
        }

        if (endDateObj > new Date()) {
            setError('תאריך סיום לא יכול להיות בעתיד');
            return;
        }

        setIsDownloading(true);
        setProgress(0);
        setError(null);
        setDownloadResults([]);

        try {
            console.log(`🚀 Starting weekly data download for ${favoriteStocks.length + 1} stocks (including SPY)...`);
            
            const allWeeklyData: WeeklyOHLCData[] = [];
            let processedStocks = 0;
            const totalStocks = favoriteStocks.length + 1; // +1 for SPY

            // הורדת נתונים עבור SPY תחילה
            console.log('📊 Fetching SPY weekly data...');
            setCurrentStock('SPY (Weekly Data)');
            const spyWeeklyData = await fetchWeeklyOHLCDataForStock('SPY');
            allWeeklyData.push(...spyWeeklyData);
            processedStocks++;
            setProgress((processedStocks / totalStocks) * 100);

            // הורדת נתונים עבור כל המניות
            for (let i = 0; i < favoriteStocks.length; i++) {
                const stock = favoriteStocks[i];
                setCurrentStock(`${stock.symbol} (${i + 1}/${favoriteStocks.length})`);
                
                const weeklyData = await fetchWeeklyOHLCDataForStock(stock.symbol);
                allWeeklyData.push(...weeklyData);
                
                processedStocks++;
                setProgress((processedStocks / totalStocks) * 100);
                
                // הוספת תוצאה
                setDownloadResults(prev => [...prev, {
                    symbol: stock.symbol,
                    records: weeklyData.length,
                    status: weeklyData.length > 0 ? 'success' : 'warning'
                }]);

                // השהיה קצרה בין בקשות
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`✅ Downloaded ${allWeeklyData.length} total weekly records`);

            // יצירת קובץ נתונים מקומי
            const weeklyLocalData: WeeklyLocalStockDataFile = {
                metadata: {
                    startDate: startDate,
                    endDate: endDate,
                    totalRecords: allWeeklyData.length,
                    symbols: ['SPY', ...favoriteStocks.map(s => s.symbol)],
                    frequency: 'weekly',
                    lastUpdated: new Date().toISOString()
                },
                data: allWeeklyData
            };

            // שמירה לקובץ מקומי
            await saveWeeklyDataToLocalFile(weeklyLocalData);

            console.log('🎉 Weekly data download completed successfully!');
            setProgress(100);
            setCurrentStock('הורדה הושלמה בהצלחה!');

        } catch (error) {
            console.error('❌ Error downloading weekly data:', error);
            setError(`שגיאה בהורדת נתונים שבועיים: ${error}`);
        } finally {
            setIsDownloading(false);
        }
    };

    // שמירה מקומית לקובץ JSON שבועי
    const saveWeeklyDataToLocalFile = async (data: WeeklyLocalStockDataFile) => {
        try {
            console.log('💾 Saving weekly data to local file...');
            
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = 'weekly_stock_data.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log('✅ Weekly data saved to weekly_stock_data.json');
            
            // הודעה למשתמש
            alert('✅ נתונים שבועיים נשמרו בהצלחה!\n\nהקובץ נשמר כ-weekly_stock_data.json\n\nאנא העבר את הקובץ למיקום:\nsrc/Stocks/Util/weekly_stock_data.json');
            
        } catch (error) {
            console.error('❌ Error saving weekly data:', error);
            setError(`שגיאה בשמירת נתונים: ${error}`);
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Weekly Data Creator
                </Typography>
                <LinearProgress />
                <Typography variant="body1" sx={{ mt: 2 }}>
                    טוען מניות מועדפות...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Weekly Data Creator
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
                הורדת נתונים שבועיים עבור {favoriteStocks.length} מניות מועדפות + SPY
            </Typography>

            {/* Available Favorite Stocks */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        מניות מועדפות זמינות
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Chip
                            icon={<CheckCircle />}
                            label={`מניות ${favoriteStocks.length}`}
                            color={favoriteStocks.length > 0 ? 'success' : 'warning'}
                            variant="outlined"
                        />
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={loadFavoriteStocks}
                            disabled={isLoading}
                            startIcon={<Refresh />}
                        >
                            טען מחדש
                        </Button>
                    </Box>
                    
                    {favoriteStocks.length === 0 && (
                        <Alert severity="warning">
                            לא נמצאו מניות מועדפות. לחץ על "טען מחדש" או ודא שיש חיבור ל-Firebase.
                        </Alert>
                    )}
                    
                    {favoriteStocks.length > 0 && (
                        <Alert severity="success">
                            נטענו {favoriteStocks.length} מניות מועדפות מ-Firebase. מוכן להורדת נתונים שבועיים.
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Weekly Data Download
                    </Typography>
                    
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        יוריד נתונים שבועיים עבור כל מניה בטווח התאריכים שנבחר
                    </Typography>

                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                        <TextField
                            label="תאריך התחלה"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label="תאריך סיום"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                        />
                    </Stack>

                    {isDownloading && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                {currentStock}
                            </Typography>
                            <LinearProgress 
                                variant="determinate" 
                                value={progress} 
                                sx={{ mb: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                {Math.round(progress)}% הושלם
                            </Typography>
                        </Box>
                    )}

                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<CloudDownload />}
                        onClick={downloadAllWeeklyStocksData}
                        disabled={isDownloading || favoriteStocks.length === 0}
                    >
                        {isDownloading ? 'מוריד נתונים שבועיים...' : `הורד נתונים שבועיים (${favoriteStocks.length + 1} מניות) - ${startDate} עד ${endDate}`}
                    </Button>
                </CardContent>
            </Card>

            {downloadResults.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            תוצאות הורדה
                        </Typography>
                        
                        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>מניה</TableCell>
                                        <TableCell>רשומות</TableCell>
                                        <TableCell>סטטוס</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {downloadResults.map((result, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{result.symbol}</TableCell>
                                            <TableCell>{result.records}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={result.status === 'success' ? <CheckCircle /> : <Error />}
                                                    label={result.status === 'success' ? 'הצלחה' : 'אזהרה'}
                                                    color={result.status === 'success' ? 'success' : 'warning'}
                                                    size="small"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}