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
    CircularProgress,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { 
    PlayArrow, 
    Save, 
    CheckCircle, 
    Delete
} from '@mui/icons-material';
import { db } from '../../Api/api';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

// Interfaces
interface WeeklyLocalDataInfo {
    startDate: string;
    endDate: string;
    totalRecords: number;
    symbols: string[];
    frequency: 'weekly';
    lastUpdated: string;
}

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

interface WeeklyAnalysisResult {
    symbol: string;
    name: string;
    currentPrice: number;
    LongSpyScore: number;
    LongAtrPriceScore: number;
    LongMomentumScore: number;
    LongAdxScore: number;
    finalScore: number;
    finalSignal: string;
    candleDate: string;
    calculationDate: string;
    week_1: number;
    week_2: number;
    week_3: number;
    week_4: number;
    week_5: number;
    
    // שדות נוספים לפי הסכימה
    adxScore: number;
    adxValue: number;
    atrRatio: number;
    atrValue: number;
    momentumScore: number;
    crossoverType: string;
    macdHistogram: number;
    relativeStrength: number;
    stockReturn: number;
    spyReturn: number;
    previousPrice: number;
    entryPrice: number;
    
    // מחירים שבועיים
    prices: {
        week_1: { date: string; price: number; open: number; high: number; low: number; volume: number; };
        week_2: { date: string; price: number; open: number; high: number; low: number; volume: number; };
        week_3: { date: string; price: number; open: number; high: number; low: number; volume: number; };
        week_4: { date: string; price: number; open: number; high: number; low: number; volume: number; };
        week_5: { date: string; price: number; open: number; high: number; low: number; volume: number; };
    };
    
    // שדות נוספים
    momentumAnalysisDate: string;
    volatilityAnalysisDate: string;
    trendAnalysisDate: string;
    trendStrength: string;
    tradeStatus: string;
    stopLoss: number;
    takeProfit: number;
    rewardDollar: number;
    riskDollar: number;
    rrRatio: number;
    rrMethod: string;
    rrApproved: boolean;
    rrConfidence: number;
    rrAnalysisDate: string;
    
    // timestamps
    lastUpdated: string;
    lastADXUpdate: string;
    lastCAtrUpdate: string;
    lastMomentumUpdate: string;
    lastRRUpdate: string;
}

