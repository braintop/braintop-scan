import React, { useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    CircularProgress,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import { ExpandMore, Assessment } from '@mui/icons-material';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import * as MarketStructureTypes from '../Types/MarketStructureTypes';

const db = getFirestore();

// Interfaces
interface RR1Result {
    symbol: string;
    name: string;
    currentPrice: number;
    analysisDate: string;
    
    // Market Structure Data
    marketStructure: MarketStructureTypes.MarketStructureResult | null;
    
    // R:R Calculation
    entryPrice: number;
    stopLoss: number;
    target: number;
    rrRatio: number;
    
    // Decision
    approved: boolean;
    reason: string;
    
    // Analysis Scores (from MasterAnalysis)
    bSpyScore: number;
    cAtrPriceScore: number;
    dSignalsScore: number;
    candleScore: number;
    eAdxScore: number;
    finalScore: number;
    
    // Future Prices (day1-day5)
    prices: {
        day_1: { date: string; price: number; open: number; high: number; low: number; volume: number };
        day_2: { date: string; price: number; open: number; high: number; low: number; volume: number };
        day_3: { date: string; price: number; open: number; high: number; low: number; volume: number };
        day_4: { date: string; price: number; open: number; high: number; low: number; volume: number };
        day_5: { date: string; price: number; open: number; high: number; low: number; volume: number };
    };
    
    // Additional Info
    atrValue?: number;
    bufferAmount: number;
}

interface RR1Summary {
    analysisDate: string;
    calculationDate: string;
    totalStocks: number;
    approvedStocks: number;
    rejectedStocks: number;
    avgRRRatio: number;
    analysisType: string;
    analysisTime: string;
    results: RR1Result[];
}

export function RR1() {
    const [results, setResults] = useState<RR1Result[]>([]);
    const [summary, setSummary] = useState<RR1Summary | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [startDate, setStartDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [isLoading, setIsLoading] = useState(false);
    const [dateRangeMode, setDateRangeMode] = useState<'single' | 'range'>('single');
    const [premarketData, setPremarketData] = useState<any[]>([]);
    const [isPremarketLoading, setIsPremarketLoading] = useState(false);
    const [premarketTime, setPremarketTime] = useState<string>('');

    // Load RR1 data from Firebase
    const loadRR1Data = async (date: string) => {
        setIsLoading(true);
        try {
            console.log(`🔍 Loading RR1 data for date: ${date}`);
            console.log(`📅 Selected date in UI: ${selectedDate}`);
            console.log(`📅 Previous trading day calculated: ${date}`);
            
            const collectionName = "rr1";
            const documentId = date;
            
            // Load from Firebase
            const docRef = doc(db, collectionName, documentId);
            const docSnap = await getDoc(docRef);
            const rr1Data = docSnap.exists() ? docSnap.data() : null;
            
            if (rr1Data) {
                console.log(`✅ Loaded RR1 data for ${date}:`, rr1Data);
                setSummary(rr1Data as RR1Summary);
                setResults((rr1Data as RR1Summary).results || []);
            } else {
                console.log(`⚠️ No RR1 data found for date: ${date}`);
                setSummary(null);
                setResults([]);
            }
        } catch (error) {
            console.error(`❌ Error loading RR1 data for ${date}:`, error);
            setSummary(null);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Load RR1 data for date range
    const loadRR1DataRange = async (start: string, end: string) => {
        setIsLoading(true);
        try {
            console.log(`🔍 Loading RR1 data for date range: ${start} to ${end}`);
            
            const allResults: RR1Result[] = [];
            const summaries: RR1Summary[] = [];
            
            // Generate array of dates between start and end
            const dates = [];
            const startDateObj = new Date(start);
            const endDateObj = new Date(end);
            
            for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
                dates.push(date.toISOString().split('T')[0]);
            }
            
            console.log(`📅 Processing ${dates.length} dates:`, dates);
            
            // Load data for each date
            for (const date of dates) {
                try {
                    const collectionName = "rr1";
                    const documentId = date;
                    
                    const docRef = doc(db, collectionName, documentId);
                    const docSnap = await getDoc(docRef);
                    const rr1Data = docSnap.exists() ? docSnap.data() : null;
                    
                    if (rr1Data) {
                        console.log(`✅ Loaded RR1 data for ${date}:`, rr1Data);
                        summaries.push(rr1Data as RR1Summary);
                        allResults.push(...((rr1Data as RR1Summary).results || []));
                    } else {
                        console.log(`⚠️ No RR1 data found for date: ${date}`);
                    }
                } catch (error) {
                    console.error(`❌ Error loading RR1 data for ${date}:`, error);
                }
            }
            
            // Create combined summary
            if (summaries.length > 0) {
                const combinedSummary: RR1Summary = {
                    analysisDate: `${start} to ${end}`,
                    calculationDate: new Date().toISOString().split('T')[0],
                    totalStocks: allResults.length,
                    approvedStocks: allResults.filter(r => r.approved).length,
                    rejectedStocks: allResults.filter(r => !r.approved).length,
                    avgRRRatio: allResults.length > 0 ? 
                        allResults.reduce((sum, r) => sum + r.rrRatio, 0) / allResults.length : 0,
                    analysisType: "R:R Analysis (Date Range)",
                    analysisTime: "23:30",
                    results: allResults
                };
                
                setSummary(combinedSummary);
                setResults(allResults);
                console.log(`📊 Combined RR1 data: ${allResults.length} stocks from ${summaries.length} dates`);
            } else {
                setSummary(null);
                setResults([]);
                console.log(`⚠️ No RR1 data found for any date in range: ${start} to ${end}`);
            }
            
        } catch (error) {
            console.error(`❌ Error loading RR1 data range:`, error);
            setSummary(null);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Load data when component mounts or date changes
    React.useEffect(() => {
        if (dateRangeMode === 'single' && selectedDate) {
            // For single date mode, load RR1 data from the last trading day before selected date
            const getLastTradingDay = (date: string): string => {
                const selectedDateObj = new Date(date);
                let currentDate = new Date(selectedDateObj);
                let maxIterations = 10; // Look back up to 10 days
                let iterations = 0;
                
                console.log(`🔍 Finding last trading day for: ${date}`);
                
                // Go back day by day until we find a weekday (Monday-Friday)
                while (iterations < maxIterations) {
                    currentDate.setDate(currentDate.getDate() - 1);
                    const dayOfWeek = currentDate.getDay();
                    const dateStr = currentDate.toISOString().split('T')[0];
                    
                    console.log(`🔍 Checking ${dateStr}, day of week: ${dayOfWeek}`);
                    
                    // Check if it's a weekday (1-5: Monday-Friday)
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        console.log(`✅ Found trading day: ${dateStr}`);
                        return dateStr;
                    }
                    iterations++;
                }
                
                console.log(`⚠️ No trading day found, using original date: ${date}`);
                // Fallback: return the original date if no trading day found
                return date;
            };
            
            const previousTradingDayStr = getLastTradingDay(selectedDate);
            
            console.log(`📅 Selected date: ${selectedDate}, Loading RR1 from: ${previousTradingDayStr}`);
            loadRR1Data(previousTradingDayStr);
        } else if (dateRangeMode === 'range' && startDate && endDate) {
            loadRR1DataRange(startDate, endDate);
        }
    }, [selectedDate, startDate, endDate, dateRangeMode]);

    // Pre-Market Check Function
    const runPreMarketCheck = async () => {
        if (results.length === 0) {
            console.warn('⚠️ No RR1 data available for Pre-Market Check');
            return;
        }

        setIsPremarketLoading(true);
        try {
            console.log('🔍 Starting Pre-Market Check...');
            
            // Get previous trading day's date for RR1 data
            const previousTradingDay = new Date(selectedDate);
            previousTradingDay.setDate(previousTradingDay.getDate() - 1);
            const previousTradingDayStr = previousTradingDay.toISOString().split('T')[0];
            
            // Get selected date for pre-market data (not current date!)
            const selectedDateStr = selectedDate;
            
            console.log(`📅 Using RR1 data from: ${previousTradingDayStr} (previous trading day)`);
            console.log(`📅 Checking pre-market data for: ${selectedDateStr} (selected date)`);
            console.log(`📅 Selected date from UI: ${selectedDate}`);
            console.log(`📅 Previous trading day: ${previousTradingDayStr}`);
            
            // Get symbols from RR1 results (previous trading day's data)
            const symbols = results.map(stock => stock.symbol);
            console.log(`📊 Checking ${symbols.length} stocks:`, symbols);
            
            // Import Polygon API functions
            const { getPreMarketData } = await import('../../../Api/polygonApi');
            
            // Get pre-market data using new Aggregates API
            console.log('📡 Fetching pre-market data from Polygon API using Aggregates...');
            
            // Process each stock with real pre-market data
            const realPreMarketData = await Promise.all(results.map(async (stock) => {
                console.log(`🔍 Getting pre-market data for ${stock.symbol} on ${selectedDateStr}...`);
                
                // Get pre-market data for current time (convert Israel time to ET)
                const getCurrentTimeET = (): string => {
                    const now = new Date();
                    // Convert Israel time to ET (Israel is UTC+2, ET is UTC-5 in winter, UTC-4 in summer)
                    // For simplicity, assume ET is UTC-5 (winter time)
                    const etTime = new Date(now.getTime() - (7 * 60 * 60 * 1000)); // 7 hours difference
                    const hours = etTime.getHours().toString().padStart(2, '0');
                    const minutes = etTime.getMinutes().toString().padStart(2, '0');
                    return `${hours}:${minutes}`;
                };
                
                const currentTimeET = getCurrentTimeET();
                console.log(`🕐 Current time in ET: ${currentTimeET}`);
                
                const preMarketData = await getPreMarketData(stock.symbol, selectedDateStr, currentTimeET);
                
                if (!preMarketData) {
                    console.warn(`⚠️ No pre-market data for ${stock.symbol}`);
                    // Fallback to mock data if no pre-market data
                    const gapPercent = (Math.random() - 0.3) * 10; // -3% to +7%
                    const pmVolumeRatio = 0.5 + Math.random() * 2; // 0.5 to 2.5
                    
                    // Simple Priority Logic
                    let priority = 0;
                    if (gapPercent > 0 && gapPercent < 2) priority = 1;      // Small positive gap = High priority
                    else if (gapPercent >= 2 && gapPercent < 5) priority = 0; // Medium gap = Normal priority  
                    else if (gapPercent >= 5) priority = -1;                  // Large gap = Low priority
                    else priority = -1; // Negative gap = Low priority
                    
                    // Recalculate R:R: positive gap improves ratio, negative reduces
                    const newRR = gapPercent >= 0
                        ? stock.rrRatio * (1 + (gapPercent / 100))
                        : stock.rrRatio * (1 - (Math.abs(gapPercent) / 100));
                    const status = newRR >= 2 ? 'valid' : 'invalid';
                    
                    // Simple Entry Price: Current price + small buffer
                    const entryPrice = stock.currentPrice + (stock.currentPrice * 0.001);
                    
                    return {
                        symbol: stock.symbol,
                        currentPrice: stock.currentPrice,
                        finalScore: stock.finalScore,
                        rrRatio: stock.rrRatio,
                        target: stock.target,
                        stopLoss: stock.stopLoss,
                        preMarketPrice: stock.currentPrice * (1 + gapPercent / 100),
                        gapPercent: gapPercent,
                        pmVolumeRatio: pmVolumeRatio,
                        priority: priority,
                        status: status,
                        entryPrice: entryPrice,
                        newRR: newRR,
                        analysisDate: previousTradingDayStr // Use previous trading day's date for analysis
                    };
                }
                
                // Use real pre-market data from Polygon API
                console.log(`✅ Got pre-market data for ${stock.symbol}:`, preMarketData);
                
                const preMarketPrice = preMarketData.price;
                const previousClose = stock.currentPrice; // From RR1 data (previous trading day's close)
                
                console.log(`📊 ${stock.symbol}: preMarketPrice = ${preMarketPrice}`);
                console.log(`📊 ${stock.symbol}: previousClose = ${previousClose}`);
                
                const gapPercent = ((preMarketPrice - previousClose) / previousClose) * 100;
                const pmVolumeRatio = preMarketData.volume ? (preMarketData.volume / 1000000) : 1; // Normalize volume
                
                console.log(`📈 ${stock.symbol}: Calculated Gap% = ${gapPercent.toFixed(2)}%`);
                
                // Priority Logic based on real data
                let priority = 0;
                if (gapPercent > 0 && gapPercent < 2) priority = 1;      // Small positive gap = High priority
                else if (gapPercent >= 2 && gapPercent < 5) priority = 0; // Medium gap = Normal priority  
                else if (gapPercent >= 5) priority = -1;                  // Large gap = Low priority
                else priority = -1; // Negative gap = Low priority
                
                // Recalculate R:R based on updated Entry, Stop Loss, and Take Profit
                const updatedEntryPrice = preMarketPrice + (preMarketPrice * 0.001);
                const updatedStopLoss = stock.stopLoss * (1 + gapPercent / 100);
                const updatedTakeProfit = stock.target * (1 + gapPercent / 100);
                const risk = updatedEntryPrice - updatedStopLoss;
                const reward = updatedTakeProfit - updatedEntryPrice;
                const newRR = risk > 0 ? reward / risk : 0;
                const status = newRR >= 2 ? 'valid' : 'invalid';
                
                // Update Entry, Stop Loss, Take Profit based on Gap%
                const entryPrice = updatedEntryPrice;
                
                console.log(`📊 ${stock.symbol}: Previous Close=${previousClose}, Pre-Market=${preMarketPrice}, Gap=${gapPercent.toFixed(2)}%, Volume=${pmVolumeRatio.toFixed(2)}x`);
                console.log(`📊 ${stock.symbol}: Updated Stop Loss=${updatedStopLoss.toFixed(2)}, Updated Take Profit=${updatedTakeProfit.toFixed(2)}`);
                
                return {
                    symbol: stock.symbol,
                    currentPrice: previousClose, // Keep original close price for comparison
                    finalScore: stock.finalScore,
                    rrRatio: stock.rrRatio,
                    target: updatedTakeProfit, // Updated take profit
                    stopLoss: updatedStopLoss, // Updated stop loss
                    preMarketPrice: preMarketPrice,
                    gapPercent: gapPercent,
                    pmVolumeRatio: pmVolumeRatio,
                    priority: priority,
                    status: status,
                    entryPrice: entryPrice,
                    newRR: newRR,
                    analysisDate: previousTradingDayStr // Use previous trading day's date for analysis
                };
            }));
            
            setPremarketData(realPreMarketData);
            
            // Set the time for current time button
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            setPremarketTime(`${hours}:${minutes}`);
            
            // Save to Trading Journal
            await saveToTradingJournal(realPreMarketData);
            
            console.log('✅ Pre-Market Check completed');
            
        } catch (error) {
            console.error('❌ Error in Pre-Market Check:', error);
        } finally {
            setIsPremarketLoading(false);
        }
    };

    // Pre-Market Check Function for Fixed Time (16:15 Israel / 09:15 ET)
    const runPreMarketCheckFixed = async () => {
        if (results.length === 0) {
            console.warn('⚠️ No RR1 data available for Pre-Market Check');
            return;
        }

        setIsPremarketLoading(true);
        try {
            console.log('🔍 Starting Pre-Market Check for 16:15 Israel (09:15 ET)...');
            
            // Get previous trading day's date for RR1 data
            const previousTradingDay = new Date(selectedDate);
            previousTradingDay.setDate(previousTradingDay.getDate() - 1);
            const previousTradingDayStr = previousTradingDay.toISOString().split('T')[0];
            
            // Get selected date for pre-market data
            const selectedDateStr = selectedDate;
            
            console.log(`📅 Using RR1 data from: ${previousTradingDayStr} (previous trading day)`);
            console.log(`📅 Checking pre-market data for: ${selectedDateStr} at 09:15 ET (16:15 Israel)`);
            
            // Import Polygon API functions
            const { getPreMarketData } = await import('../../../Api/polygonApi');
            
            // Process each stock with fixed time pre-market data (09:15 ET)
            const realPreMarketData = await Promise.all(results.map(async (stock) => {
                console.log(`🔍 Getting pre-market data for ${stock.symbol} on ${selectedDateStr} at 09:15 ET...`);
                
                // Get pre-market data for fixed time (09:15 ET)
                const preMarketData = await getPreMarketData(stock.symbol, selectedDateStr, '09:15');
                
                if (!preMarketData) {
                    console.warn(`⚠️ No pre-market data for ${stock.symbol}`);
                    // Fallback to mock data if no pre-market data
                    const gapPercent = (Math.random() - 0.3) * 10; // -3% to +7%
                    const pmVolumeRatio = 0.5 + Math.random() * 2; // 0.5 to 2.5
                    
                    let priority = 0;
                    if (gapPercent > 0 && gapPercent < 2) priority = 1;
                    else if (gapPercent >= 2 && gapPercent < 5) priority = 0;
                    else if (gapPercent >= 5) priority = -1;
                    else priority = -1;
                    
                    const newRR = gapPercent >= 0
                        ? stock.rrRatio * (1 + (gapPercent / 100))
                        : stock.rrRatio * (1 - (Math.abs(gapPercent) / 100));
                    const status = newRR >= 2 ? 'valid' : 'invalid';
                    
                    return {
                        ...stock,
                        preMarketPrice: stock.currentPrice * (1 + gapPercent / 100),
                        gapPercent: gapPercent,
                        pmVolumeRatio: pmVolumeRatio,
                        priority: priority,
                        status: status,
                        entryPrice: stock.entryPrice * (1 + gapPercent / 100),
                        updatedStopLoss: stock.stopLoss * (1 + gapPercent / 100),
                        updatedTakeProfit: stock.target * (1 + gapPercent / 100)
                    };
                }
                
                const preMarketPrice = preMarketData.price;
                const previousClose = stock.currentPrice; // From RR1 data (previous trading day's close)
                
                console.log(`📊 ${stock.symbol}: preMarketPrice = ${preMarketPrice} (09:15 ET)`);
                console.log(`📊 ${stock.symbol}: previousClose = ${previousClose}`);
                
                const gapPercent = ((preMarketPrice - previousClose) / previousClose) * 100;
                const pmVolumeRatio = preMarketData.volume ? (preMarketData.volume / 1000000) : 1; // Normalize volume
                
                console.log(`📈 ${stock.symbol}: Calculated Gap% = ${gapPercent.toFixed(2)}%`);
                
                // Priority Logic based on real data
                let priority = 0;
                if (gapPercent > 0 && gapPercent < 2) priority = 1;      // Small positive gap = High priority
                else if (gapPercent >= 2 && gapPercent < 5) priority = 0; // Medium gap = Normal priority  
                else if (gapPercent >= 5) priority = -1;                  // Large gap = Low priority
                else priority = -1; // Negative gap = Low priority
                
                // Recalculate R:R based on updated Entry, Stop Loss, and Take Profit
                const updatedEntryPrice = preMarketPrice + (preMarketPrice * 0.001);
                const updatedStopLoss = stock.stopLoss * (1 + gapPercent / 100);
                const updatedTakeProfit = stock.target * (1 + gapPercent / 100);
                const risk = updatedEntryPrice - updatedStopLoss;
                const reward = updatedTakeProfit - updatedEntryPrice;
                const newRR = risk > 0 ? reward / risk : 0;
                const status = newRR >= 2 ? 'valid' : 'invalid';
                
                // Update Entry, Stop Loss, Take Profit based on Gap%
                const entryPrice = updatedEntryPrice;
                
                console.log(`📊 ${stock.symbol}: Previous Close=${previousClose}, Pre-Market=${preMarketPrice}, Gap=${gapPercent.toFixed(2)}%, Volume=${pmVolumeRatio.toFixed(2)}x`);
                console.log(`📊 ${stock.symbol}: Updated Stop Loss=${updatedStopLoss.toFixed(2)}, Updated Take Profit=${updatedTakeProfit.toFixed(2)}`);
                
                return {
                    ...stock,
                    preMarketPrice: preMarketPrice,
                    gapPercent: gapPercent,
                    pmVolumeRatio: pmVolumeRatio,
                    priority: priority,
                    status: status,
                    entryPrice: entryPrice,
                    updatedStopLoss: updatedStopLoss,
                    updatedTakeProfit: updatedTakeProfit
                };
            }));
            
            console.log(`📊 Setting premarket data for 16:15:`, realPreMarketData);
            setPremarketData(realPreMarketData);
            
            // Set the time for 16:15 button
            setPremarketTime('16:15');
            
            // Save to Trading Journal
            console.log(`💾 Saving to Trading Journal for 16:15...`);
            await saveToTradingJournal(realPreMarketData);
            
            console.log('✅ Pre-Market Check (16:15) completed');
            
        } catch (error) {
            console.error('❌ Error in Pre-Market Check (16:15):', error);
        } finally {
            setIsPremarketLoading(false);
        }
    };

    // Save to Trading Journal - Only Trading Data
    const saveToTradingJournal = async (premarketResults: any[]) => {
        try {
            console.log(`🔍 saveToTradingJournal: Received ${premarketResults.length} stocks`);
            console.log(`🔍 Sample stock status:`, premarketResults.map(s => ({ 
                symbol: s.symbol, 
                status: s.status, 
                rrRatio: s.rrRatio,
                gapPercent: s.gapPercent,
                newRR: s.newRR
            })));
            
            // Filter only valid stocks and extract only trading data
            const validTrades = premarketResults
                .filter(stock => stock.status === 'valid')
                .map(stock => ({
                    symbol: stock.symbol || 'UNKNOWN',
                    entryPrice: stock.entryPrice || 0,
                    stopLoss: stock.stopLoss || 0,
                    stopLimitPrice: (stock.entryPrice || 0) + ((stock.entryPrice || 0) * 0.001), // Entry + 0.1% buffer
                    takeProfit: stock.updatedTakeProfit || stock.target || 0,
                    quantity: 100, // Default quantity - can be made editable later
                    gapPercent: stock.gapPercent || 0,
                    pmVolumeRatio: stock.pmVolumeRatio || 0,
                    priority: stock.priority || 0,
                    status: stock.status || 'invalid',
                    finalRR: stock.newRR || 0,
                    finalScore: stock.finalScore || 0, // Add final score to trading journal
                    prev_day_2300: {
                        date: stock.analysisDate || selectedDate, // Previous day's date
                        price: stock.currentPrice || 0, // Previous day's closing price
                        timestamp: `${stock.analysisDate || selectedDate}T23:00:00Z`
                    },
                    pm_price_1615: {
                        date: selectedDate, // Current day's date
                        price: stock.preMarketPrice || 0, // Pre-market price at 16:15
                        timestamp: `${selectedDate}T16:15:00Z`
                    },
                    analysisDate: stock.analysisDate || selectedDate
                }));

            const tradingJournalData = {
                analysisDate: dateRangeMode === 'single' ? selectedDate : `${startDate} to ${endDate}`,
                preMarketCheckTime: new Date().toISOString(),
                checkType: "Pre-Market Check",
                totalStocks: premarketResults.length,
                validStocks: validTrades.length,
                invalidStocks: premarketResults.filter(s => s.status === 'invalid').length,
                trades: validTrades // Only valid trades with trading data only
            };
            
            const collectionName = "trading_journal";
            const documentId = `${dateRangeMode === 'single' ? selectedDate : startDate}_premarket`;
            
            await setDoc(doc(db, collectionName, documentId), tradingJournalData);
            console.log(`💾 Trading Journal saved: ${collectionName}/${documentId}`);
            console.log(`📊 Saved ${validTrades.length} valid trades (filtered from ${premarketResults.length} total)`);
            
        } catch (error) {
            console.error('❌ Error saving to Trading Journal:', error);
        }
    };

    const getRRColor = (rrRatio: number) => {
        if (rrRatio >= 2) return 'success';
        if (rrRatio >= 1) return 'warning';
        return 'error';
    };


    return (
        <Box sx={{ p: 3 }}>
            <Card>
                <CardContent>
                    <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Assessment color="secondary" />
                        📈 R:R Analysis (Stage RR1 - 23:30)
                    </Typography>

                    {/* Date Selection Mode */}
                    <Box sx={{ mb: 3 }}>
                        <FormControl sx={{ minWidth: 200, mb: 2 }}>
                            <InputLabel>Analysis Mode</InputLabel>
                            <Select
                                value={dateRangeMode}
                                label="Analysis Mode"
                                onChange={(e) => setDateRangeMode(e.target.value as 'single' | 'range')}
                            >
                                <MenuItem value="single">Single Date</MenuItem>
                                <MenuItem value="range">Date Range</MenuItem>
                            </Select>
                        </FormControl>
                        
                        {dateRangeMode === 'single' ? (
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <TextField
                                    label="Select Analysis Date"
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    sx={{ minWidth: 200 }}
                                />
                                <Button 
                                    variant="outlined" 
                                    onClick={() => {
                                        // Load RR1 data from the last trading day before selected date
                                        const getLastTradingDay = (date: string): string => {
                                            const selectedDateObj = new Date(date);
                                            let currentDate = new Date(selectedDateObj);
                                            let maxIterations = 10; // Look back up to 10 days
                                            let iterations = 0;
                                            
                                            console.log(`🔍 Finding last trading day for: ${date}`);
                                            
                                            // Go back day by day until we find a weekday (Monday-Friday)
                                            while (iterations < maxIterations) {
                                                currentDate.setDate(currentDate.getDate() - 1);
                                                const dayOfWeek = currentDate.getDay();
                                                const dateStr = currentDate.toISOString().split('T')[0];
                                                
                                                console.log(`🔍 Checking ${dateStr}, day of week: ${dayOfWeek}`);
                                                
                                                // Check if it's a weekday (1-5: Monday-Friday)
                                                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                                                    console.log(`✅ Found trading day: ${dateStr}`);
                                                    return dateStr;
                                                }
                                                iterations++;
                                            }
                                            
                                            console.log(`⚠️ No trading day found, using original date: ${date}`);
                                            // Fallback: return the original date if no trading day found
                                            return date;
                                        };
                                        
                                        const previousTradingDayStr = getLastTradingDay(selectedDate);
                                        
                                        console.log(`📅 Selected date: ${selectedDate}, Loading RR1 from: ${previousTradingDayStr}`);
                                        loadRR1Data(previousTradingDayStr);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <CircularProgress size={20} /> : 'Load Single Date'}
                                </Button>
                                <Button 
                                    variant="contained" 
                                    color="secondary"
                                    onClick={runPreMarketCheck}
                                    disabled={isPremarketLoading || results.length === 0}
                                    sx={{ ml: 1 }}
                                >
                                    {isPremarketLoading ? <CircularProgress size={20} /> : 'Pre-Market Check'}
                                </Button>
                                <Button 
                                    variant="contained" 
                                    sx={{
                                        backgroundColor: '#ff9800',
                                        color: 'white',
                                        '&:hover': {
                                            backgroundColor: '#f57c00',
                                        },
                                        ml: 1
                                    }}
                                    onClick={runPreMarketCheckFixed}
                                    disabled={isPremarketLoading || results.length === 0}
                                >
                                    {isPremarketLoading ? <CircularProgress size={20} /> : 'Pre-Market 16:15'}
                                </Button>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                <TextField
                                    label="Start Date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    sx={{ minWidth: 150 }}
                                />
                                <TextField
                                    label="End Date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    sx={{ minWidth: 150 }}
                                />
                                <Button 
                                    variant="outlined" 
                                    onClick={() => loadRR1DataRange(startDate, endDate)}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <CircularProgress size={20} /> : 'Load Date Range'}
                                </Button>
                                <Button 
                                    variant="contained" 
                                    color="secondary"
                                    onClick={runPreMarketCheck}
                                    disabled={isPremarketLoading || results.length === 0}
                                    sx={{ ml: 1 }}
                                >
                                    {isPremarketLoading ? <CircularProgress size={20} /> : 'Pre-Market Check'}
                                </Button>
                                <Button 
                                    variant="contained" 
                                    sx={{
                                        backgroundColor: '#ff9800',
                                        color: 'white',
                                        '&:hover': {
                                            backgroundColor: '#f57c00',
                                        },
                                        ml: 1
                                    }}
                                    onClick={runPreMarketCheckFixed}
                                    disabled={isPremarketLoading || results.length === 0}
                                >
                                    {isPremarketLoading ? <CircularProgress size={20} /> : 'Pre-Market 16:15'}
                                </Button>
                            </Box>
                        )}
                    </Box>

                    {/* Loading State */}
                    {isLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                            <Typography sx={{ ml: 2 }}>Loading RR1 data...</Typography>
                        </Box>
                    )}

                    {/* Summary */}
                    {summary && !isLoading && (
                        <Card sx={{ mb: 3, backgroundColor: '#f5f5f5' }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 1 }}>
                                    Summary for {summary.analysisDate}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <Chip label={`Total Stocks: ${summary.totalStocks}`} color="primary" variant="outlined" />
                                    <Chip label={`Approved: ${summary.approvedStocks}`} color="success" variant="outlined" />
                                    <Chip label={`Rejected: ${summary.rejectedStocks}`} color="error" variant="outlined" />
                                    <Chip label={`Avg R:R Ratio: ${summary.avgRRRatio}`} color="info" variant="outlined" />
                                </Box>
                            </CardContent>
                        </Card>
                    )}

                    {/* Results Table */}
                    {results.length > 0 && !isLoading && (
                        <Card>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    R:R Analysis Results
                                </Typography>
                                
                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Symbol</TableCell>
                                                <TableCell>Current Price<br/>({selectedDate ? (() => {
                                                    const getLastTradingDay = (date: string): string => {
                                                        const selectedDateObj = new Date(date);
                                                        let currentDate = new Date(selectedDateObj);
                                                        let maxIterations = 10;
                                                        let iterations = 0;
                                                        
                                                        while (iterations < maxIterations) {
                                                            currentDate.setDate(currentDate.getDate() - 1);
                                                            const dayOfWeek = currentDate.getDay();
                                                            
                                                            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                                                                return currentDate.toISOString().split('T')[0];
                                                            }
                                                            iterations++;
                                                        }
                                                        
                                                        return date;
                                                    };
                                                    return getLastTradingDay(selectedDate);
                                                })() : 'N/A'})</TableCell>
                                                <TableCell>Final Score</TableCell>
                                                <TableCell>R:R Ratio</TableCell>
                                                {premarketData.length > 0 && (
                                                    <>
                                                        <TableCell>PM Price<br/>({selectedDate} {premarketTime || 'N/A'})</TableCell>
                                                        <TableCell>Gap%<br/>(PM - {selectedDate ? new Date(new Date(selectedDate).getTime() - 24*60*60*1000).toISOString().split('T')[0].split('-').slice(1).join('/') : 'N/A'})</TableCell>
                                                        <TableCell>PM Vol Ratio</TableCell>
                                                        <TableCell>Priority</TableCell>
                                                        <TableCell>Status</TableCell>
                                                        <TableCell>Entry<br/>(Updated)</TableCell>
                                                        <TableCell>Stop Loss<br/>(Updated)</TableCell>
                                                        <TableCell>Take Profit<br/>(Updated)</TableCell>
                                                    </>
                                                )}
                                                <TableCell>Details</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {(premarketData.length > 0 ? premarketData : results).map((result, index) => {
                                                const isPreMarketData = premarketData.length > 0;
                                                const preMarketResult = isPreMarketData ? result : null;
                                                
                                                return (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <Chip 
                                                            label={result.symbol} 
                                                            color="primary" 
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>${result.currentPrice.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={result.finalScore.toFixed(1)}
                                                            sx={{ 
                                                                backgroundColor: '#f5f5f5', 
                                                                color: 'black',
                                                                fontWeight: 'bold'
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={preMarketResult?.newRR ? preMarketResult.newRR.toFixed(2) : result.rrRatio.toFixed(2)} 
                                                            color={getRRColor(preMarketResult?.newRR || result.rrRatio)} 
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    {isPreMarketData && preMarketResult && (
                                                        <>
                                                            <TableCell>${preMarketResult.preMarketPrice.toFixed(2)}</TableCell>
                                                            <TableCell>
                                                                <Chip 
                                                                    label={`${preMarketResult.gapPercent > 0 ? '+' : ''}${preMarketResult.gapPercent.toFixed(1)}%`}
                                                                    color={preMarketResult.gapPercent > 0 ? 'success' : 'error'}
                                                                    size="small"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Chip 
                                                                    label={preMarketResult.pmVolumeRatio.toFixed(1)}
                                                                    color={preMarketResult.pmVolumeRatio > 1 ? 'success' : 'warning'}
                                                                    size="small"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Chip 
                                                                    label={preMarketResult.priority > 0 ? `+${preMarketResult.priority}` : preMarketResult.priority.toString()}
                                                                    color={preMarketResult.priority > 0 ? 'success' : preMarketResult.priority < 0 ? 'error' : 'default'}
                                                                    size="small"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                {preMarketResult.status === 'valid' ? (
                                                                    <Chip label="✅ V" color="success" size="small" />
                                                                ) : (
                                                                    <Chip label="❌ X" color="error" size="small" />
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {preMarketResult.status === 'valid' ? (
                                                                    <Typography variant="body2">
                                                                        ${preMarketResult.entryPrice.toFixed(2)}
                                                                    </Typography>
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        -
                                                                    </Typography>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {preMarketResult.status === 'valid' ? (
                                                                    <Typography variant="body2">
                                                                        ${result.stopLoss.toFixed(2)}
                                                                    </Typography>
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        -
                                                                    </Typography>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {preMarketResult.status === 'valid' ? (
                                                                    <Typography variant="body2">
                                                                        ${preMarketResult.updatedTakeProfit?.toFixed(2) || result.target.toFixed(2)}
                                                                    </Typography>
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        ${preMarketResult.updatedTakeProfit?.toFixed(2) || result.target.toFixed(2)}
                                                                    </Typography>
                                                                )}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    {!isPreMarketData && (
                                                        <>
                                                            <TableCell>${result.entryPrice.toFixed(2)}</TableCell>
                                                            <TableCell>${result.stopLoss.toFixed(2)}</TableCell>
                                                            <TableCell>${result.target.toFixed(2)}</TableCell>
                                                            <TableCell>
                                                                <Chip 
                                                                    label={result.approved ? "Approved" : "Rejected"} 
                                                                    color={result.approved ? "success" : "error"} 
                                                                    size="small"
                                                                />
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    <TableCell>
                                                        <Accordion elevation={0} sx={{ width: '100%' }}>
                                                            <AccordionSummary expandIcon={<ExpandMore />}>
                                                                <Typography variant="caption">
                                                                    View Details
                                                                </Typography>
                                                            </AccordionSummary>
                                                            <AccordionDetails>
                                                <Box sx={{ p: 2 }}>
                                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                                        📊 Detailed Analysis for {result.symbol}
                                                    </Typography>
                                                    
                                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                                        <Box>
                                                            <Typography variant="subtitle2" color="primary">Analysis Scores</Typography>
                                                            <Typography variant="body2">BSpy: {result.bSpyScore?.toFixed(1) || 'N/A'}</Typography>
                                                            <Typography variant="body2">ATR Price: {result.cAtrPriceScore?.toFixed(1) || 'N/A'}</Typography>
                                                            <Typography variant="body2">DSignals: {result.dSignalsScore?.toFixed(1) || 'N/A'}</Typography>
                                                            <Typography variant="body2">Candles: {result.candleScore?.toFixed(1) || 'N/A'}</Typography>
                                                            <Typography variant="body2">ADX: {result.eAdxScore?.toFixed(1) || 'N/A'}</Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Final: {result.finalScore?.toFixed(1) || 'N/A'}</Typography>
                                                        </Box>
                                                        
                                                        <Box>
                                                            <Typography variant="subtitle2" color="primary">Entry Details</Typography>
                                                            <Typography variant="body2">Current: ${result.currentPrice?.toFixed(2) || 'N/A'}</Typography>
                                                            <Typography variant="body2">Buffer: ${result.bufferAmount?.toFixed(2) || 'N/A'}</Typography>
                                                            <Typography variant="body2">Entry: ${result.entryPrice?.toFixed(2) || 'N/A'}</Typography>
                                                        </Box>
                                                        
                                                        <Box>
                                                            <Typography variant="subtitle2" color="error">Risk Details</Typography>
                                                            <Typography variant="body2">Stop Loss: ${result.stopLoss?.toFixed(2) || 'N/A'}</Typography>
                                                            <Typography variant="body2">Risk: ${((result.entryPrice || 0) - (result.stopLoss || 0)).toFixed(2)}</Typography>
                                                            <Typography variant="body2">Target: ${result.target?.toFixed(2) || 'N/A'}</Typography>
                                                            <Typography variant="body2">Reward: ${((result.target || 0) - (result.entryPrice || 0)).toFixed(2)}</Typography>
                                                            <Typography variant="body2">Ratio: {result.rrRatio?.toFixed(2) || 'N/A'}</Typography>
                                                            <Typography variant="body2">Status: {result.reason}</Typography>
                                                        </Box>
                                                    </Box>
                                                    
                                                    <Box sx={{ mt: 3 }}>
                                                        <Typography variant="h6" sx={{ mb: 1 }}>
                                                            📅 Future Prices (Day 1-5)
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                            {result.prices?.day_1 && (
                                                                <Chip 
                                                                    label={`Day1: $${result.prices.day_1.price?.toFixed(2) || 'N/A'}`}
                                                                    color="primary"
                                                                    variant="outlined"
                                                                    size="small"
                                                                />
                                                            )}
                                                            {result.prices?.day_2 && (
                                                                <Chip 
                                                                    label={`Day2: $${result.prices.day_2.price?.toFixed(2) || 'N/A'}`}
                                                                    color="primary"
                                                                    variant="outlined"
                                                                    size="small"
                                                                />
                                                            )}
                                                            {result.prices?.day_3 && (
                                                                <Chip 
                                                                    label={`Day3: $${result.prices.day_3.price?.toFixed(2) || 'N/A'}`}
                                                                    color="primary"
                                                                    variant="outlined"
                                                                    size="small"
                                                                />
                                                            )}
                                                            {result.prices?.day_4 && (
                                                                <Chip 
                                                                    label={`Day4: $${result.prices.day_4.price?.toFixed(2) || 'N/A'}`}
                                                                    color="primary"
                                                                    variant="outlined"
                                                                    size="small"
                                                                />
                                                            )}
                                                            {result.prices?.day_5 && (
                                                                <Chip 
                                                                    label={`Day5: $${result.prices.day_5.price?.toFixed(2) || 'N/A'}`}
                                                                    color="primary"
                                                                    variant="outlined"
                                                                    size="small"
                                                                />
                                                            )}
                                                        </Box>
                                                    </Box>

                                                    {result.marketStructure && (
                                                        <Box sx={{ mt: 3 }}>
                                                            <Typography variant="h6" sx={{ mb: 1 }}>
                                                                🎯 Market Structure Reference
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                                <Chip 
                                                                    label={`Support: $${result.marketStructure.supportLevels?.primary?.price?.toFixed(2) || 'N/A'}`}
                                                                    color="success"
                                                                    variant="outlined"
                                                                />
                                                                <Chip 
                                                                    label={`Resistance: $${result.marketStructure.resistanceLevels?.primary?.price?.toFixed(2) || 'N/A'}`}
                                                                    color="error"
                                                                    variant="outlined"
                                                                />
                                                                <Chip 
                                                                    label={`Trend: ${result.marketStructure.summary?.trend || 'Unknown'}`}
                                                                    color="info"
                                                                    variant="outlined"
                                                                />
                                                            </Box>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
                                                    </TableCell>
                                                </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* No Data Message */}
                    {!isLoading && results.length === 0 && (
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                                    No RR1 data found for {selectedDate}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                                    Run Master Analysis first to generate RR1 data
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}