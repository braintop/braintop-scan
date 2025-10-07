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

// Interface for Final Trading Journal data
interface TradingJournalFinalEntry {
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
    // Simulation results (already calculated and saved)
    success: -1 | 0 | 1;
    profit: number;
    profitPercent: number;
    exitTime?: string;
    exitReason?: string;
    actualEntryTime?: string;
}

interface TradingJournalFinalDocument {
    analysisDate: string;
    checkType: string;
    invalidStocks: number;
    preMarketCheckTime: string;
    totalStocks: number;
    hasSimulationResults: boolean;
    simulationCompletedAt?: string;
    trades: TradingJournalFinalEntry[];
}

export default function TradingJournalFinal() {
    const [trades, setTrades] = useState<TradingJournalFinalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [dateRangeMode, setDateRangeMode] = useState<'range' | 'single'>('single');
    const [selectedDate, setSelectedDate] = useState<string>('');
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
    const getPrevDayDisplayDate = (trade: TradingJournalFinalEntry): string => {
        if (dateRangeMode === 'single') {
            // For single date mode, calculate previous trading day from selected date
            return getPreviousTradingDay(selectedDate);
        } else {
            // For range mode, use the analysis date from the trade
            return getPreviousTradingDay(trade.analysisDate);
        }
    };

    // Load trading journal data with simulation results from Firebase
    const loadTradingJournalData = async () => {
        if (!selectedDate && !startDate && !endDate) {
            setError('Please select a date or date range');
            return;
        }

        setIsLoading(true);
        setError(null);
        setTrades([]);

        try {
            // Import Firebase functions
            const { collection, query, where, orderBy, getDocs, getFirestore, doc, getDoc } = await import('firebase/firestore');
            const db = getFirestore();

            console.log('📊 Loading Trading Journal Final data...');

            if (dateRangeMode === 'single' && selectedDate) {
                // Load single document
                const docId = `${selectedDate}_premarket`;
                console.log(`📄 Loading document: trading_journal/${docId}`);
                
                const docRef = doc(db, 'trading_journal', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const docData = docSnap.data() as TradingJournalFinalDocument;
                    console.log(`✅ Loaded document: ${docId}`, docData);
                    
                    // Check if document has simulation results
                    if (docData.hasSimulationResults && docData.trades) {
                        setTrades(docData.trades);
                        console.log(`📊 Loaded ${docData.trades.length} trades with simulation results`);
                    } else {
                        setError('No simulation results found for this date. Please run simulation first.');
                        setTrades([]);
                    }
                } else {
                    console.log(`⚠️ No document found for ${docId}`);
                    setError('No data found for the selected date');
                    setTrades([]);
                }
            } else if (dateRangeMode === 'range' && startDate && endDate) {
                // Load multiple documents for date range
                console.log(`📅 Loading documents from ${startDate} to ${endDate}`);
                
                // Generate array of dates between start and end
                const dates = [];
                const startDateObj = new Date(startDate);
                const endDateObj = new Date(endDate);
                
                for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
                    dates.push(date.toISOString().split('T')[0]);
                }
                
                const allTrades: TradingJournalFinalEntry[] = [];
                
                // Load each date's document
                for (const date of dates) {
                    const docId = `${date}_premarket`;
                    const docRef = doc(db, 'trading_journal', docId);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        const docData = docSnap.data() as TradingJournalFinalDocument;
                        
                        if (docData.hasSimulationResults && docData.trades) {
                            allTrades.push(...docData.trades);
                            console.log(`📊 Loaded ${docData.trades.length} trades from ${date}`);
                        }
                    }
                }
                
                if (allTrades.length > 0) {
                    setTrades(allTrades);
                    console.log(`📊 Loaded total ${allTrades.length} trades with simulation results`);
                } else {
                    setError('No simulation results found for the selected date range');
                    setTrades([]);
                }
            }

        } catch (err) {
            console.error("Error loading trading journal data:", err);
            setError("Failed to load trading journal data. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate statistics
    useEffect(() => {
        if (trades.length > 0) {
            const stats = trades.reduce((acc, trade) => {
                acc.totalTrades++;
                acc.totalProfit += trade.profit || 0;
                acc.totalInvested += trade.entryPrice;
                
                if (trade.success === 1) {
                    acc.successfulTrades++;
                } else if (trade.success === -1) {
                    acc.failedTrades++;
                } else {
                    acc.noEntryTrades++;
                }
                
                return acc;
            }, {
                totalTrades: 0,
                successfulTrades: 0,
                failedTrades: 0,
                noEntryTrades: 0,
                totalProfit: 0,
                totalInvested: 0
            });
            
            stats.avgProfit = stats.totalTrades > 0 ? stats.totalProfit / stats.totalTrades : 0;
            stats.avgProfitPercent = stats.totalTrades > 0 ? 
                trades.reduce((sum, trade) => sum + (trade.profitPercent || 0), 0) / stats.totalTrades : 0;
            
            setTotalStats(stats);
        }
    }, [trades]);

    // Format currency
    const formatCurrency = (value: number | undefined) => {
        if (value === undefined || value === null || isNaN(value)) return "$0.00";
        return `$${value.toFixed(2)}`;
    };

    // Format percentage
    const formatPercentage = (value: number | undefined) => {
        if (value === undefined || value === null || isNaN(value)) return "0.00%";
        return `${value.toFixed(2)}%`;
    };

    // Calculate gap from objects
    const calculateGapFromObjects = (trade: TradingJournalFinalEntry) => {
        try {
            if (trade.prev_day_2300 && trade.pm_price_1615 && 
                typeof trade.prev_day_2300 === 'object' && 
                typeof trade.pm_price_1615 === 'object' &&
                trade.prev_day_2300.price && trade.pm_price_1615.price) {
                return ((trade.pm_price_1615.price - trade.prev_day_2300.price) / trade.prev_day_2300.price) * 100;
            }
            
            return trade.gapPercent || 0;
        } catch (error) {
            console.error('Error calculating gap:', error);
            return trade.gapPercent || 0;
        }
    };

    // Calculate R:R Ratio
    const calculateRRRatio = (trade: TradingJournalFinalEntry) => {
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
            
            return trade.finalRR || 0;
        } catch (error) {
            console.error('Error calculating R:R ratio:', error);
            return trade.finalRR || 0;
        }
    };

    // Get success icon
    const getSuccessIcon = (success: number) => {
        switch (success) {
            case 1: return <CheckCircle />;
            case -1: return <TrendingDown />;
            default: return <Cancel />;
        }
    };

    // Get success color
    const getSuccessColor = (success: number) => {
        switch (success) {
            case 1: return 'success';
            case -1: return 'error';
            default: return 'default';
        }
    };

    // Get profit color
    const getProfitColor = (value: number) => {
        if (value > 0) return 'success.main';
        if (value < 0) return 'error.main';
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
        let aValue: any;
        let bValue: any;
        
        if (sortField === 'rrRatio') {
            aValue = calculateRRRatio(a);
            bValue = calculateRRRatio(b);
        } else if (sortField === 'gapPercent') {
            aValue = calculateGapFromObjects(a);
            bValue = calculateGapFromObjects(b);
        } else if (sortField === 'analysisDate') {
            aValue = dateRangeMode === 'single' ? selectedDate : a.analysisDate;
            bValue = dateRangeMode === 'single' ? selectedDate : b.analysisDate;
        } else {
            aValue = a[sortField as keyof TradingJournalFinalEntry];
            bValue = b[sortField as keyof TradingJournalFinalEntry];
        }
        
        if (aValue === undefined) aValue = sortDirection === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
        if (bValue === undefined) bValue = sortDirection === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
        
        if (sortField === 'analysisDate') {
            aValue = new Date(aValue).getTime();
            bValue = new Date(bValue).getTime();
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
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
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Assessment sx={{ mr: 2, fontSize: 32 }} />
                        <Typography variant="h4" component="h1">
                            Trading Journal Final Results
                        </Typography>
                    </Box>

                    {/* Date Selection Controls */}
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
                                        <MenuItem value="single">Single Date</MenuItem>
                                        <MenuItem value="range">Date Range</MenuItem>
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
                                    {isLoading ? <CircularProgress size={24} /> : '📊 Load Results'}
                                </Button>
                            </Box>
                        </Box>
                    </Card>

                    {/* Statistics Summary */}
                    {trades.length > 0 && (
                        <Card sx={{ mb: 3, p: 2, bgcolor: 'background.default' }}>
                            <Typography variant="h6" gutterBottom>
                                📊 Final Trading Results
                            </Typography>
                            
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'space-around' }}>
                                <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                    <Typography variant="h4" color="primary">
                                        {totalStats.totalTrades}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total Trades
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                    <Typography variant="h4" color="success.main">
                                        {totalStats.successfulTrades}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Successful
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                    <Typography variant="h4" color="error.main">
                                        {totalStats.failedTrades}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Failed
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                    <Typography variant="h4" color="warning.main">
                                        {totalStats.noEntryTrades}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        No Entry
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                    <Typography variant="h4" color="info.main">
                                        {formatCurrency(totalStats.totalProfit)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total Profit
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                    <Typography variant="h4" color="primary">
                                        {formatCurrency(totalStats.totalInvested)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total Invested
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                    <Typography variant="h4" color="success.main">
                                        {formatCurrency(totalStats.avgProfit)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Avg Profit/Trade
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                    <Typography variant="h4" color="info.main">
                                        {formatPercentage(totalStats.avgProfitPercent)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Avg Profit %
                                    </Typography>
                                </Box>
                            </Box>
                        </Card>
                    )}

                    {/* Error Alert */}
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {/* Trades Table */}
                    {trades.length > 0 && (
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    📈 Final Trading Results ({sortedTrades.length} trades)
                                </Typography>

                                <TableContainer component={Paper}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>
                                                    <Button onClick={() => handleSort('analysisDate')} sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}>
                                                        Date {getSortIcon('analysisDate')}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <Button onClick={() => handleSort('finalScore')} sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}>
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
                                                    <Button onClick={() => handleSort('gapPercent')} sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}>
                                                        Gap % {getSortIcon('gapPercent')}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <Button onClick={() => handleSort('priority')} sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}>
                                                        Priority {getSortIcon('priority')}
                                                    </Button>
                                                </TableCell>
                                                <TableCell><strong>Status</strong></TableCell>
                                                <TableCell>
                                                    <Button onClick={() => handleSort('rrRatio')} sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}>
                                                        R:R Ratio {getSortIcon('rrRatio')}
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
                                                        <Typography 
                                                            variant="body2" 
                                                            color={trade.finalScore && trade.finalScore >= 60 ? 'success.main' : trade.finalScore && trade.finalScore >= 50 ? 'warning.main' : 'error.main'}
                                                            fontWeight="bold"
                                                        >
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
                                                            icon={getSuccessIcon(trade.success)}
                                                            label={trade.success === 1 ? 'Success' : trade.success === -1 ? 'Failed' : 'No Entry'}
                                                            color={getSuccessColor(trade.success)}
                                                            variant="outlined"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography 
                                                            variant="body2" 
                                                            color={getProfitColor(trade.profit)}
                                                            fontWeight="bold"
                                                        >
                                                            {formatCurrency(trade.profit)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography 
                                                            variant="body2" 
                                                            color={getProfitColor(trade.profitPercent)}
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
                                                            {trade.actualEntryTime ? new Date(trade.actualEntryTime).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' }) : 'N/A'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {trade.exitTime ? new Date(trade.exitTime).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' }) : 'N/A'}
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
                </CardContent>
            </Card>
        </Box>
    );
}