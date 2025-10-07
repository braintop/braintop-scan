import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Button,
    Alert,
    Box,
    Stack,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip
} from '@mui/material';
import { Architecture } from '@mui/icons-material';
import { analyzeMarketStructure } from '../Logic/FSupportResistLogic';
import { AnalysisOrchestrator } from '../Logic/AnalysisOrchestrator';
import type { MarketStructureResult, FSupportResistInput } from '../Types/MarketStructureTypes';

const FSupportResist: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<string>('2025-09-25');
    const [selectedStock, setSelectedStock] = useState<string>('AAPL');
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    const [result, setResult] = useState<MarketStructureResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [availableStocks, setAvailableStocks] = useState<string[]>([]);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [orchestrator, setOrchestrator] = useState<AnalysisOrchestrator | null>(null);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

    // Load data on component mount
    useEffect(() => {
        loadRealData();
    }, []);

    const loadRealData = async () => {
        setIsLoadingData(true);
        setError(null);
        
        try {
            // Initialize orchestrator with real data
            const newOrchestrator = new AnalysisOrchestrator('/src/Stocks/Util/data/local_stock_data_02_09_2025.json');
            await newOrchestrator.waitForDataLoading();
            
            setOrchestrator(newOrchestrator);
            
            // Get available stocks and dates
            const localData = newOrchestrator.getLocalData();
            
            if (localData && localData.metadata) {
                setAvailableStocks(localData.metadata.symbols || []);
                setAvailableDates(localData.metadata.dates || []);
                
                // Set default values if available
                if (localData.metadata.symbols && localData.metadata.symbols.length > 0) {
                    setSelectedStock(localData.metadata.symbols[0]);
                }
                if (localData.metadata.dates && localData.metadata.dates.length > 0) {
                    setSelectedDate(localData.metadata.dates[localData.metadata.dates.length - 1]);
                }
            }
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
            console.error('Error loading data:', err);
        } finally {
            setIsLoadingData(false);
        }
    };

    const runAnalysis = async () => {
        if (!orchestrator) {
            setError('Data not loaded yet. Please wait.');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            // Get current price from data
            const dataIndex = orchestrator.getDataIndex();
            const symbolData = dataIndex[selectedStock];
            
            if (!symbolData) {
                throw new Error(`No data found for ${selectedStock}`);
            }

            const currentDateData = symbolData[selectedDate];
            if (!currentDateData) {
                throw new Error(`No data found for ${selectedStock} on ${selectedDate}`);
            }

            // Load historical data using orchestrator's method
            const historicalData = await (orchestrator as any).loadStockHistoricalData(selectedStock, selectedDate);
            
            if (!historicalData || historicalData.length < 20) {
                throw new Error(`Insufficient historical data for ${selectedStock}. Need at least 20 days.`);
            }

            const input: FSupportResistInput = {
                symbol: selectedStock,
                name: selectedStock,
                currentPrice: currentDateData.close,
                analysisDate: selectedDate,
                historicalData
            };

            const analysisResult = analyzeMarketStructure(input);
            setResult(analysisResult);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
            console.error('Analysis error:', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Architecture color="primary" />
                F. Market Structure Analysis (Support/Resistance)
            </Typography>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🎯 Analysis Controls
                    </Typography>

                    <Stack spacing={2}>
                        {isLoadingData ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <CircularProgress size={20} />
                                <Typography>Loading data...</Typography>
                            </Box>
                        ) : (
                            <>
                                <FormControl fullWidth>
                                    <InputLabel>Analysis Date</InputLabel>
                                    <Select
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        label="Analysis Date"
                                    >
                                        {availableDates.map(date => (
                                            <MenuItem key={date} value={date}>{date}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                
                                <FormControl fullWidth>
                                    <InputLabel>Stock Symbol</InputLabel>
                                    <Select
                                        value={selectedStock}
                                        onChange={(e) => setSelectedStock(e.target.value)}
                                        label="Stock Symbol"
                                    >
                                        {availableStocks.map(stock => (
                                            <MenuItem key={stock} value={stock}>{stock}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </>
                        )}

                        <Button
                            variant="contained"
                            onClick={runAnalysis}
                            disabled={isAnalyzing || isLoadingData || !orchestrator}
                            startIcon={isAnalyzing ? <CircularProgress size={20} /> : <Architecture />}
                            fullWidth
                        >
                            {isAnalyzing ? 'Analyzing...' : 'Run Market Structure Analysis'}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {result && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            📊 Analysis Results for {result.symbol}
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* Current Price Info */}
                            <Box sx={{ p: 2, backgroundColor: '#e3f2fd', borderRadius: 1 }}>
                                <Typography variant="h6" color="primary" gutterBottom>
                                    💰 Current Market Data
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Symbol:</strong> {result.symbol}<br/>
                                    <strong>Current Price:</strong> ${result.currentPrice.toFixed(2)}<br/>
                                    <strong>Analysis Date:</strong> {result.analysisDate}<br/>
                                    <strong>Data Points:</strong> {result.historicalData.length} days
                                </Typography>
                            </Box>

                            {/* Support Levels */}
                            <Box sx={{ p: 2, backgroundColor: '#f0f8ff', borderRadius: 1 }}>
                                <Typography variant="h6" color="primary" gutterBottom>
                                    📊 Support Levels
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <Chip 
                                        label={`Primary: $${result.supportLevels.primary.price.toFixed(2)}`} 
                                        color="primary" 
                                        size="small" 
                                    />
                                    <Chip 
                                        label={`Secondary: $${result.supportLevels.secondary.price.toFixed(2)}`} 
                                        color="primary" 
                                        variant="outlined"
                                        size="small" 
                                    />
                                </Box>
                                <Typography variant="body2">
                                    <strong>Primary Strength:</strong> {result.supportLevels.primary.strength}/5<br/>
                                    <strong>Primary Type:</strong> {result.supportLevels.primary.type}<br/>
                                    <strong>Primary Confidence:</strong> {result.supportLevels.primary.confidence}%
                                </Typography>
                            </Box>

                            {/* Resistance Levels */}
                            <Box sx={{ p: 2, backgroundColor: '#fff5f5', borderRadius: 1 }}>
                                <Typography variant="h6" color="error" gutterBottom>
                                    📈 Resistance Levels
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <Chip 
                                        label={`Primary: $${result.resistanceLevels.primary.price.toFixed(2)}`} 
                                        color="error" 
                                        size="small" 
                                    />
                                    <Chip 
                                        label={`Secondary: $${result.resistanceLevels.secondary.price.toFixed(2)}`} 
                                        color="error" 
                                        variant="outlined"
                                        size="small" 
                                    />
                                </Box>
                                <Typography variant="body2">
                                    <strong>Primary Strength:</strong> {result.resistanceLevels.primary.strength}/5<br/>
                                    <strong>Primary Type:</strong> {result.resistanceLevels.primary.type}<br/>
                                    <strong>Primary Confidence:</strong> {result.resistanceLevels.primary.confidence}%
                                </Typography>
                            </Box>

                            {/* Moving Averages */}
                            <Box sx={{ p: 2, backgroundColor: '#fff8e1', borderRadius: 1 }}>
                                <Typography variant="h6" color="warning.main" gutterBottom>
                                    📈 Moving Averages
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <Chip 
                                        label={`SMA50: $${result.maLevels.sma50.toFixed(2)}`} 
                                        color="warning" 
                                        size="small" 
                                    />
                                    <Chip 
                                        label={`SMA200: $${result.maLevels.sma200.toFixed(2)}`} 
                                        color="warning" 
                                        variant="outlined"
                                        size="small" 
                                    />
                                </Box>
                            </Box>

                            {/* Summary */}
                            <Box sx={{ p: 2, backgroundColor: '#f0fff0', borderRadius: 1 }}>
                                <Typography variant="h6" color="success.main" gutterBottom>
                                    📊 Analysis Summary
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <Chip 
                                        label={`Trend: ${result.summary.trend}`} 
                                        color="success" 
                                        size="small" 
                                    />
                                    <Chip 
                                        label={`Strength: ${result.summary.strength}/5`} 
                                        color="success" 
                                        variant="outlined"
                                        size="small" 
                                    />
                                </Box>
                                <Typography variant="body2">
                                    <strong>Confidence:</strong> {result.summary.confidence}%<br/>
                                    <strong>Contribution to Final Score:</strong> {((result.summary.strength || 3) * 20 * 0.10).toFixed(1)} points
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

export default FSupportResist;
