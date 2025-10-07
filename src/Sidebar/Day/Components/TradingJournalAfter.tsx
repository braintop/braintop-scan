import { useState, useEffect } from 'react';
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
    Box,
    CircularProgress,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
} from '@mui/material';
import { Assessment, CheckCircle, Cancel, TrendingDown } from '@mui/icons-material';

// Interface for After Trading Journal data
interface AfterTradingEntry {
    symbol: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    quantity: number;
    gapPercent: number;
    priority: number;
    status: string;
    finalRR: number;
    analysisDate: string;
    pmVolumeRatio: number;
    stopLimitPrice: number;
    finalScore: number;
    prev_day_2300?: {
        date: string;
        price: number;
        timestamp: string;
    };
    pm_price_1615?: {
        date: string;
        price: number;
        timestamp: string;
    };
    // New fields for after-trading analysis
    success: -1 | 0 | 1;  // -1=failure, 0=no entry, 1=success
    profit: number;       // profit/loss in dollars
    profitPercent: number; // profit/loss percentage
    exitTime?: string;    // exit time if entered
    exitReason?: string;  // "Take Profit" or "Stop Loss"
    actualEntryTime?: string; // actual entry time if triggered
}

interface AfterTradingDocument {
    analysisDate: string;
    checkType: string;
    invalidStocks: number;
    preMarketCheckTime: string;
    totalStocks: number;
    trades: AfterTradingEntry[];
}

