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
import { Assessment, CheckCircle, Cancel } from '@mui/icons-material';
import { collection, query, where, orderBy, getDocs, getFirestore } from 'firebase/firestore';

const db = getFirestore();

// Interface for Trading Journal data
interface TradingJournalEntry {
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
    // Legacy fields for backward compatibility
    current_price_prev_day?: number;
}

interface TradingJournalDocument {
    analysisDate: string;
    checkType: string;
    invalidStocks: number;
    preMarketCheckTime: string;
    totalStocks: number;
    trades: TradingJournalEntry[];
}

export default function TradingJournal() {
    // State management
    const [trades, setTrades] = useState<TradingJournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [startDate, setStartDate] = useState<string>(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days ago
    );
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0] // Today
    );
    const [dateRangeMode, setDateRangeMode] = useState<'range' | 'single'>('range');
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [error, setError] = useState<string | null>(null);
    const [totalStats, setTotalStats] = useState({
        totalTrades: 0,
        validTrades: 0,
        invalidTrades: 0,
        avgRR: 0,
        avgGap: 0
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
    const getPrevDayDisplayDate = (trade: TradingJournalEntry): string => {
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
        
        try {
            console.log('📊 Loading Trading Journal data...');
            
            const collectionRef = collection(db, 'trading_journal');
            let q = query(collectionRef, orderBy('analysisDate', 'desc'));
            
            // Apply date filters
            if (dateRangeMode === 'range') {
                q = query(
                    collectionRef,
                    where('analysisDate', '>=', startDate),
                    where('analysisDate', '<=', endDate),
                    orderBy('analysisDate', 'desc')
                );
            } else {
                q = query(
                    collectionRef,
                    where('analysisDate', '==', selectedDate),
                    orderBy('analysisDate', 'desc')
                );
            }
            
            const snapshot = await getDocs(q);
            console.log(`📊 Found ${snapshot.docs.length} trading journal documents`);
            
            const allTrades: TradingJournalEntry[] = [];
            let totalValidTrades = 0;
            let totalInvalidTrades = 0;
            let totalRR = 0;
            let totalGap = 0;
            let tradeCount = 0;
            
            snapshot.docs.forEach((doc) => {
                const data = doc.data() as TradingJournalDocument;
                console.log(`📊 Processing document ${doc.id}:`, data);
                
                if (data.trades && Array.isArray(data.trades)) {
                    data.trades.forEach((trade) => {
                        allTrades.push({
                            ...trade,
                            analysisDate: data.analysisDate // Use document's analysis date
                        });
                        
                        tradeCount++;
                        totalRR += calculateRRRatio(trade);
                        totalGap += calculateGapFromObjects(trade);
                        
                        if (trade.status === 'valid') {
                            totalValidTrades++;
                        } else {
                            totalInvalidTrades++;
                        }
                    });
                }
            });
            
            console.log(`📊 Loaded ${allTrades.length} trades total`);
            
            // Calculate statistics
            const avgRR = tradeCount > 0 ? totalRR / tradeCount : 0;
            const avgGap = tradeCount > 0 ? totalGap / tradeCount : 0;
            
            setTotalStats({
                totalTrades: tradeCount,
                validTrades: totalValidTrades,
                invalidTrades: totalInvalidTrades,
                avgRR: avgRR,
                avgGap: avgGap
            });
            
            setTrades(allTrades);
            
        } catch (error) {
            console.error('❌ Error loading trading journal data:', error);
            setError('Failed to load trading journal data');
        } finally {
            setIsLoading(false);
        }
    };

    // Load data when component mounts or filters change
    useEffect(() => {
        loadTradingJournalData();
    }, [startDate, endDate, selectedDate, dateRangeMode]);

    // Format currency
    const formatCurrency = (value: number) => {
        return `$${value.toFixed(2)}`;
    };

    // Calculate gap from price objects
    const calculateGapFromObjects = (trade: TradingJournalEntry) => {
        try {
            // Check if new object structure exists
            if (trade.prev_day_2300 && trade.pm_price_1615 && 
                typeof trade.prev_day_2300 === 'object' && 
                typeof trade.pm_price_1615 === 'object' &&
                trade.prev_day_2300.price && trade.pm_price_1615.price) {
                return ((trade.pm_price_1615.price - trade.prev_day_2300.price) / trade.prev_day_2300.price) * 100;
            }
            
            // Check if old structure exists (for backward compatibility)
            if (typeof trade.current_price_prev_day === 'number' && typeof trade.pm_price_1615 === 'number') {
                return ((trade.pm_price_1615 - trade.current_price_prev_day) / trade.current_price_prev_day) * 100;
            }
            
            // Fallback to stored gapPercent
            return trade.gapPercent || 0;
        } catch (error) {
            console.error('Error calculating gap:', error);
            return trade.gapPercent || 0;
        }
    };

    // Calculate R:R Ratio from current prices
    const calculateRRRatio = (trade: TradingJournalEntry) => {
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

    // Format percentage
    const formatPercentage = (value: number) => {
        return `${value.toFixed(2)}%`;
    };

    // Get priority color
    const getPriorityColor = (priority: number) => {
        if (priority > 0) return 'success';
        if (priority === 0) return 'default';
        return 'error';
    };

    // Get status icon
    const getStatusIcon = (status: string) => {
        return status === 'valid' ? <CheckCircle color="success" /> : <Cancel color="error" />;
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
        
        // Handle special calculated fields
        if (sortField === 'rrRatio') {
            aValue = calculateRRRatio(a);
            bValue = calculateRRRatio(b);
        } else if (sortField === 'gapPercent') {
            aValue = calculateGapFromObjects(a);
            bValue = calculateGapFromObjects(b);
        } else {
            aValue = a[sortField as keyof TradingJournalEntry];
            bValue = b[sortField as keyof TradingJournalEntry];
        }
        
        // Handle undefined values
        if (aValue === undefined) aValue = sortDirection === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
        if (bValue === undefined) bValue = sortDirection === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
        
        // Handle date sorting
        if (sortField === 'analysisDate') {
            aValue = new Date(aValue).getTime();
            bValue = new Date(bValue).getTime();
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
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Assessment sx={{ mr: 2, fontSize: 32 }} />
                        <Typography variant="h4" component="h1">
                            Trading Journal
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
                                    {isLoading ? <CircularProgress size={24} /> : '🔄 Refresh'}
                                </Button>
                            </Box>
                            
                        </Box>
                    </Card>

                    {/* Statistics Summary */}
                    <Card sx={{ mb: 3, p: 2, bgcolor: 'background.default' }}>
                        <Typography variant="h6" gutterBottom>
                            📊 Trading Statistics
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
                                    {totalStats.validTrades}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Valid Trades
                                </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                <Typography variant="h4" color="error.main">
                                    {totalStats.invalidTrades}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Invalid Trades
                                </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                <Typography variant="h4" color="info.main">
                                    {totalStats.avgRR.toFixed(2)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Avg R:R Ratio
                                </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center', p: 2, minWidth: 120 }}>
                                <Typography variant="h4" color="warning.main">
                                    {totalStats.avgGap.toFixed(2)}%
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Avg Gap %
                                </Typography>
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
                                📈 Trading History ({sortedTrades.length} trades)
                            </Typography>

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
                                                                onClick={() => handleSort('rrRatio')}
                                                                sx={{ fontWeight: 'bold', textTransform: 'none', color: 'inherit' }}
                                                            >
                                                                R:R Ratio {getSortIcon('rrRatio')}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell><strong>PM Vol Ratio</strong></TableCell>
                                                        <TableCell><strong>Stop Limit</strong></TableCell>
                                                    </TableRow>
                                                </TableHead>
                                        <TableBody>
                                            {sortedTrades.map((trade, index) => (
                                                <TableRow key={index} hover>
                                                    <TableCell>{trade.analysisDate}</TableCell>
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
                                                                trade.current_price_prev_day ? 
                                                                    `${getPrevDayDisplayDate(trade)}: ${formatCurrency(trade.current_price_prev_day)}` : 
                                                                    'N/A'
                                                            }
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="info.main">
                                                            {trade.pm_price_1615 && typeof trade.pm_price_1615 === 'object' ? 
                                                                `${trade.pm_price_1615.date} 16:15: ${formatCurrency(trade.pm_price_1615.price)}` : 
                                                                trade.pm_price_1615 && typeof trade.pm_price_1615 === 'number' ? 
                                                                    formatCurrency(trade.pm_price_1615) : 
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
                                                    <TableCell>{trade.quantity}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={formatPercentage(calculateGapFromObjects(trade))}
                                                            color={calculateGapFromObjects(trade) >= 0 ? 'success' : 'error'}
                                                            variant="outlined"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={trade.priority > 0 ? `+${trade.priority}` : trade.priority.toString()}
                                                            color={getPriorityColor(trade.priority)}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            {getStatusIcon(trade.status)}
                                                            <Typography variant="body2">
                                                                {trade.status}
                                                            </Typography>
                                                        </Box>
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
                                                            {trade.pmVolumeRatio.toFixed(2)}x
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="info.main">
                                                            {formatCurrency(trade.stopLimitPrice)}
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