export default function WeekMasterAnalysis() {
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [currentStep, setCurrentStep] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<WeeklyAnalysisResult[]>([]);
    const [localDataInfo, setLocalDataInfo] = useState<WeeklyLocalDataInfo | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<'single' | 'range'>('single');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [firebaseData, setFirebaseData] = useState<any>(null);
    const [isCheckingFirebase, setIsCheckingFirebase] = useState(false);
    const [isDeletingFirebase, setIsDeletingFirebase] = useState(false);

    // טעינת מידע על נתונים מקומיים שבועיים
    const loadWeeklyLocalDataInfo = async () => {
        try {
            setIsLoadingData(true);
            setError(null);
            
            console.log('🔍 Loading weekly local data info...');
            
            const weeklyData = await import('../../Stocks/Util/weekly_stock_data.json');
            const data = weeklyData as any;
            
            if (data && data.metadata && data.data) {
                const info: WeeklyLocalDataInfo = {
                    startDate: data.metadata.startDate,
                    endDate: data.metadata.endDate,
                    totalRecords: data.metadata.totalRecords,
                    symbols: data.metadata.symbols,
                    frequency: 'weekly',
                    lastUpdated: data.metadata.lastUpdated
                };
                
                console.log('✅ Weekly local data loaded:', info);
                setLocalDataInfo(info);
                
                if (data.data && data.data.length > 0) {
                    // מציאת התאריך האחרון הקיים בנתונים
                    const allDates = [...new Set(data.data.map((item: any) => item.date))].sort();
                    const latestDate = allDates[allDates.length - 1] as string;
                    console.log('📅 Latest available date in weekly data:', latestDate);
                    setSelectedDate(latestDate);
                }
            } else {
                throw new Error('Invalid weekly data structure');
            }
            
        } catch (error) {
            console.error('❌ Error loading weekly local data:', error);
            setError(`שגיאה בטעינת נתונים שבועיים: ${error}`);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        loadWeeklyLocalDataInfo();
    }, []);

    // פונקציות ניתוח פשוטות
    const calculateWeeklyRelativeStrength = (stockData: WeeklyOHLCData[], spyData: WeeklyOHLCData[]): number => {
        if (stockData.length < 2 || spyData.length < 2) return 50;
        
        const stockReturn = ((stockData[stockData.length - 1].close - stockData[stockData.length - 2].close) / stockData[stockData.length - 2].close) * 100;
        const spyReturn = ((spyData[spyData.length - 1].close - spyData[spyData.length - 2].close) / spyData[spyData.length - 2].close) * 100;
        const relativeStrength = stockReturn - spyReturn;
        
        let score = 50;
        if (relativeStrength > 2) score = Math.min(100, 50 + (relativeStrength * 10));
        else if (relativeStrength < -2) score = Math.max(0, 50 + (relativeStrength * 10));
        
        return Math.round(score * 10) / 10;
    };

    const calculateWeeklyVolatility = (ohlcData: WeeklyOHLCData[]): number => {
        if (ohlcData.length < 20) return 50;
        
        const currentPrice = ohlcData[ohlcData.length - 1].close;
        const atr = (ohlcData[ohlcData.length - 1].high - ohlcData[ohlcData.length - 1].low) / 2;
        const atrRatio = (atr / currentPrice) * 100;
        
        let score = 50;
        if (atrRatio <= 2) score += 20;
        else if (atrRatio <= 3) score += 10;
        else if (atrRatio >= 8) score -= 20;
        else if (atrRatio >= 6) score -= 10;
        
        return Math.max(0, Math.min(100, score));
    };

    const calculateWeeklyMomentum = (ohlcData: WeeklyOHLCData[]): number => {
        if (ohlcData.length < 15) return 50;
        
        const closes = ohlcData.map(candle => candle.close);
        const sma3 = closes.slice(-3).reduce((sum, close) => sum + close, 0) / 3;
        const sma12 = closes.slice(-12).reduce((sum, close) => sum + close, 0) / 12;
        const sma3Previous = closes.slice(-4, -1).reduce((sum, close) => sum + close, 0) / 3;
        const sma12Previous = closes.slice(-13, -1).reduce((sum, close) => sum + close, 0) / 12;
        
        let score = 50;
        if (sma3Previous <= sma12Previous && sma3 > sma12) score += 25;
        else if (sma3Previous >= sma12Previous && sma3 < sma12) score -= 25;
        
        const macdHistogram = (closes.slice(-8).reduce((sum, close) => sum + close, 0) / 8) - 
                            (closes.slice(-16).reduce((sum, close) => sum + close, 0) / 16);
        
        if (macdHistogram > 0) score += 15;
        else if (macdHistogram < 0) score -= 15;
        
        return Math.max(0, Math.min(100, score));
    };

    const calculateWeeklyADX = (ohlcData: WeeklyOHLCData[]): number => {
        if (ohlcData.length < 15) return 50;
        
        const currentPrice = ohlcData[ohlcData.length - 1].close;
        const recentCloses = ohlcData.slice(-14).map(candle => candle.close);
        const volatility = Math.max(...recentCloses) - Math.min(...recentCloses);
        const adxValue = (volatility / currentPrice) * 100;
        
        let score = 50;
        if (adxValue >= 25) score += 20;
        else if (adxValue >= 15) score += 10;
        else score -= 10;
        
        return Math.max(0, Math.min(100, score));
    };

    // הרצת ניתוח שבועי מלא
    const runWeeklyAnalysis = async (targetDate: string) => {
        if (!localDataInfo) {
            setError('נתונים שבועיים לא נטענו');
            return;
        }

        setIsAnalyzing(true);
        setCurrentStep('טוען נתונים שבועיים...');
        setError(null);
        setResults([]);

        try {
            console.log(`🚀 Starting weekly analysis for ${targetDate}...`);
            
            const weeklyData = await import('../../Stocks/Util/weekly_stock_data.json');
            const data = weeklyData as any;
            const allWeeklyData: WeeklyOHLCData[] = data.data || [];

            const spyData = allWeeklyData.filter(item => item.symbol === 'SPY');
            
            if (spyData.length < 2) {
                throw new Error('לא מספיק נתוני SPY שבועיים');
            }

            const stockSymbols = localDataInfo.symbols.filter(symbol => symbol !== 'SPY');
            const analysisResults: WeeklyAnalysisResult[] = [];

            for (let i = 0; i < stockSymbols.length; i++) {
                const symbol = stockSymbols[i];
                setCurrentStep(`מנתח ${symbol} (${i + 1}/${stockSymbols.length})`);
                
                const weeklyStockData = allWeeklyData.filter(item => item.symbol === symbol);
                
                if (weeklyStockData.length >= 15) {
                    const LongSpyScore = calculateWeeklyRelativeStrength(weeklyStockData, spyData);
                    const LongAtrPriceScore = calculateWeeklyVolatility(weeklyStockData);
                    const LongMomentumScore = calculateWeeklyMomentum(weeklyStockData);
                    const LongAdxScore = calculateWeeklyADX(weeklyStockData);
                    
                    const finalScore = (LongSpyScore + LongAtrPriceScore + LongMomentumScore + LongAdxScore) / 4;
                    
                    const currentWeekData = weeklyStockData[weeklyStockData.length - 1];
                    const currentPrice = currentWeekData.close;
                    const entryPrice = currentWeekData.close; // מחיר סגירה של השבוע (entryPrice) - עקבי עם היומי
                    
                    // מציאת השבועות הבאים מהנתונים האמיתיים
                    let week_1 = 0, week_2 = 0, week_3 = 0, week_4 = 0, week_5 = 0;
                    let week_1_data = null, week_2_data = null, week_3_data = null, week_4_data = null, week_5_data = null;
                    
                    // חיפוש השבוע הנוכחי והשבועות העתידיים
                    const targetDateObj = new Date(targetDate);
                    
                    // מציאת כל התאריכים הזמינים עבור המניה הזו
                    const stockDates = allWeeklyData
                        .filter(item => item.symbol === symbol)
                        .map(item => item.date)
                        .sort();
                    
                    console.log(`📅 Available dates for ${symbol}:`, stockDates.slice(0, 10));
                    console.log(`📅 Total dates for ${symbol}:`, stockDates.length);
                    
                    // מציאת השבוע הנוכחי - השבוע שמכיל את התאריך שנבחר
                    let currentWeekIndex = -1;
                    for (let i = 0; i < stockDates.length; i++) {
                        const weekDate = stockDates[i];
                        // חילוץ התאריך מהפורמט "2025-W38-2025-09-19"
                        const weekEndDate = weekDate.split('-').slice(2).join('-'); // "2025-09-19"
                        const weekEndDateObj = new Date(weekEndDate);
                        
                        // בדיקה אם התאריך הנוכחי נמצא בשבוע הזה
                        const weekStartDateObj = new Date(weekEndDateObj);
                        weekStartDateObj.setDate(weekEndDateObj.getDate() - 6); // תחילת השבוע
                        
                        if (targetDateObj >= weekStartDateObj && targetDateObj <= weekEndDateObj) {
                            currentWeekIndex = i;
                            console.log(`📅 Found current week for ${symbol}: ${weekDate} (contains ${targetDate}) at index ${i}`);
                            break;
                        }
                    }
                    
                    if (currentWeekIndex === -1) {
                        console.log(`❌ Could not find current week for ${symbol} containing date ${targetDate}`);
                    } else {
                        // חיפוש השבועות העתידיים
                        console.log(`🔍 Searching for future weeks starting from index ${currentWeekIndex + 1}`);
                        for (let i = 1; i <= 5; i++) {
                            const futureWeekIndex = currentWeekIndex + i;
                            console.log(`🔍 Looking for week ${i} at index ${futureWeekIndex}`);
                            if (futureWeekIndex < stockDates.length) {
                                const futureDate = stockDates[futureWeekIndex];
                                console.log(`🔍 Future date for week ${i}: ${futureDate}`);
                                const futureData = allWeeklyData.find(item => 
                                    item.symbol === symbol && item.date === futureDate
                                );
                                
                                if (futureData) {
                                    console.log(`📈 Found week ${i} data for ${symbol}: ${futureDate} = $${futureData.close}`);
                                    switch(i) {
                                        case 1: 
                                            week_1 = futureData.close; 
                                            week_1_data = futureData; 
                                            break;
                                        case 2: 
                                            week_2 = futureData.close; 
                                            week_2_data = futureData; 
                                            break;
                                        case 3: 
                                            week_3 = futureData.close; 
                                            week_3_data = futureData; 
                                            break;
                                        case 4: 
                                            week_4 = futureData.close; 
                                            week_4_data = futureData; 
                                            break;
                                        case 5: 
                                            week_5 = futureData.close; 
                                            week_5_data = futureData; 
                                            break;
                                    }
                                } else {
                                    console.log(`❌ No week ${i} data found for ${symbol} at date ${futureDate}`);
                                }
                            } else {
                                console.log(`❌ No week ${i} data found for ${symbol} - index ${futureWeekIndex} out of range (total: ${stockDates.length})`);
                            }
                        }
                    }

                    // יצירת אובייקט מלא לפי הסכימה של 20.2.json
                    const stockData = {
                        // שדות בסיסיים
                        symbol: symbol,
                        name: symbol,
                        currentPrice: currentPrice,
                        candleDate: targetDate,
                        calculationDate: new Date().toISOString().split('T')[0],
                        
                        // ציונים
                        LongSpyScore: LongSpyScore,
                        LongAtrPriceScore: LongAtrPriceScore,
                        LongMomentumScore: LongMomentumScore,
                        LongAdxScore: LongAdxScore,
                        finalScore: Math.round(finalScore * 10) / 10,
                        finalSignal: finalScore >= 70 ? 'Long' : finalScore <= 30 ? 'Short' : 'Neutral',
                        
                        // שדות נוספים לפי הסכימה
                        adxScore: LongAdxScore,
                        adxValue: 0, // יועבר מחישוב ADX אמיתי
                        atrRatio: 0, // יועבר מחישוב ATR אמיתי
                        atrValue: 0,
                        momentumScore: LongMomentumScore,
                        crossoverType: 'None', // יועבר מחישוב MACD אמיתי
                        macdHistogram: 0,
                        relativeStrength: 0, // יועבר מחישוב BSpy אמיתי
                        stockReturn: 0,
                        spyReturn: 0,
                        previousPrice: currentPrice * 0.95, // הערכה
                        entryPrice: entryPrice, // מחיר סגירה של השבוע (entryPrice) - עקבי עם היומי
                        
                        // מחירים שבועיים (week_1 עד week_5) - נתונים אמיתיים
                        prices: {
                            week_1: {
                                date: week_1_data ? week_1_data.date : stockDates[currentWeekIndex + 1] || '',
                                price: week_1_data ? Math.round(week_1_data.close * 100) / 100 : Math.round(week_1 * 100) / 100,
                                open: week_1_data ? Math.round(week_1_data.open * 100) / 100 : Math.round(week_1 * 100) / 100,
                                high: week_1_data ? Math.round(week_1_data.high * 100) / 100 : Math.round(week_1 * 1.05 * 100) / 100,
                                low: week_1_data ? Math.round(week_1_data.low * 100) / 100 : Math.round(week_1 * 0.95 * 100) / 100,
                                volume: week_1_data ? week_1_data.volume : 1000000
                            },
                            week_2: {
                                date: week_2_data ? week_2_data.date : stockDates[currentWeekIndex + 2] || '',
                                price: week_2_data ? Math.round(week_2_data.close * 100) / 100 : Math.round(week_2 * 100) / 100,
                                open: week_2_data ? Math.round(week_2_data.open * 100) / 100 : Math.round(week_2 * 100) / 100,
                                high: week_2_data ? Math.round(week_2_data.high * 100) / 100 : Math.round(week_2 * 1.05 * 100) / 100,
                                low: week_2_data ? Math.round(week_2_data.low * 100) / 100 : Math.round(week_2 * 0.95 * 100) / 100,
                                volume: week_2_data ? week_2_data.volume : 1000000
                            },
                            week_3: {
                                date: week_3_data ? week_3_data.date : stockDates[currentWeekIndex + 3] || '',
                                price: week_3_data ? Math.round(week_3_data.close * 100) / 100 : Math.round(week_3 * 100) / 100,
                                open: week_3_data ? Math.round(week_3_data.open * 100) / 100 : Math.round(week_3 * 100) / 100,
                                high: week_3_data ? Math.round(week_3_data.high * 100) / 100 : Math.round(week_3 * 1.05 * 100) / 100,
                                low: week_3_data ? Math.round(week_3_data.low * 100) / 100 : Math.round(week_3 * 0.95 * 100) / 100,
                                volume: week_3_data ? week_3_data.volume : 1000000
                            },
                            week_4: {
                                date: week_4_data ? week_4_data.date : stockDates[currentWeekIndex + 4] || '',
                                price: week_4_data ? Math.round(week_4_data.close * 100) / 100 : Math.round(week_4 * 100) / 100,
                                open: week_4_data ? Math.round(week_4_data.open * 100) / 100 : Math.round(week_4 * 100) / 100,
                                high: week_4_data ? Math.round(week_4_data.high * 100) / 100 : Math.round(week_4 * 1.05 * 100) / 100,
                                low: week_4_data ? Math.round(week_4_data.low * 100) / 100 : Math.round(week_4 * 0.95 * 100) / 100,
                                volume: week_4_data ? week_4_data.volume : 1000000
                            },
                            week_5: {
                                date: week_5_data ? week_5_data.date : stockDates[currentWeekIndex + 5] || '',
                                price: week_5_data ? Math.round(week_5_data.close * 100) / 100 : Math.round(week_5 * 100) / 100,
                                open: week_5_data ? Math.round(week_5_data.open * 100) / 100 : Math.round(week_5 * 100) / 100,
                                high: week_5_data ? Math.round(week_5_data.high * 100) / 100 : Math.round(week_5 * 1.05 * 100) / 100,
                                low: week_5_data ? Math.round(week_5_data.low * 100) / 100 : Math.round(week_5 * 0.95 * 100) / 100,
                                volume: week_5_data ? week_5_data.volume : 1000000
                            }
                        },
                        
                        // שדות נוספים
                        momentumAnalysisDate: new Date().toISOString().split('T')[0],
                        volatilityAnalysisDate: new Date().toISOString().split('T')[0],
                        trendAnalysisDate: new Date().toISOString().split('T')[0],
                        trendStrength: 'Moderate',
                        tradeStatus: 'Pending',
                        stopLoss: Math.round(currentPrice * 0.95 * 100) / 100,
                        takeProfit: Math.round(currentPrice * 1.15 * 100) / 100,
                        rewardDollar: Math.round((currentPrice * 1.15 - currentPrice) * 100) / 100,
                        riskDollar: Math.round((currentPrice - currentPrice * 0.95) * 100) / 100,
                        rrRatio: Math.round((currentPrice * 1.15 - currentPrice) / (currentPrice - currentPrice * 0.95) * 100) / 100,
                        rrMethod: 'Fixed',
                        rrApproved: true,
                        rrConfidence: 75,
                        rrAnalysisDate: new Date().toISOString().split('T')[0],
                        
                        // timestamps
                        lastUpdated: new Date().toISOString(),
                        lastADXUpdate: new Date().toISOString(),
                        lastCAtrUpdate: new Date().toISOString(),
                        lastMomentumUpdate: new Date().toISOString(),
                        lastRRUpdate: new Date().toISOString(),
                        
                        // שדות נוספים לשבועי
                        week_1: Math.round(week_1 * 100) / 100,
                        week_2: Math.round(week_2 * 100) / 100,
                        week_3: Math.round(week_3 * 100) / 100,
                        week_4: Math.round(week_4 * 100) / 100,
                        week_5: Math.round(week_5 * 100) / 100
                    };

                    analysisResults.push(stockData);
                }
                
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            console.log(`✅ Weekly analysis completed: ${analysisResults.length} stocks analyzed`);
            setResults(analysisResults);
            setCurrentStep('ניתוח הושלם בהצלחה!');

        } catch (error) {
            console.error('❌ Error in weekly analysis:', error);
            setError(`שגיאה בניתוח שבועי: ${error}`);
            setCurrentStep('שגיאה בניתוח');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const runSingleDateAnalysis = async () => {
        if (!selectedDate) {
            setError('נא לבחור תאריך');
            return;
        }
        await runWeeklyAnalysis(selectedDate);
    };

    const runDateRangeAnalysis = async () => {
        if (!startDate || !endDate) {
            setError('נא לבחור תאריך התחלה וסיום');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            setError('תאריך התחלה אחרי תאריך סיום');
            return;
        }
        
        if (new Date(endDate) > new Date()) {
            setError('תאריך סיום לא יכול להיות בעתיד');
            return;
        }
        
        await runWeeklyAnalysis(endDate);
    };

    const saveToFirebase = async () => {
        if (results.length === 0) {
            setError('אין תוצאות לשמירה');
            return;
        }

        setIsSaving(true);
        try {
            console.log('💾 Saving weekly analysis results to Firebase...');

            // יצירת אובייקט Firebase מלא לפי הסכימה
            const firebaseData = {
                // שדות בסיסיים
                candleDate: results[0].candleDate,
                calculationDate: new Date().toISOString().split('T')[0],
                totalStocks: results.length,
                version: "1.0",
                
                // שדות ניתוח
                catrAnalysisCompleted: true,
                momentumAnalysisCompleted: true,
                trendAnalysisCompleted: true,
                rrAnalysisCompleted: true,
                
                // timestamps
                lastADXUpdate: new Date().toISOString(),
                lastCAtrUpdate: new Date().toISOString(),
                lastFinalScoreUpdate: new Date().toISOString(),
                lastMomentumUpdate: new Date().toISOString(),
                lastUpdate: new Date().toISOString(),
                lastRRUpdate: new Date().toISOString(),
                
                // תוצאות
                results: results,
                
                // סטטיסטיקות
                rrAnalysisStats: {
                    approvedTrades: results.filter(r => r.rrApproved).length,
                    rejectedTrades: results.filter(r => !r.rrApproved).length,
                    totalStocks: results.length,
                    avgRRRatio: results.reduce((sum, r) => sum + r.rrRatio, 0) / results.length
                },
                
                // אותות
                signals: {
                    long: results.filter(r => r.finalSignal === 'Long').length,
                    short: results.filter(r => r.finalSignal === 'Short').length,
                    neutral: results.filter(r => r.finalSignal === 'Neutral').length
                },
                
                // נתוני SPY
                spyData: {
                    currentPrice: 0, // יועבר מחישוב SPY
                    previousPrice: 0,
                    return: 0
                },
                
                // מטא דטא
                metadata: {
                    startDate: localDataInfo?.startDate,
                    endDate: localDataInfo?.endDate,
                    totalRecords: localDataInfo?.totalRecords,
                    lastUpdated: new Date().toISOString(),
                    analysisType: 'weekly_master',
                    frequency: 'weekly'
                }
            };

            const documentId = `${results[0].candleDate}_weekly_relative_strength`;
            await setDoc(doc(db, 'week_relative-strength', documentId), firebaseData);
            
            console.log(`✅ Saved weekly analysis results to Firebase: ${documentId}`);
            
        } catch (error) {
            console.error('❌ Error saving to Firebase:', error);
            setError(`שגיאה בשמירה ל-Firebase: ${error}`);
        } finally {
            setIsSaving(false);
        }
    };

    const checkFirebaseData = async () => {
        setIsCheckingFirebase(true);
        try {
            const snapshot = await getDocs(collection(db, 'week_relative-strength'));
            const data: any[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('📊 Firebase weekly data:', data);
            setFirebaseData(data);
            
        } catch (error) {
            console.error('❌ Error checking Firebase:', error);
            setError(`שגיאה בבדיקת Firebase: ${error}`);
        } finally {
            setIsCheckingFirebase(false);
        }
    };

    const deleteFirebaseData = async () => {
        if (!firebaseData || firebaseData.length === 0) {
            setError('אין נתונים למחיקה');
            return;
        }

        setIsDeletingFirebase(true);
        try {
            for (const docData of firebaseData) {
                await deleteDoc(doc(db, 'week_relative-strength', docData.id));
                console.log(`🗑️ Deleted: ${docData.id}`);
            }
            
            console.log('✅ All weekly Firebase data deleted');
            setFirebaseData(null);
            
        } catch (error) {
            console.error('❌ Error deleting Firebase data:', error);
            setError(`שגיאה במחיקת נתונים: ${error}`);
        } finally {
            setIsDeletingFirebase(false);
        }
    };

    if (isLoadingData) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Weekly Master Analysis - Full Stock Analysis
                </Typography>
                <CircularProgress />
                <Typography variant="body1" sx={{ mt: 2 }}>
                    טוען נתונים שבועיים...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Weekly Master Analysis - Full Stock Analysis
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
                ניתוח שבועי מלא לכל המניות - 4 שלבים
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Weekly Data Info */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        📊 Weekly Data Available
                    </Typography>
                    
                    {localDataInfo ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                📊 <strong>Weekly Data Available</strong><br/>
                                📅 <strong>Date Range:</strong> {localDataInfo.startDate} - {localDataInfo.endDate}<br/>
                                📈 <strong>Total Records:</strong> {localDataInfo.totalRecords.toLocaleString()}<br/>
                                🏢 <strong>Stocks:</strong> {localDataInfo.symbols.length}<br/>
                                📁 <strong>Location:</strong> src/Stocks/Util/weekly_stock_data.json
                            </Typography>
                        </Alert>
                    ) : (
                        <Alert severity="warning">
                            <Typography variant="body2">
                                ⚠️ <strong>No Weekly Data Found</strong><br/>
                                Make sure there's a file at src/Stocks/Util/weekly_stock_data.json
                            </Typography>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Firebase Controls */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🔥 Firebase Controls
                    </Typography>
                    
                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="outlined"
                            startIcon={<CheckCircle />}
                            onClick={checkFirebaseData}
                            disabled={isCheckingFirebase}
                        >
                            {isCheckingFirebase ? 'בודק...' : 'Check Firebase'}
                        </Button>
                        
                        {firebaseData && firebaseData.length > 0 && (
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<Delete />}
                                onClick={deleteFirebaseData}
                                disabled={isDeletingFirebase}
                            >
                                {isDeletingFirebase ? 'מוחק...' : 'Delete Firebase'}
                            </Button>
                        )}
                    </Stack>
                    
                    {firebaseData && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            <Typography variant="body2">
                                📊 <strong>Firebase Status:</strong> {firebaseData.length} documents found<br/>
                                📅 <strong>Latest:</strong> {firebaseData[firebaseData.length - 1]?.candleDate}
                            </Typography>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Analysis Controls */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🎯 Weekly Analysis Controls
                    </Typography>
                    
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Analysis Mode</InputLabel>
                        <Select
                            value={analysisMode}
                            label="Analysis Mode"
                            onChange={(e) => setAnalysisMode(e.target.value as 'single' | 'range')}
                        >
                            <MenuItem value="single">Single Date</MenuItem>
                            <MenuItem value="range">Date Range</MenuItem>
                        </Select>
                    </FormControl>

                    {analysisMode === 'single' ? (
                        <TextField
                            fullWidth
                            label="Analysis Date"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ mb: 2 }}
                        />
                    ) : (
                        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                            <TextField
                                fullWidth
                                label="Start Date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                fullWidth
                                label="End Date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Stack>
                    )}

                    {isAnalyzing && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                {currentStep}
                            </Typography>
                            <CircularProgress size={24} />
                        </Box>
                    )}

                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<PlayArrow />}
                            onClick={analysisMode === 'single' ? runSingleDateAnalysis : runDateRangeAnalysis}
                            disabled={isAnalyzing || !localDataInfo}
                        >
                            {isAnalyzing ? 'מנתח...' : 
                             analysisMode === 'single' ? 'Analyze Date' : 'Analyze Range'}
                        </Button>

                        {results.length > 0 && (
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<Save />}
                                onClick={saveToFirebase}
                                disabled={isSaving}
                            >
                                {isSaving ? 'שומר...' : 'Save to Firebase'}
                            </Button>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* Results */}
            {results.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            📊 Weekly Analysis Results ({results.length} stocks)
                        </Typography>

                        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Stock</TableCell>
                                        <TableCell>Current Price</TableCell>
                                        <TableCell>BSpy</TableCell>
                                        <TableCell>CAtrPrice</TableCell>
                                        <TableCell>DSignals</TableCell>
                                        <TableCell>EAdx</TableCell>
                                        <TableCell>Final Score</TableCell>
                                        <TableCell>Week 1</TableCell>
                                        <TableCell>Week 2</TableCell>
                                        <TableCell>Week 3</TableCell>
                                        <TableCell>Week 4</TableCell>
                                        <TableCell>Week 5</TableCell>
                                        <TableCell>Date</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {results.map((result, index) => (
                                        <TableRow key={`${result.symbol}-${index}`}>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                    {result.symbol}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${result.currentPrice.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongSpyScore.toFixed(1)}
                                                    color={
                                                        result.LongSpyScore >= 70 ? 'success' :
                                                        result.LongSpyScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongAtrPriceScore.toFixed(1)}
                                                    color={
                                                        result.LongAtrPriceScore >= 70 ? 'success' :
                                                        result.LongAtrPriceScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongMomentumScore.toFixed(1)}
                                                    color={
                                                        result.LongMomentumScore >= 70 ? 'success' :
                                                        result.LongMomentumScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.LongAdxScore.toFixed(1)}
                                                    color={
                                                        result.LongAdxScore >= 70 ? 'success' :
                                                        result.LongAdxScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={result.finalScore.toFixed(1)}
                                                    color={
                                                        result.finalScore >= 70 ? 'success' :
                                                        result.finalScore <= 30 ? 'error' : 'default'
                                                    }
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${result.week_1.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${result.week_2.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${result.week_3.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${result.week_4.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    ${result.week_5.toFixed(2)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {result.candleDate}
                                                </Typography>
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