export default function TradingJournalAfter() {
    const [trades, setTrades] = useState<AfterTradingEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [startDate, setStartDate] = useState<string>(
        new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [dateRangeMode, setDateRangeMode] = useState<'range' | 'single'>('single');
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [error, setError] = useState<string | null>(null);
    const [totalStats, setTotalStats] = useState({
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        noEntryTrades: 0,
        avgProfit: 0,
        avgProfitPercent: 0,
        totalProfit: 0,
        totalInvested: 0
    });
    
    // Sorting state
    const [sortField, setSortField] = useState<string>('analysisDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Function to calculate previous trading day
    const getPreviousTradingDay = (date: string): string => {
        const currentDate = new Date(date);
        let previousDate = new Date(currentDate);
        previousDate.setDate(previousDate.getDate() - 1);
        
        // Keep going back until we find a weekday (Monday-Friday)
        while (previousDate.getDay() === 0 || previousDate.getDay() === 6) {
            previousDate.setDate(previousDate.getDate() - 1);
        }
        
        return previousDate.toISOString().split('T')[0];
    };

    // Function to get the display date for prev day column
    const getPrevDayDisplayDate = (trade: AfterTradingEntry): string => {
        if (dateRangeMode === 'single') {
            // For single date mode, calculate previous trading day from selected date
            return getPreviousTradingDay(selectedDate);
        } else {
            // For range mode, use the analysis date from the trade
            return getPreviousTradingDay(trade.analysisDate);
        }
    };

    // Load trading journal data from Firebase
    const loadTradingJournalData = async () => {
        setIsLoading(true);
        setError(null);
        setTrades([]);
        setTotalStats({
            totalTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            noEntryTrades: 0,
            avgProfit: 0,
            avgProfitPercent: 0,
            totalProfit: 0,
            totalInvested: 0
        });

        try {
            // Import Firebase functions
            const { collection, query, where, orderBy, getDocs, getFirestore } = await import('firebase/firestore');
            const db = getFirestore();

            const tradingJournalRef = collection(db, 'trading_journal');
            let q = query(tradingJournalRef);

            if (dateRangeMode === 'single' && selectedDate) {
                const docId = `${selectedDate}_premarket`;
                const { doc, getDoc } = await import('firebase/firestore');
                const docRef = doc(db, 'trading_journal', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const docData = docSnap.data() as AfterTradingDocument;
                    console.log(`✅ Loaded document: ${docId}`, docData);
                    setTrades(docData.trades || []);
                } else {
                    console.log(`⚠️ No document found for ${docId}`);
                    setTrades([]);
                }
            } else if (dateRangeMode === 'range' && startDate && endDate) {
                q = query(
                    tradingJournalRef,
                    where('analysisDate', '>=', startDate),
                    where('analysisDate', '<=', endDate),
                    orderBy('analysisDate', 'desc')
                );
                const querySnapshot = await getDocs(q);
                const fetchedTrades: AfterTradingEntry[] = [];
                querySnapshot.forEach((doc) => {
                    const docData = doc.data() as AfterTradingDocument;
                    console.log(`Processing document: ${doc.id}`, docData);
                    if (docData.trades) {
                        fetchedTrades.push(...docData.trades);
                    }
                });
                console.log(`Loaded ${fetchedTrades.length} trades total`);
                setTrades(fetchedTrades);
            } else {
                q = query(tradingJournalRef, orderBy('analysisDate', 'desc'));
                const querySnapshot = await getDocs(q);
                const fetchedTrades: AfterTradingEntry[] = [];
                querySnapshot.forEach((doc) => {
                    const docData = doc.data() as AfterTradingDocument;
                    console.log(`Processing document: ${doc.id}`, docData);
                    if (docData.trades) {
                        fetchedTrades.push(...docData.trades);
                    }
                });
                console.log(`Loaded ${fetchedTrades.length} trades total`);
                setTrades(fetchedTrades);
            }
        } catch (err) {
            console.error("Error loading trading journal data:", err);
            setError("Failed to load trading journal data. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Simulate trades based on minute-by-minute data
    const simulateTrades = async () => {
        if (trades.length === 0) {
            console.warn('⚠️ No trades available for simulation');
            return;
        }

        setIsLoading(true);
        try {
            console.log(`🎯 Starting trade simulation for ${trades.length} trades...`);
            
            
            const simulatedTrades: AfterTradingEntry[] = [];
            
            for (const trade of trades) {
                console.log(`🔍 Simulating trade for ${trade.symbol}...`);
                
                // Get minute-by-minute data for the selected trading day
                const tradingDate = dateRangeMode === 'single' ? selectedDate : trade.analysisDate;
                console.log(`📅 Using trading date: ${tradingDate} (${dateRangeMode === 'single' ? 'selected date' : 'analysis date'})`);
                const minuteData = await getMinuteDataForDay(trade.symbol, tradingDate);
                
                if (!minuteData || minuteData.length === 0) {
                    console.warn(`⚠️ No minute data for ${trade.symbol} on ${tradingDate}`);
                    simulatedTrades.push({
                        ...trade,
                        success: 0,
                        profit: 0,
                        profitPercent: 0
                    });
                    continue;
                }
                
                // Log detailed information about the data
                console.log(`📊 ${trade.symbol}: Total minutes received: ${minuteData.length}`);
                console.log(`📊 ${trade.symbol}: Entry Price: ${trade.entryPrice}, Stop Loss: ${trade.stopLoss}, Take Profit: ${trade.takeProfit}`);
                
                // Log first and last minute times
                if (minuteData.length > 0) {
                    const firstMinute = minuteData[0];
                    const lastMinute = minuteData[minuteData.length - 1];
                    console.log(`📊 ${trade.symbol}: First minute: ${new Date(firstMinute.timestamp).toISOString()} (UTC)`);
                    console.log(`📊 ${trade.symbol}: Last minute: ${new Date(lastMinute.timestamp).toISOString()} (UTC)`);
                    
                    // Convert to Israel time for display
                    const firstMinuteIsrael = new Date(firstMinute.timestamp);
                    const lastMinuteIsrael = new Date(lastMinute.timestamp);
                    console.log(`📊 ${trade.symbol}: First minute: ${firstMinuteIsrael.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} (Israel)`);
                    console.log(`📊 ${trade.symbol}: Last minute: ${lastMinuteIsrael.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} (Israel)`);
                    
                    // Log sample of first few minutes
                    console.log(`📊 ${trade.symbol}: First 5 minutes:`, minuteData.slice(0, 5).map(m => ({
                        time: new Date(m.timestamp).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
                        high: m.high,
                        low: m.low,
                        close: m.close
                    })));
                }
                
                // Simulate the trade
                const simulationResult = simulateTradeExecution(trade, minuteData);
                simulatedTrades.push({
                    ...trade,
                    ...simulationResult
                });
                
                console.log(`📊 ${trade.symbol}: ${simulationResult.success === 1 ? 'SUCCESS' : simulationResult.success === -1 ? 'FAILED' : 'NO ENTRY'} - Profit: ${simulationResult.profitPercent.toFixed(2)}%`);
                console.log(`📅 ${trade.symbol}: Analysis Date: ${trade.analysisDate}, Trading Date: ${tradingDate}`);
            }
            
            setTrades(simulatedTrades);
            console.log('✅ Trade simulation completed');
            
            // Save simulation results to Firebase
            await saveSimulationResults(simulatedTrades);
            
        } catch (error) {
            console.error('❌ Error in trade simulation:', error);
            setError("Failed to simulate trades. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Save simulation results to Firebase
    const saveSimulationResults = async (simulatedTrades: AfterTradingEntry[]) => {
        try {
            console.log('💾 Saving simulation results to Firebase...');
            
            // Import Firebase functions
            const { doc, updateDoc, getDoc, getFirestore } = await import('firebase/firestore');
            const db = getFirestore();
            
            // Determine document ID based on date range mode
            const documentId = dateRangeMode === 'single' ? `${selectedDate}_premarket` : `${startDate}_to_${endDate}_premarket`;
            
            console.log(`📄 Updating document: trading_journal/${documentId}`);
            
            // Get the existing document
            const docRef = doc(db, 'trading_journal', documentId);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                console.error(`❌ Document ${documentId} not found in trading_journal`);
                return;
            }
            
            const existingData = docSnap.data();
            console.log(`📊 Existing document has ${existingData.trades?.length || 0} trades`);
            
            // Update trades with simulation results
            const updatedTrades = existingData.trades?.map((existingTrade: any) => {
                // Find corresponding simulated trade
                const simulatedTrade = simulatedTrades.find(sim => sim.symbol === existingTrade.symbol);
                
                if (simulatedTrade) {
                    // Merge existing trade with simulation results
                    // Clean undefined values to prevent Firebase errors
                    const simulationFields: any = {
                        success: simulatedTrade.success,
                        profit: simulatedTrade.profit,
                        profitPercent: simulatedTrade.profitPercent
                    };
                    
                    // Only add optional fields if they have values (not undefined)
                    if (simulatedTrade.exitTime) {
                        simulationFields.exitTime = simulatedTrade.exitTime;
                    }
                    if (simulatedTrade.exitReason) {
                        simulationFields.exitReason = simulatedTrade.exitReason;
                    }
                    if (simulatedTrade.actualEntryTime) {
                        simulationFields.actualEntryTime = simulatedTrade.actualEntryTime;
                    }
                    
                    return {
                        ...existingTrade,
                        ...simulationFields
                    };
                }
                
                return existingTrade;
            }) || [];
            
            // Update the document with simulation results
            await updateDoc(docRef, {
                trades: updatedTrades,
                hasSimulationResults: true,
                simulationCompletedAt: new Date().toISOString()
            });
            
            console.log(`✅ Successfully saved simulation results for ${simulatedTrades.length} trades`);
            console.log(`📊 Document now has hasSimulationResults: true`);
            
        } catch (error) {
            console.error('❌ Error saving simulation results:', error);
            setError("Failed to save simulation results to Firebase");
        }
    };

    // Get minute-by-minute data for a specific day
    const getMinuteDataForDay = async (symbol: string, date: string) => {
        try {
            // Import Polygon API functions
            const { getHistoricalData } = await import('../../../Api/polygonApi');
            
            // Get minute-by-minute data for the entire trading day
            const data = await getHistoricalData(symbol, date, date, 'minute');
            
            if (!data || !data.results || data.results.length === 0) {
                return null;
            }
            
            return data.results.map((bar: any) => ({
                timestamp: bar.t,
                time: new Date(bar.t).toISOString(),
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v
            }));
            
        } catch (error) {
            console.error(`❌ Failed to get minute data for ${symbol}:`, error);
            return null;
        }
    };

    // Simulate trade execution based on minute data
    const simulateTradeExecution = (trade: AfterTradingEntry, minuteData: any[]) => {
        const entryPrice = trade.entryPrice;
        const stopLoss = trade.stopLoss;
        const takeProfit = trade.takeProfit;
        
        let entryTriggered = false;
        let entryTime = '';
        let exitTime = '';
        let exitReason = '';
        let finalPrice = 0;
        
        // Filter data to trading hours only (16:30-23:00 Israel time)
        const tradingHoursData = minuteData.filter(minuteBar => {
            const minuteDate = new Date(minuteBar.timestamp);
            const israelTime = new Date(minuteDate.getTime() + (3 * 60 * 60 * 1000)); // Convert UTC to Israel time
            const hour = israelTime.getUTCHours();
            const minute = israelTime.getUTCMinutes();
            
            // Check if within trading hours: 16:30-23:00 Israel time
            const timeInMinutes = hour * 60 + minute;
            const startTime = 16 * 60 + 30; // 16:30
            const endTime = 23 * 60; // 23:00
            
            const isWithinHours = timeInMinutes >= startTime && timeInMinutes <= endTime;
            
            // Log first few minutes for debugging
            if (minuteData.indexOf(minuteBar) < 5) {
                console.log(`🕐 ${trade.symbol}: Minute ${minuteData.indexOf(minuteBar) + 1}: UTC=${minuteDate.toISOString()}, Israel=${israelTime.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}, Time=${hour}:${minute.toString().padStart(2, '0')}, Within=${isWithinHours}`);
            }
            
            return isWithinHours;
        });
        
        console.log(`🕐 ${trade.symbol}: Filtered ${tradingHoursData.length} minutes within trading hours (16:30-23:00 Israel time)`);
        
        // Log sample of filtered data
        if (tradingHoursData.length > 0) {
            console.log(`🕐 ${trade.symbol}: First 3 filtered minutes:`, tradingHoursData.slice(0, 3).map(m => ({
                time: new Date(m.timestamp).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
                price: m.close,
                high: m.high,
                low: m.low
            })));
        }
        
        if (tradingHoursData.length === 0) {
            console.warn(`⚠️ ${trade.symbol}: No data within trading hours`);
            return {
                success: 0 as const,
                profit: 0,
                profitPercent: 0
            };
        }
        
        // Check each minute for entry trigger and exit conditions
        for (const minute of tradingHoursData) {
            const minuteTime = new Date(minute.timestamp).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
            
            // Log every minute for debugging
            console.log(`🕐 ${trade.symbol}: ${minuteTime} - High: ${minute.high}, Low: ${minute.low}, Close: ${minute.close}, Entry: ${entryTriggered ? 'YES' : 'NO'}`);
            
            // Check if entry is triggered (price crosses above entry price)
            if (!entryTriggered && minute.high >= entryPrice) {
                entryTriggered = true;
                entryTime = minute.time;
                console.log(`🎯 ${trade.symbol}: ENTRY TRIGGERED at ${minuteTime} - High: ${minute.high} >= Entry: ${entryPrice}`);
            }
            
            // If entry is triggered, check for exit conditions
            if (entryTriggered) {
                // Check for stop loss (price goes below stop loss)
                if (minute.low <= stopLoss) {
                    exitTime = minute.time;
                    exitReason = 'Stop Loss';
                    finalPrice = stopLoss;
                    console.log(`🛑 ${trade.symbol}: STOP LOSS HIT at ${minuteTime} - Low: ${minute.low} <= Stop: ${stopLoss}`);
                    break;
                }
                
                // Check for take profit (price goes above take profit)
                if (minute.high >= takeProfit) {
                    exitTime = minute.time;
                    exitReason = 'Take Profit';
                    finalPrice = takeProfit;
                    console.log(`🎯 ${trade.symbol}: TAKE PROFIT HIT at ${minuteTime} - High: ${minute.high} >= Target: ${takeProfit}`);
                    break;
                }
            }
        }
        
        // Calculate results
        if (!entryTriggered) {
            // No entry
            console.log(`❌ ${trade.symbol}: NO ENTRY TRIGGERED`);
            console.log(`❌ ${trade.symbol}: Entry Price: ${entryPrice}`);
            console.log(`❌ ${trade.symbol}: Max price during trading hours: ${Math.max(...tradingHoursData.map(m => m.high))}`);
            console.log(`❌ ${trade.symbol}: Min price during trading hours: ${Math.min(...tradingHoursData.map(m => m.low))}`);
            console.log(`❌ ${trade.symbol}: Total minutes checked: ${tradingHoursData.length}`);
            return {
                success: 0 as const,
                profit: 0,
                profitPercent: 0
            };
        } else if (exitTime) {
            // Entry and exit
            const profit = finalPrice - entryPrice;
            const profitPercent = (profit / entryPrice) * 100;
            
            console.log(`📊 ${trade.symbol}: TRADE COMPLETED - ${exitReason}`);
            console.log(`📊 ${trade.symbol}: Entry: ${entryPrice} -> Exit: ${finalPrice} -> Profit: ${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`);
            console.log(`📊 ${trade.symbol}: Entry Time: ${formatTimeToIsrael(entryTime)}`);
            console.log(`📊 ${trade.symbol}: Exit Time: ${formatTimeToIsrael(exitTime)}`);
            
            return {
                success: profit > 0 ? 1 as const : -1 as const,
                profit: profit,
                profitPercent: profitPercent,
                exitTime: exitTime,
                exitReason: exitReason,
                actualEntryTime: entryTime
            };
        } else {
            // Entry but no exit (hold until end of day)
            const lastMinute = tradingHoursData[tradingHoursData.length - 1];
            const finalPrice = lastMinute.close;
            const profit = finalPrice - entryPrice;
            const profitPercent = (profit / entryPrice) * 100;
            
            console.log(`📊 ${trade.symbol}: END OF DAY - No exit triggered`);
            console.log(`📊 ${trade.symbol}: Entry: ${entryPrice} -> End of Day: ${finalPrice} -> Profit: ${profit.toFixed(2)} (${profitPercent.toFixed(2)}%)`);
            console.log(`📊 ${trade.symbol}: Entry Time: ${formatTimeToIsrael(entryTime)}`);
            console.log(`📊 ${trade.symbol}: End Time: ${formatTimeToIsrael(lastMinute.time)}`);
            
            return {
                success: profit > 0 ? 1 as const : -1 as const,
                profit: profit,
                profitPercent: profitPercent,
                exitTime: lastMinute.time,
                exitReason: 'End of Day',
                actualEntryTime: entryTime
            };
        }
    };

    // Calculate total statistics
    useEffect(() => {
        if (trades.length > 0) {
            const total = trades.length;
            const successful = trades.filter(trade => trade.success === 1).length;
            const failed = trades.filter(trade => trade.success === -1).length;
            const noEntry = trades.filter(trade => trade.success === 0).length;
            const totalProfit = trades.reduce((sum, trade) => sum + trade.profit, 0);
            const avgProfit = totalProfit / total;
            const totalProfitPercent = trades.reduce((sum, trade) => sum + trade.profitPercent, 0);
            const avgProfitPercent = totalProfitPercent / total;
            const totalInvested = trades.reduce((sum, trade) => sum + trade.entryPrice, 0);

            setTotalStats({
                totalTrades: total,
                successfulTrades: successful,
                failedTrades: failed,
                noEntryTrades: noEntry,
                avgProfit: avgProfit,
                avgProfitPercent: avgProfitPercent,
                totalProfit: totalProfit,
                totalInvested: totalInvested
            });
        } else {
            setTotalStats({
                totalTrades: 0,
                successfulTrades: 0,
                failedTrades: 0,
                noEntryTrades: 0,
                avgProfit: 0,
                avgProfitPercent: 0,
                totalProfit: 0,
                totalInvested: 0
            });
        }
    }, [trades]);

    // Load data when component mounts or filters change
    useEffect(() => {
        loadTradingJournalData();
    }, [startDate, endDate, selectedDate, dateRangeMode]);

    // Format currency
    const formatCurrency = (value: number | undefined | null) => {
        if (value === undefined || value === null || isNaN(value)) {
            return '$0.00';
        }
        return `$${value.toFixed(2)}`;
    };

    // Format percentage
    const formatPercentage = (value: number | undefined | null) => {
        if (value === undefined || value === null || isNaN(value)) {
            return '0.00%';
        }
        return `${value.toFixed(2)}%`;
    };

    // Calculate gap from objects (with backward compatibility)
    const calculateGapFromObjects = (trade: AfterTradingEntry) => {
        try {
            // Check if new object structure exists
            if (trade.prev_day_2300 && trade.pm_price_1615 && 
                typeof trade.prev_day_2300 === 'object' && 
                typeof trade.pm_price_1615 === 'object' &&
                trade.prev_day_2300.price && trade.pm_price_1615.price) {
                return ((trade.pm_price_1615.price - trade.prev_day_2300.price) / trade.prev_day_2300.price) * 100;
            }
            
            // Fallback to stored gapPercent
            return trade.gapPercent || 0;
        } catch (error) {
            console.error('Error calculating gap:', error);
            return trade.gapPercent || 0;
        }
    };

    // Calculate R:R Ratio dynamically
    const calculateRRRatio = (trade: AfterTradingEntry) => {
        try {
            const entryPrice = trade.entryPrice;
            const stopLoss = trade.stopLoss;
            const takeProfit = trade.takeProfit;
            
            if (entryPrice && stopLoss && takeProfit && entryPrice > stopLoss) {
                const risk = entryPrice - stopLoss;
                const reward = takeProfit - entryPrice;
                const rrRatio = risk > 0 ? reward / risk : 0;
                return rrRatio;
            }
            
            // Fallback to stored finalRR
            return trade.finalRR || 0;
        } catch (error) {
            console.error('Error calculating R:R ratio:', error);
            return trade.finalRR || 0;
        }
    };

    // Format time to Israel time
    const formatTimeToIsrael = (utcTime: string) => {
        try {
            const date = new Date(utcTime);
            // Convert to Israel time (UTC+3)
            const israelTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
            return israelTime.toLocaleTimeString('he-IL', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            console.error('Error formatting time:', error);
            return 'N/A';
        }
    };

    // Get success icon
    const getSuccessIcon = (success: number) => {
        if (success === 1) return <CheckCircle color="success" />;
        if (success === -1) return <Cancel color="error" />;
        return <TrendingDown color="disabled" />;
    };

    // Get success color
    const getSuccessColor = (success: number) => {
        if (success === 1) return 'success';
        if (success === -1) return 'error';
        return 'default';
    };

    // Get profit color
    const getProfitColor = (profit: number) => {
        if (profit > 0) return 'success.main';
        if (profit < 0) return 'error.main';
        return 'text.secondary';
    };

    // Handle sorting
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort trades data
    const sortedTrades = [...trades].sort((a, b) => {
        let aValue: any = a[sortField as keyof AfterTradingEntry];
        let bValue: any = b[sortField as keyof AfterTradingEntry];
        
        // Handle undefined values
        if (aValue === undefined) aValue = sortDirection === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
        if (bValue === undefined) bValue = sortDirection === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
        
        // Handle date sorting
        if (sortField === 'analysisDate') {
            // For single date mode, use selectedDate for sorting
            if (dateRangeMode === 'single') {
                aValue = new Date(selectedDate).getTime();
                bValue = new Date(selectedDate).getTime();
            } else {
                aValue = new Date(aValue).getTime();
                bValue = new Date(bValue).getTime();
            }
        }
        
        // Handle calculated fields
        if (sortField === 'gapPercent') {
            aValue = calculateGapFromObjects(a);
            bValue = calculateGapFromObjects(b);
        } else if (sortField === 'finalRR') {
            aValue = calculateRRRatio(a);
            bValue = calculateRRRatio(b);
        }
        
        // Handle numeric sorting
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        // Handle string sorting
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDirection === 'asc' 
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        }
        
        return 0;
    });

    // Get sort icon
    const getSortIcon = (field: string) => {
        if (sortField !== field) return '↕️';
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    return (
        <Box sx={{ p: 3 }}>
            <Card>
                <CardContent>
                    <Typography variant="h5" component="h2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                        <Assessment sx={{ mr: 1 }} /> After Trading Journal
                    </Typography>

                    {/* Date Range Selection */}
                    <Card sx={{ mb: 3, p: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            📅 Date Range Selection
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Box sx={{ minWidth: 200 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Date Mode</InputLabel>
                                    <Select
                                        value={dateRangeMode}
                                        onChange={(e) => setDateRangeMode(e.target.value as 'range' | 'single')}
                                        label="Date Mode"
                                    >
                                        <MenuItem value="range">Date Range</MenuItem>
                                        <MenuItem value="single">Single Date</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            {dateRangeMode === 'range' ? (
                                <>
                                    <Box sx={{ minWidth: 150 }}>
                                        <TextField
                                            fullWidth
                                            label="Start Date"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Box>
                                    <Box sx={{ minWidth: 150 }}>
                                        <TextField
                                            fullWidth
                                            label="End Date"
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Box>
                                </>
                            ) : (
                                <Box sx={{ minWidth: 150 }}>
                                    <TextField
                                        fullWidth
                                        label="Select Date"
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Box>
                            )}

                            <Box sx={{ minWidth: 150 }}>
                                <Button
                                    variant="contained"
                                    onClick={loadTradingJournalData}
                                    disabled={isLoading}
                                    fullWidth
                                    sx={{ height: '56px' }}
                                >
                                    {isLoading ? <CircularProgress size={24} /> : '🔄 Load Data'}
                                </Button>
                            </Box>

                            <Box sx={{ minWidth: 150 }}>
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    onClick={simulateTrades}
                                    disabled={isLoading || trades.length === 0}
                                    fullWidth
                                    sx={{ height: '56px' }}
                                >
                                    {isLoading ? <CircularProgress size={24} /> : '🎯 Simulate Trades'}
                                </Button>
                            </Box>
                        </Box>
                    </Card>


                    {/* Error Alert */}
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {/* Trades Table */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                📈 Trading Performance Results ({sortedTrades.length} trades)
                            </Typography>
                            
                            {/* Profit Summary */}
                            {sortedTrades.length > 0 && (
                                <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                    <Typography variant="h6" gutterBottom>
                                        💰 Profit Summary
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                        <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                                            <Typography variant="h4" color="primary">
                                                {totalStats.totalTrades}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Trades
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                                            <Typography variant="h4" color={getProfitColor(totalStats.totalProfit)}>
                                                {formatCurrency(totalStats.totalProfit)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Profit
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                                            <Typography variant="h4" color="primary">
                                                {formatCurrency(totalStats.totalInvested)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Invested
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                                            <Typography variant="h4" color={getProfitColor(totalStats.avgProfit)}>
                                                {formatCurrency(totalStats.avgProfit)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Avg Profit per Trade
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                                            <Typography variant="h4" color={getProfitColor(totalStats.avgProfitPercent)}>
                                                {formatPercentage(totalStats.avgProfitPercent)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Avg Profit %
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                                            <Typography variant="h4" color="success.main">
                                                {totalStats.successfulTrades}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Successful Trades
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                                            <Typography variant="h4" color="error.main">
                                                {totalStats.failedTrades}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Failed Trades
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            )}

                            {isLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress />
                                    <Typography sx={{ ml: 2 }}>Loading trades...</Typography>
                                </Box>
                            ) : sortedTrades.length === 0 ? (
                                <Alert severity="info">
                                    No trades found for the selected date range.
                                </Alert>
                            ) : (
                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>
                                                    <Button 
                                                        onClick={() => handleSort('analysisDate')}
                                                        sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}
                                                    >
                                                        Date {getSortIcon('analysisDate')}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        onClick={() => handleSort('finalScore')}
                                                        sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}
                                                    >
                                                        Final Score {getSortIcon('finalScore')}
                                                    </Button>
                                                </TableCell>
                                                <TableCell><strong>Symbol</strong></TableCell>
                                                <TableCell><strong>Prev Day (23:00)</strong></TableCell>
                                                <TableCell><strong>PM Price (16:15)</strong></TableCell>
                                                <TableCell><strong>Entry Price</strong></TableCell>
                                                <TableCell><strong>Stop Loss</strong></TableCell>
                                                <TableCell><strong>Take Profit</strong></TableCell>
                                                <TableCell><strong>Quantity</strong></TableCell>
                                                <TableCell>
                                                    <Button 
                                                        onClick={() => handleSort('gapPercent')}
                                                        sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}
                                                    >
                                                        Gap % {getSortIcon('gapPercent')}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        onClick={() => handleSort('priority')}
                                                        sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}
                                                    >
                                                        Priority {getSortIcon('priority')}
                                                    </Button>
                                                </TableCell>
                                                <TableCell><strong>Status</strong></TableCell>
                                                <TableCell>
                                                    <Button 
                                                        onClick={() => handleSort('finalRR')}
                                                        sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}
                                                    >
                                                        R:R Ratio {getSortIcon('finalRR')}
                                                    </Button>
                                                </TableCell>
                                                <TableCell><strong>PM Vol Ratio</strong></TableCell>
                                                <TableCell><strong>Stop Limit</strong></TableCell>
                                                <TableCell><strong>Success</strong></TableCell>
                                                <TableCell><strong>Profit $</strong></TableCell>
                                                <TableCell><strong>Profit %</strong></TableCell>
                                                <TableCell><strong>Exit Reason</strong></TableCell>
                                                <TableCell><strong>Entry Time</strong></TableCell>
                                                <TableCell><strong>Exit Time</strong></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {sortedTrades.map((trade, index) => (
                                                <TableRow key={index} hover>
                                                    <TableCell>
                                                        {dateRangeMode === 'single' ? selectedDate : trade.analysisDate}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color={trade.finalScore && trade.finalScore >= 60 ? 'success.main' : trade.finalScore && trade.finalScore >= 50 ? 'warning.main' : 'error.main'} fontWeight="bold">
                                                            {trade.finalScore ? trade.finalScore.toFixed(1) : 'N/A'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={trade.symbol} 
                                                            color="primary" 
                                                            variant="outlined"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {trade.prev_day_2300 && typeof trade.prev_day_2300 === 'object' ? 
                                                                `${getPrevDayDisplayDate(trade)}: ${formatCurrency(trade.prev_day_2300.price)}` : 
                                                                'N/A'
                                                            }
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="info.main">
                                                            {trade.pm_price_1615 && typeof trade.pm_price_1615 === 'object' ? 
                                                                `${trade.pm_price_1615.date} 16:15: ${formatCurrency(trade.pm_price_1615.price)}` : 
                                                                'N/A'
                                                            }
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="primary">
                                                            {formatCurrency(trade.entryPrice)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="error">
                                                            {formatCurrency(trade.stopLoss)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="success">
                                                            {formatCurrency(trade.takeProfit)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2">
                                                            {trade.quantity || 100}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={`${calculateGapFromObjects(trade).toFixed(2)}%`}
                                                            color={calculateGapFromObjects(trade) > 0 ? 'success' : 'error'}
                                                            variant="outlined"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={trade.priority > 0 ? `+${trade.priority}` : trade.priority.toString()}
                                                            color={trade.priority > 0 ? 'success' : trade.priority < 0 ? 'error' : 'default'}
                                                            variant="outlined"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={trade.status}
                                                            color={trade.status === 'valid' ? 'success' : 'error'}
                                                            variant="outlined"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography 
                                                            variant="body2" 
                                                            color={calculateRRRatio(trade) >= 2 ? 'success.main' : 'error.main'}
                                                            fontWeight="bold"
                                                        >
                                                            {calculateRRRatio(trade).toFixed(2)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2">
                                                            {trade.pmVolumeRatio ? `${trade.pmVolumeRatio.toFixed(2)}x` : 'N/A'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="info.main">
                                                            {formatCurrency(trade.stopLimitPrice)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            icon={getSuccessIcon(trade.success || 0)}
                                                            label={trade.success === 1 ? 'Success' : trade.success === -1 ? 'Failed' : 'No Entry'}
                                                            color={getSuccessColor(trade.success || 0)}
                                                            variant="outlined"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography 
                                                            variant="body2" 
                                                            color={getProfitColor(trade.profit || 0)}
                                                            fontWeight="bold"
                                                        >
                                                            {formatCurrency(trade.profit)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography 
                                                            variant="body2" 
                                                            color={getProfitColor(trade.profitPercent || 0)}
                                                            fontWeight="bold"
                                                        >
                                                            {formatPercentage(trade.profitPercent)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2">
                                                            {trade.exitReason || 'N/A'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {trade.actualEntryTime ? formatTimeToIsrael(trade.actualEntryTime) : 'N/A'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {trade.exitTime ? formatTimeToIsrael(trade.exitTime) : 'N/A'}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </Box>
    );
}