import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Button,
    TextField,
    Alert,
    Box,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import { TrendingUp, Rocket, Refresh, ExpandMore, Support, TrendingDown, ShowChart, Assessment } from '@mui/icons-material';
import { AnalysisOrchestrator } from '../Logic/AnalysisOrchestrator';
import { FirebaseService } from '../../../Services/FirebaseService';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import * as MarketStructureTypes from '../Types/MarketStructureTypes';

const db = getFirestore();

// RR1 Interfaces
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

// Interfaces
interface LocalDataInfo {
    hasData: boolean;
    startDate: string;
    endDate: string;
    totalRecords: number;
    symbols: string[];
}

interface AnalysisResult {
    symbol: string;
    bSpyScore: number;
    cAtrPriceScore: number;
    dSignalsScore: number;
    candleScore: number;
    eAdxScore: number;
    finalScore: number;
    analysisDate: string;
    marketStructure?: MarketStructureTypes.MarketStructureResult | null;
}

interface ProgressState {
    isRunning: boolean;
    currentStep: string;
    progress: number;
    error?: string;
}

// CSS for spinning animation
const spinKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const MasterAnalysis: React.FC = () => {
    // State
    const [localDataInfo, setLocalDataInfo] = useState<LocalDataInfo | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<'single' | 'range'>('single');
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [results, setResults] = useState<AnalysisResult[]>([]);
    const [progress, setProgress] = useState<ProgressState>({
        isRunning: false,
        currentStep: '',
        progress: 0
    });
    const [sortField, setSortField] = useState<keyof AnalysisResult>('finalScore');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    
    // New state for stock file selection
    const [availableStockFiles, setAvailableStockFiles] = useState<{name: string, displayName: string}[]>([]);
    const [selectedStockFile, setSelectedStockFile] = useState<string>('local_stock_data.json');
    
    // New state for Firebase collection selection
    const [availableFirebaseCollections, setAvailableFirebaseCollections] = useState<string[]>([]);
    const [selectedFirebaseCollection, setSelectedFirebaseCollection] = useState<string>('Default (Create new collection)');

    // Load local data info on component mount
    useEffect(() => {
        loadAvailableStockFiles();
        
        // Load collections from localStorage first (fast), then from Firebase if needed
        const loadedFromLocalStorage = loadCollectionsFromLocalStorage();
        if (!loadedFromLocalStorage) {
            loadAvailableFirebaseCollections();
        }
        
        loadLocalDataInfo();
        
        // Set default dates to 2024
        // Default dates for 2024 analysis
        setSingleDate('2024-01-02'); // יום שני ראשון של 2024
        setStartDate('2024-01-02');  // יום שני ראשון של 2024
        setEndDate('2024-01-02');    // יום שני ראשון של 2024
    }, []);

    // Reload data when selected stock file changes
    useEffect(() => {
        if (selectedStockFile) {
            loadLocalDataInfo();
        }
    }, [selectedStockFile]);

    // Ensure collections are loaded on mount
    useEffect(() => {
        if (availableFirebaseCollections.length === 0) {
            console.log('🔄 Collections not loaded, loading now...');
            loadAvailableFirebaseCollections();
        }
    }, [availableFirebaseCollections.length]);

    // Load available Firebase collections from Firebase and save to localStorage
    const loadAvailableFirebaseCollections = async () => {
        try {
            console.log('🔍 Loading available Firebase collections from Firebase...');
            
            // Import Firebase functions
            const { doc, getDoc } = await import('firebase/firestore');
            
            // Read from Firebase my_collections/names
            const collectionsDocRef = doc(db, 'my_collections', 'names');
            const collectionsDocSnap = await getDoc(collectionsDocRef);
            
            let collections = [];
            
            if (collectionsDocSnap.exists()) {
                const data = collectionsDocSnap.data();
                console.log('🔍 Firebase document data:', data);
                
                // Check if data has 'names' property or if it's a direct array
                if (data.names && Array.isArray(data.names)) {
                    collections = data.names;
                } else {
                    // If no 'names' property, try to extract array values from the document
                    collections = Object.values(data).filter(value => typeof value === 'string');
                }
                
                console.log(`✅ Loaded ${collections.length} collections from Firebase:`, collections);
            } else {
                console.log('⚠️ No collections document found in Firebase, using fallback');
                collections = [
                    'favorite',
                    'relative-strength',
                    'short_daily_relative-strength',
                    'week_relative-strength',
                    'local_stock_data_02_01_2024',
                    'short_local_stock_data_02_01_2024'
                ];
            }
            
            // Add "Default (Create new collection)" option
            if (!collections.includes('Default (Create new collection)')) {
                collections.push('Default (Create new collection)');
            }
            
            // Save to localStorage
            localStorage.setItem('firebase_collections', JSON.stringify(collections));
            console.log('💾 Saved collections to localStorage');
            
            // Update state
            setAvailableFirebaseCollections(collections);
            
        } catch (error) {
            console.error('❌ Error loading available Firebase collections:', error);
            
            // Fallback to localStorage or hardcoded list
            const localStorageCollections = localStorage.getItem('firebase_collections');
            let collections = [];
            
            if (localStorageCollections) {
                try {
                    collections = JSON.parse(localStorageCollections);
                    console.log('⚠️ Using collections from localStorage:', collections);
                } catch (e) {
                    console.error('❌ Error parsing localStorage collections:', e);
                    collections = [
                        'favorite',
                        'relative-strength',
                        'short_daily_relative-strength',
                        'week_relative-strength',
                        'local_stock_data_02_01_2024',
                        'short_local_stock_data_02_01_2024',
                        'Default (Create new collection)'
                    ];
                }
            } else {
                collections = [
                    'favorite',
                    'relative-strength',
                    'short_daily_relative-strength',
                    'week_relative-strength',
                    'local_stock_data_02_01_2024',
                    'short_local_stock_data_02_01_2024',
                    'Default (Create new collection)'
                ];
            }
            
            setAvailableFirebaseCollections(collections);
        }
    };

    // Load collections from localStorage on initial load
    const loadCollectionsFromLocalStorage = () => {
        try {
            console.log('🔍 Loading collections from localStorage...');
            const localStorageCollections = localStorage.getItem('firebase_collections');
            
            if (localStorageCollections) {
                const collections = JSON.parse(localStorageCollections);
                console.log(`✅ Loaded ${collections.length} collections from localStorage:`, collections);
                setAvailableFirebaseCollections(collections);
                return true;
            } else {
                console.log('⚠️ No collections found in localStorage');
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading collections from localStorage:', error);
            return false;
        }
    };

    // Add new collection to Firebase list and update localStorage
    const addCollectionToList = async (collectionName: string) => {
        try {
            console.log(`🔍 Adding new collection "${collectionName}" to Firebase list...`);
            
            // Import Firebase functions
            const { doc, getDoc, setDoc } = await import('firebase/firestore');
            
            // Read current list from Firebase
            const collectionsDocRef = doc(db, 'my_collections', 'names');
            const collectionsDocSnap = await getDoc(collectionsDocRef);
            
            let currentCollections = [];
            if (collectionsDocSnap.exists()) {
                const data = collectionsDocSnap.data();
                currentCollections = data.names || [];
            }
            
            // Add new collection if it doesn't exist
            if (!currentCollections.includes(collectionName)) {
                currentCollections.push(collectionName);
                
                // Update Firebase with new array structure
                await setDoc(collectionsDocRef, {
                    names: currentCollections,
                    lastUpdated: new Date().toISOString()
                });
                
                console.log(`✅ Added "${collectionName}" to Firebase collections list`);
                
                // Update localStorage
                localStorage.setItem('firebase_collections', JSON.stringify(currentCollections));
                console.log('💾 Updated localStorage with new collection');
                
                // Update state
                setAvailableFirebaseCollections([...currentCollections, 'Default (Create new collection)']);
            } else {
                console.log(`⚠️ Collection "${collectionName}" already exists in list`);
            }
            
        } catch (error) {
            console.error('❌ Error adding collection to list:', error);
        }
    };

    // Load available stock files from data directory
    const loadAvailableStockFiles = async () => {
        try {
            console.log('🔍 Loading available stock files...');
            
            // For now, we'll hardcode the available files since we can't access the file system directly
            // In a real implementation, you might want to create an API endpoint to list files
            // Only include files that actually exist
            const files = [
                { name: 'local_stock_data.json', displayName: 'Stock Data (Default)' },
                { name: 'local_stock_data_01_10_2025.json', displayName: 'Stock Data 01/10/2025' },
                { name: 'local_stock_data_02_09_2025.json', displayName: 'Stock Data 02/09/2025' }
            ];
            
            console.log(`✅ Found ${files.length} available stock files:`, files);
            setAvailableStockFiles(files);
            
        } catch (error) {
            console.error('❌ Error loading available stock files:', error);
        }
    };

    // Load local data info from the selected JSON file
    const loadLocalDataInfo = async () => {
        setIsLoadingData(true);
        try {
            console.log(`🔍 Loading local data info from: ${selectedStockFile}...`);
            
            const timestamp = new Date().getTime();
            const filePath = selectedStockFile === 'local_stock_data.json' 
                ? `/src/Stocks/Util/${selectedStockFile}`
                : `/src/Stocks/Util/data/${selectedStockFile}`;
            const response = await fetch(`${filePath}?t=${timestamp}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load local data: ${response.status}`);
            }
            
            const localData = await response.json();
            
            if (localData && localData.metadata) {
                const metadata = localData.metadata;
                
                console.log('✅ Local data loaded successfully');
                console.log(`📅 Date range: ${metadata.startDate} - ${metadata.endDate}`);
                console.log(`📊 Total records: ${metadata.totalRecords}`);
                console.log(`🏢 Symbols: ${metadata.symbols?.length || 0}`);
                
                setLocalDataInfo({
                    hasData: true,
                    startDate: metadata.startDate,
                    endDate: metadata.endDate,
                    totalRecords: metadata.totalRecords,
                    symbols: metadata.symbols || []
                });
                
                // Set default date to the latest available date
                setSingleDate(metadata.endDate);
                setEndDate(metadata.endDate);
                
            } else {
                console.warn('⚠️ Local data file not found or invalid');
                setLocalDataInfo({
                    hasData: false,
                    startDate: '',
                    endDate: '',
                    totalRecords: 0,
                    symbols: []
                });
            }
            
        } catch (error) {
            console.error('❌ Error loading local data:', error);
            setLocalDataInfo({
                hasData: false,
                startDate: '',
                endDate: '',
                totalRecords: 0,
                symbols: []
            });
        } finally {
            setIsLoadingData(false);
        }
    };

    // RR1 Analysis Function
    const runRR1Analysis = async (analysisResults: AnalysisResult[], analysisDate: string, localData: any) => {
        try {
            // Find the previous trading day with available data for RR1 storage
            const getPreviousTradingDayFromDate = (date: string): string => {
                const currentDate = new Date(date);
                let previousDate = new Date(currentDate);
                let maxIterations = 10; // Search up to 10 days back
                let iterations = 0;
                
                console.log(`🔍 Finding previous trading day with data for RR1, starting from ${date}`);
                
                while (iterations < maxIterations) {
                    previousDate.setDate(previousDate.getDate() - 1);
                    const dayOfWeek = previousDate.getDay();
                    const dateStr = previousDate.toISOString().split('T')[0];
                    
                    console.log(`🔍 Checking ${dateStr}, day of week: ${dayOfWeek}`);
                    
                    // Check if it's a weekday (1-5: Monday-Friday)
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        console.log(`🔍 Checking if we have data for trading day: ${dateStr}`);
                        
                        // Check if we have data for this date
                        let hasData = false;
                        if (localData.dataIndex) {
                            const symbols = Object.keys(localData.dataIndex);
                            console.log(`🔍 Available symbols: ${symbols.length} for date ${dateStr}`);
                            
                            for (const symbol of symbols) { // Check all symbols
                                const symbolData = localData.dataIndex[symbol];
                                if (symbolData && symbolData[dateStr]) {
                                    console.log(`✅ Found data for ${symbol} on ${dateStr}`);
                                    hasData = true;
                                    break;
                                }
                            }
                            
                            if (!hasData) {
                                console.log(`❌ No data found for any symbol on ${dateStr}`);
                            }
                        } else {
                            console.log(`❌ No dataIndex available`);
                        }
                        
                        if (hasData) {
                            console.log(`✅ Found previous trading day with data: ${dateStr}`);
                            return dateStr;
                        } else {
                            console.log(`⚠️ No data found for trading day: ${dateStr}`);
                        }
                    }
                    iterations++;
                }
                
                console.log(`⚠️ No previous trading day with data found, using simple calculation`);
                // Fallback: simple calculation
                const fallbackDate = new Date(currentDate);
                fallbackDate.setDate(fallbackDate.getDate() - 1);
                while (fallbackDate.getDay() === 0 || fallbackDate.getDay() === 6) {
                    fallbackDate.setDate(fallbackDate.getDate() - 1);
                }
                return fallbackDate.toISOString().split('T')[0];
            };
            
            const yesterdayStr = getPreviousTradingDayFromDate(analysisDate);
            console.log(`📅 RR1 Analysis: Using ${analysisDate} as base, storing under ${yesterdayStr}`);
            
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
            
            // Get the previous trading day for currentPrice calculation
            const previousTradingDayStr = getPreviousTradingDay(analysisDate);
            
            console.log(`🎯 Starting RR1 Analysis for ${analysisDate}...`);
            console.log(`📅 RR1 will be stored under date: ${yesterdayStr} (yesterday)`);
            console.log(`🔍 Debug localData:`, {
                hasData: !!localData.data,
                dataLength: localData.data?.length,
                hasDataIndex: !!localData.dataIndex,
                dataIndexKeys: localData.dataIndex ? Object.keys(localData.dataIndex) : 'N/A'
            });
            
            const rrResults: RR1Result[] = [];
            
        console.log(`📊 Processing ${analysisResults.length} stocks for RR1 Analysis...`);
        console.log(`🔍 Sample stocks:`, analysisResults.slice(0, 5).map(r => ({
            symbol: r.symbol,
            finalScore: r.finalScore,
            hasMarketStructure: !!r.marketStructure
        })));
        
        // Check score distribution
        const scoreDistribution = analysisResults.reduce((acc, stock) => {
            const range = stock.finalScore < 30 ? '<30' : 
                         stock.finalScore > 60 ? '>60' : '30-60';
            acc[range] = (acc[range] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        console.log(`📈 Score Distribution:`, scoreDistribution);
        
        let processedCount = 0;
        let skippedNoMarketStructure = 0;
        let skippedLowScore = 0;
        
        analysisResults.forEach(result => {
            console.log(`🔍 RR1 Debug for ${result.symbol}: finalScore=${result.finalScore}, hasMarketStructure=${!!result.marketStructure}`);
            
            // Create fallback market structure if missing
            let marketStructure = result.marketStructure;
            if (!marketStructure) {
                console.warn(`⚠️ No market structure for ${result.symbol}, creating fallback`);
                marketStructure = {
                    symbol: result.symbol,
                    name: result.symbol,
                    currentPrice: 100,
                    analysisDate: analysisDate,
                    calculationDate: analysisDate,
                    supportLevels: {
                        primary: { price: 95, strength: 3, type: 'Swing Low', confidence: 50, touches: 1, lastTouch: analysisDate },
                        secondary: { price: 90, strength: 2, type: 'Swing Low', confidence: 40, touches: 1, lastTouch: analysisDate },
                        tertiary: { price: 85, strength: 1, type: 'Swing Low', confidence: 30, touches: 1, lastTouch: analysisDate }
                    },
                    resistanceLevels: {
                        primary: { price: 105, strength: 3, type: 'Swing High', confidence: 50, touches: 1, lastTouch: analysisDate },
                        secondary: { price: 110, strength: 2, type: 'Swing High', confidence: 40, touches: 1, lastTouch: analysisDate },
                        tertiary: { price: 115, strength: 1, type: 'Swing High', confidence: 30, touches: 1, lastTouch: analysisDate }
                    },
                    maLevels: { sma20: 98, sma50: 96, sma200: 94 },
                    pivotPoints: { pp: 100, r1: 105, r2: 110, s1: 95, s2: 90 },
                    volumeAnalysis: { avgVolume: 1000000, highVolumeLevels: [], volumeStrength: 3, volumeNodes: [] },
                    summary: { trend: 'Unknown', strength: 3, confidence: 50, keyLevels: [], breakoutLevels: [] },
                    historicalData: [],
                    analysisMetadata: { dataPoints: 0, timeFrame: '0 days', lastUpdated: analysisDate, confidence: 50 }
                };
            }
            
            // Only process stocks with extreme scores: very bad (< 30) or very good (> 60)
            if (result.finalScore >= 30 && result.finalScore <= 60) {
                console.log(`⏭️ Skipping RR1 for ${result.symbol}: finalScore=${result.finalScore} (middle range 30-60)`);
                skippedLowScore++;
                return;
            }
            
            processedCount++;
            
            // Get real current price from local data (previous trading day's closing price)
            const currentData = localData.data.find((record: any) => 
                record.symbol === result.symbol && record.date === previousTradingDayStr
            );
            const currentPrice = currentData?.close || 100; // Fallback to 100 if no data
            
            console.log(`🔍 RR1 ${result.symbol}: analysisDate=${analysisDate}, previousTradingDayStr=${previousTradingDayStr}, currentPrice=${currentPrice}`);
                const bufferAmount = Math.max(currentPrice * 0.002, 0.10);
                
                // Entry Price = Current Price + Buffer
                const entryPrice = currentPrice + bufferAmount;
                
                // Stop Loss = 2x ATR from entry (more professional approach)
                const atrValue = (result as any).atrValue || (currentPrice * 0.02); // Fallback to 2% of price if no ATR
                const stopLoss = entryPrice - (atrValue * 2);
                
                // Target = Up to primary resistance or 4x ATR from entry
                const primaryResistance = marketStructure.resistanceLevels?.primary?.price || currentPrice * 1.05;
                const target = Math.max(primaryResistance + bufferAmount, entryPrice + (bufferAmount * 4));
                
                const risk = entryPrice - stopLoss;
                const reward = target - entryPrice;
                const rrRatio = risk > 0 ? reward / risk : 0;
                const approved = rrRatio >= 2;
                const reason = approved 
                    ? `R:R = ${rrRatio.toFixed(2)} (≥ 2.0)` 
                    : `R:R = ${rrRatio.toFixed(2)} (< 2.0)`;
                
                // Save all stocks regardless of RR ratio
                console.log(`✅ Including RR1 for ${result.symbol}: R:R=${rrRatio.toFixed(2)}, approved=${approved}`);
                
                // Mock future prices (in real implementation, these would come from historical data)
                // Get real future prices from local data
                const futurePrices: any = {};
                const sortedDates = localData.dataIndex ? Object.keys(localData.dataIndex).sort() : [];
                const currentDateIndex = sortedDates.indexOf(analysisDate);
                
                for (let i = 1; i <= 5; i++) {
                    const futureDateIndex = currentDateIndex + i;
                    if (futureDateIndex < sortedDates.length) {
                        const futureDate = sortedDates[futureDateIndex];
                        const futureData = localData.data.find((record: any) => 
                            record.symbol === result.symbol && record.date === futureDate
                        );
                        
                        if (futureData) {
                            futurePrices[`day_${i}`] = {
                                date: futureData.date,
                                price: futureData.close,
                                open: futureData.open,
                                high: futureData.high,
                                low: futureData.low,
                                volume: futureData.volume
                            };
                        } else {
                            // Fallback to mock data if no future data available
                            futurePrices[`day_${i}`] = { 
                                date: futureDate || "", 
                                price: currentPrice * (1 + (i * 0.01)), 
                                open: currentPrice, 
                                high: currentPrice * 1.02, 
                                low: currentPrice * 0.98, 
                                volume: 1000000 
                            };
                        }
                    } else {
                        // No future dates available
                        futurePrices[`day_${i}`] = { 
                            date: "", 
                            price: currentPrice, 
                            open: currentPrice, 
                            high: currentPrice, 
                            low: currentPrice, 
                            volume: 0 
                        };
                    }
                }
                
                rrResults.push({
                    symbol: result.symbol,
                    name: result.symbol, // You can enhance this with actual company names
                    currentPrice: currentPrice,
                    analysisDate: analysisDate,
                    marketStructure: marketStructure || null,
                    entryPrice: Math.round(entryPrice * 100) / 100,
                    stopLoss: Math.round(stopLoss * 100) / 100,
                    target: Math.round(target * 100) / 100,
                    rrRatio: Math.round(rrRatio * 100) / 100,
                    approved: approved,
                    reason: reason,
                    bSpyScore: result.bSpyScore,
                    cAtrPriceScore: result.cAtrPriceScore,
                    dSignalsScore: result.dSignalsScore,
                    candleScore: result.candleScore,
                    eAdxScore: result.eAdxScore,
                    finalScore: result.finalScore,
                    prices: futurePrices,
                    atrValue: bufferAmount * 2,
                    bufferAmount: Math.round(bufferAmount * 100) / 100
                });
            });
            
            console.log(`📊 RR1 Analysis Complete: ${rrResults.length} stocks saved (filtered from ${analysisResults.length} total)`);
            console.log(`📈 RR1 Statistics:`);
            console.log(`   - Processed: ${processedCount}`);
            console.log(`   - Skipped (No Market Structure): ${skippedNoMarketStructure}`);
            console.log(`   - Skipped (Low Score ≤65): ${skippedLowScore}`);
            console.log(`   - Final Results: ${rrResults.length}`);
            
            // Create RR1 Summary
            const approvedStocks = rrResults.filter(r => r.approved).length;
            const rejectedStocks = rrResults.filter(r => !r.approved).length;
            const totalRRRatio = rrResults.reduce((sum, r) => sum + r.rrRatio, 0);
            const avgRRRatio = rrResults.length > 0 ? totalRRRatio / rrResults.length : 0;
            
            const rr1Summary: RR1Summary = {
                analysisDate: yesterdayStr, // Store under yesterday's date
                calculationDate: new Date().toISOString().split('T')[0],
                totalStocks: rrResults.length,
                approvedStocks: approvedStocks,
                rejectedStocks: rejectedStocks,
                avgRRRatio: Math.round(avgRRRatio * 100) / 100,
                analysisType: "R:R Analysis",
                analysisTime: "23:30",
                results: rrResults
            };
            
            // Save to Firebase collection "rr1" under yesterday's date
            const collectionName = "rr1";
            const documentId = yesterdayStr; // Use yesterday's date as document ID
            console.log(`💾 Saving RR1 results to Firebase collection: ${collectionName}, documentId: ${documentId}`);
            
            await setDoc(doc(db, collectionName, documentId), rr1Summary);
            console.log(`✅ RR1 results saved successfully for ${documentId}`);
            
        } catch (error) {
            console.error("❌ Error in RR1 Analysis:", error);
            throw error; // Re-throw to be handled by the calling function
        }
    };

    // Run single date analysis
    const runSingleDateAnalysis = async () => {
        if (!singleDate) {
            setProgress(prev => ({ ...prev, error: '❌ Please select a date' }));
            return;
        }

        setProgress({
            isRunning: true,
            currentStep: '🔄 מתחיל ניתוח...',
            progress: 0
        });

        try {
            // Load local data for price calculations
            const filePath = selectedStockFile === 'local_stock_data.json' 
                ? `/src/Stocks/Util/${selectedStockFile}`
                : `/src/Stocks/Util/data/${selectedStockFile}`;
            const orchestrator = new AnalysisOrchestrator(filePath);
            
            // Wait for data loading to complete
            await orchestrator.waitForDataLoading();
            
            // Get the loaded data from orchestrator
            const localData = orchestrator.getLocalData();
            const dataIndex = (orchestrator as any).getDataIndex();
            
            // Find the last trading day before the selected date
            const firstSymbol = localDataInfo?.symbols?.[0];
            let actualTradingDate = singleDate;
            
            if (firstSymbol && dataIndex) {
                // Import the function from BSpyLogic
                const { findLastTradingDay } = await import('../Logic/BSpyLogic');
                const lastTradingDay = findLastTradingDay(dataIndex, firstSymbol, singleDate);
                if (lastTradingDay) {
                    actualTradingDate = lastTradingDay;
                    console.log(`📅 Using last trading day: ${actualTradingDate} (selected: ${singleDate})`);
                }
            }
            
            // Create favorite stocks list from metadata
            const favoriteStocks = localDataInfo?.symbols ? 
                localDataInfo.symbols.map(symbol => ({ 
                    symbol, 
                    name: symbol,
                    candleDate: actualTradingDate,
                    scanDate: actualTradingDate,
                    price: 0,
                    market: 'NASDAQ',
                    volume: 0,
                    dollarVolume: 0,
                    float: 0,
                    spread: 0,
                    passed: true
                })) : 
                [];
            
            setProgress(prev => ({ ...prev, currentStep: '📊 BSpy Analysis...', progress: 25 }));
            const bSpyResults = await orchestrator.runBSpy(favoriteStocks, actualTradingDate);
            
            setProgress(prev => ({ ...prev, currentStep: '📈 CAtrPrice Analysis...', progress: 50 }));
            const cAtrPriceResults = await orchestrator.runCAtrPrice(bSpyResults, actualTradingDate);
            
            setProgress(prev => ({ ...prev, currentStep: '🎯 DSignals Analysis...', progress: 60 }));
            const dSignalsResults = await orchestrator.runDSignals(cAtrPriceResults, actualTradingDate);
            
            setProgress(prev => ({ ...prev, currentStep: '🕯️ DTCandles Analysis...', progress: 75 }));
            const dTCandlesResults = await orchestrator.runDTCandles(dSignalsResults, actualTradingDate);
            
            setProgress(prev => ({ ...prev, currentStep: '📊 EAdx Analysis...', progress: 85 }));
            const eAdxResults = await orchestrator.runEAdx(dSignalsResults, actualTradingDate);
            
            setProgress(prev => ({ ...prev, currentStep: '📈 FSupportResist Analysis...', progress: 90 }));
            const fSupportResistResults = await orchestrator.runFSupportResist(eAdxResults, actualTradingDate);
            
            // Combine results
            const analysisResults: AnalysisResult[] = bSpyResults.map(bSpy => {
                const cAtrPrice = cAtrPriceResults.find(c => c.symbol === bSpy.symbol);
                const dSignals = dSignalsResults.find(d => d.symbol === bSpy.symbol);
                const dTCandles = dTCandlesResults.find(dc => dc.symbol === bSpy.symbol);
                const eAdx = eAdxResults.find(e => e.symbol === bSpy.symbol);
                const fSupportResist = fSupportResistResults.find(f => f.symbol === bSpy.symbol);
                
                const finalScore = (
                    (bSpy.LongSpyScore || 50) * 0.18 +
                    (cAtrPrice?.LongAtrPriceScore || 50) * 0.18 +
                    (dSignals?.LongMomentumScore || 50) * 0.22 +
                    (dTCandles?.candleScore || 0) * 0.05 +
                    (eAdx?.LongAdxScore || 50) * 0.27 +
                    ((fSupportResist?.summary.strength || 3) * 20) * 0.10
                );
                
                    return {
                    symbol: bSpy.symbol,
                    bSpyScore: bSpy.LongSpyScore || 50,
                    cAtrPriceScore: cAtrPrice?.LongAtrPriceScore || 50,
                    dSignalsScore: dSignals?.LongMomentumScore || 50,
                    candleScore: dTCandles?.candleScore || 0,
                    eAdxScore: eAdx?.LongAdxScore || 50,
                    finalScore: Math.round(finalScore * 100) / 100,
                    analysisDate: actualTradingDate,
                    marketStructure: fSupportResist || null
                };
            });
            
            setResults(analysisResults);
            
            // Run RR1 Analysis and save to Firebase
            console.log(`🚀 About to run RR1 Analysis with ${analysisResults.length} stocks...`);
            setProgress(prev => ({ ...prev, currentStep: '🎯 RR1 Analysis...', progress: 95 }));
            try {
                await runRR1Analysis(analysisResults, singleDate, localData);
                console.log(`✅ RR1 Analysis completed successfully!`);
            } catch (error) {
                console.error(`❌ RR1 Analysis failed:`, error);
                setProgress(prev => ({ ...prev, error: `RR1 Analysis failed: ${error}` }));
            }
            
            // Save to Firebase with future prices
            setProgress(prev => ({ ...prev, currentStep: '💾 שומר ל-Firebase...', progress: 98 }));
            await saveToFirebaseCorrectFormat(analysisResults, singleDate, localDataInfo, fSupportResistResults, orchestrator);
            
            setProgress({
                isRunning: false,
                currentStep: '✅ ניתוח הושלם!',
                progress: 100
            });
            
        } catch (error) {
            console.error('❌ Error in analysis:', error);
            setProgress({
                isRunning: false, 
                currentStep: '',
                progress: 0,
                error: `❌ שגיאה בניתוח: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    };

    // Run date range analysis
    const runDateRangeAnalysis = async () => {
        if (!startDate || !endDate) {
            setProgress(prev => ({ ...prev, error: '❌ Please select start and end dates' }));
            return;
        }

        // Validate dates
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        
        if (startDateObj > endDateObj) {
            setProgress(prev => ({ ...prev, error: '❌ Start date is after end date' }));
            return;
        }
        
        if (startDateObj > new Date()) {
            setProgress(prev => ({ ...prev, error: '❌ Start date is in the future' }));
            return;
        }
        
        if (endDateObj > new Date()) {
            setProgress(prev => ({ ...prev, error: '❌ End date is in the future' }));
            return;
        }

        // Check if dates are within available data range
        if (localDataInfo && localDataInfo.endDate) {
            const maxDataDate = new Date(localDataInfo.endDate);
            if (startDateObj > maxDataDate) {
                setProgress(prev => ({ 
                    ...prev, 
                    error: `❌ Start date (${startDate}) is after available data\nAvailable data until ${localDataInfo.endDate}` 
                }));
                return;
            }
            if (endDateObj > maxDataDate) {
                setProgress(prev => ({ 
                    ...prev, 
                    error: `❌ End date (${endDate}) is after available data\nAvailable data until ${localDataInfo.endDate}` 
                }));
                return;
            }
        }

        setProgress({
            isRunning: true,
            currentStep: '🔄 מתחיל ניתוח טווח תאריכים...',
            progress: 0
        });

        try {
            const orchestrator = new AnalysisOrchestrator();
            const allResults: AnalysisResult[] = [];
            const allFSupportResistResults: MarketStructureTypes.MarketStructureResult[] = [];
            
            // Generate date range
            const dates: string[] = [];
            const currentDate = new Date(startDate);
            const finalDate = new Date(endDate);
            
            while (currentDate <= finalDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                dates.push(dateStr);
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            const totalDates = dates.length;
            
            for (let i = 0; i < dates.length; i++) {
                const date = dates[i];
                const progressPercent = Math.round((i / totalDates) * 100);
                
                setProgress(prev => ({ 
                    ...prev, 
                    currentStep: `📊 מנתח ${date} (${i + 1}/${totalDates})...`,
                    progress: progressPercent
                }));
                
                try {
                    // Create favorite stocks list from metadata
                    const favoriteStocks = localDataInfo?.symbols ? 
                        localDataInfo.symbols.map(symbol => ({ 
                            symbol, 
                            name: symbol,
                            candleDate: date,
                            scanDate: date,
                            price: 0,
                            market: 'NASDAQ',
                            volume: 0,
                            dollarVolume: 0,
                            float: 0,
                            spread: 0,
                            passed: true
                        })) : 
                        [];
                    
                    // Run analysis for this date sequentially (each step depends on previous)
                    const bSpyResults = await orchestrator.runBSpy(favoriteStocks, date);
                    const cAtrPriceResults = await orchestrator.runCAtrPrice(bSpyResults, date);
                    const dSignalsResults = await orchestrator.runDSignals(cAtrPriceResults, date);
                    const dTCandlesResults = await orchestrator.runDTCandles(dSignalsResults, date);
                    const eAdxResults = await orchestrator.runEAdx(dSignalsResults, date);
                    const fSupportResistResults = await orchestrator.runFSupportResist(eAdxResults, date);
                    
                    // Store FSupportResist results for later use
                    allFSupportResistResults.push(...fSupportResistResults);
                    
                    // Combine results for this date
                    const dateResults: AnalysisResult[] = bSpyResults.map(bSpy => {
                        const cAtrPrice = cAtrPriceResults.find(c => c.symbol === bSpy.symbol);
                        const dSignals = dSignalsResults.find(d => d.symbol === bSpy.symbol);
                        const dTCandles = dTCandlesResults.find(dc => dc.symbol === bSpy.symbol);
                        const eAdx = eAdxResults.find(e => e.symbol === bSpy.symbol);
                        const fSupportResist = fSupportResistResults.find(f => f.symbol === bSpy.symbol);
                        
                        const finalScore = (
                            (bSpy.LongSpyScore || 50) * 0.18 +
                            (cAtrPrice?.LongAtrPriceScore || 50) * 0.18 +
                            (dSignals?.LongMomentumScore || 50) * 0.22 +
                            (dTCandles?.candleScore || 0) * 0.05 +
                            (eAdx?.LongAdxScore || 50) * 0.27 +
                            ((fSupportResist?.summary.strength || 3) * 20) * 0.10
                        );
                
                return {
                            symbol: bSpy.symbol,
                            bSpyScore: bSpy.LongSpyScore || 50,
                            cAtrPriceScore: cAtrPrice?.LongAtrPriceScore || 50,
                            dSignalsScore: dSignals?.LongMomentumScore || 50,
                            candleScore: dTCandles?.candleScore || 0,
                            eAdxScore: eAdx?.LongAdxScore || 50,
                            finalScore: Math.round(finalScore * 100) / 100,
                            analysisDate: date,
                            marketStructure: fSupportResist || null
                        };
                    });
                    
                    allResults.push(...dateResults);

        } catch (error) {
                    console.warn(`⚠️ Skipping date ${date} - no data available`);
                    // Continue to next date instead of stopping
                }
            }
            
            setResults(allResults);
            
            // Save to Firebase with future prices - split by date to avoid size limits
            if (allResults.length > 0) {
            setProgress(prev => ({ ...prev, currentStep: '💾 שומר ל-Firebase...', progress: 95 }));
                
                // Group results by date
                const resultsByDate = new Map<string, AnalysisResult[]>();
                allResults.forEach(result => {
                    const date = result.analysisDate;
                    if (!resultsByDate.has(date)) {
                        resultsByDate.set(date, []);
                    }
                    resultsByDate.get(date)!.push(result);
                });
                
                // Save each date separately
                const dates = Array.from(resultsByDate.keys()).sort();
                for (let i = 0; i < dates.length; i++) {
                    const date = dates[i];
                    const dateResults = resultsByDate.get(date)!;
                    
                    console.log(`💾 Saving ${dateResults.length} stocks for date ${date} (${i + 1}/${dates.length})`);
                    await saveToFirebaseCorrectFormat(dateResults, date, localDataInfo, allFSupportResistResults, orchestrator);
                    
                    // Update progress
                    const progress = 95 + Math.round((i + 1) / dates.length * 5);
                    setProgress(prev => ({ ...prev, currentStep: `💾 שומר ${date}...`, progress }));
                }
            } else {
                console.warn('⚠️ No results to save to Firebase');
            }
        
        setProgress({
                isRunning: false,
                currentStep: `✅ ניתוח הושלם! נותחו ${allResults.length} רשומות`,
                progress: 100
            });
            
        } catch (error) {
            console.error('❌ Error in range analysis:', error);
            setProgress({
                isRunning: false,
                currentStep: '',
                progress: 0,
                error: `❌ שגיאה בניתוח טווח: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    };

    // Save to Firebase with correct format including future prices
    const saveToFirebaseCorrectFormat = async (
        analysisResults: AnalysisResult[], 
        analysisDate: string, 
        localDataInfo: LocalDataInfo | null,
        fSupportResistResults?: MarketStructureTypes.MarketStructureResult[],
        orchestrator?: any
    ) => {
        try {
            console.log('💾 Starting Firebase save with future prices...');
            
            if (!localDataInfo) {
                console.error('❌ No local data info available');
                return;
            }

            // Use the already loaded local data instead of fetching again
            const localData = orchestrator?.getLocalData() || null;
            
            if (!localData) {
                throw new Error('No local data available from orchestrator');
            }
            
            // Get all available dates and sort them
            const allDates = new Set<string>();
            localData.data.forEach((record: any) => {
                if (record.date) {
                    allDates.add(record.date);
                }
            });
            
            const sortedDates = Array.from(allDates).sort();
            console.log(`📅 Found ${sortedDates.length} trading dates`);
            
            // First try to find the original analysis date
            let currentDateIndex = sortedDates.indexOf(analysisDate);
            let dataDateToUse = analysisDate;
            
            if (currentDateIndex === -1) {
                // If original date not found, use the last trading day in data
                const lastTradingDayInData = sortedDates[sortedDates.length - 1];
                console.log(`📅 Original date ${analysisDate} not found, using last trading day: ${lastTradingDayInData}`);
                dataDateToUse = lastTradingDayInData;
                currentDateIndex = sortedDates.indexOf(dataDateToUse);
                
                if (currentDateIndex === -1) {
                    console.warn(`⚠️ Last trading day ${dataDateToUse} not found in data - skipping this date`);
                    return; // דילוג על התאריך הזה (הפונקציה תיקרא שוב לתאריך הבא)
                }
            } else {
                console.log(`📅 Found original date ${analysisDate} in data`);
            }
            
            console.log(`📅 Using data date: ${dataDateToUse}, index: ${currentDateIndex}`);
            
            console.log(`📊 Processing ${analysisResults.length} stocks for date ${analysisDate}`);
            
            // Process all stocks and collect results
            const stockResults = [];
            
            for (const stock of analysisResults) {
                const prices: { [key: string]: any } = {};
                
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
                
                // Get current price (previous trading day's closing price)
                const previousTradingDayStr = getPreviousTradingDay(dataDateToUse);
                
                const currentData = localData.data.find((record: any) => 
                    record.symbol === stock.symbol && record.date === previousTradingDayStr
                );
                
                if (currentData) {
                    prices.current = currentData.close;
                    
                    // Get future prices for day_1 to day_5 with complete OHLCV data
                    // Since we're using the last trading day, we need to look for future dates differently
                    for (let i = 1; i <= 5; i++) {
                        // Look for dates that come after the current trading day
                        const futureDateIndex = currentDateIndex + i;
                        if (futureDateIndex < sortedDates.length) {
                            const futureDate = sortedDates[futureDateIndex];
                            console.log(`🔍 Looking for ${stock.symbol} on ${futureDate} (day_${i})`);
                            const futureData = localData.data.find((record: any) => 
                                record.symbol === stock.symbol && record.date === futureDate
                            );
                            
                            if (futureData) {
                                prices[`day_${i}`] = {
                                    date: futureData.date,
                                    open: futureData.open,
                                    high: futureData.high,
                                    low: futureData.low,
                                    close: futureData.close,
                                    volume: futureData.volume
                                };
                            } else {
                                console.log(`⚠️ No data found for ${stock.symbol} on ${futureDate} (day_${i})`);
                                prices[`day_${i}`] = {
                                    date: futureDate || "",
                                    open: 0,
                                    high: 0,
                                    low: 0,
                                    close: 0,
                                    volume: 0
                                };
                }
            } else {
                            console.log(`⚠️ No future dates available for ${stock.symbol} (day_${i})`);
                            prices[`day_${i}`] = {
                                date: "",
                                open: 0,
                                high: 0,
                                low: 0,
                                close: 0,
                                volume: 0
                            };
                        }
                    }
                }
                
                const stockData = {
                    // Basic info
                    symbol: stock.symbol,
                    name: stock.symbol, // Using symbol as name for now
                    
                    // Dates
                    candleDate: analysisDate,
                    calculationDate: new Date().toISOString().split('T')[0],
                    
                    // Scores (using the correct field names from schema)
                    LongSpyScore: stock.bSpyScore,
                    LongAtrPriceScore: stock.cAtrPriceScore,
                    LongMomentumScore: stock.dSignalsScore,
                    candleScore: stock.candleScore,
                    LongAdxScore: stock.eAdxScore,
                    
                    // Alternative score names
                    adxScore: stock.eAdxScore,
                    momentumScore: stock.dSignalsScore,
                    
                    // Final score and signal
                    finalScore: stock.finalScore,
                    finalSignal: stock.finalScore >= 70 ? "LONG" : stock.finalScore < 30 ? "SHORT" : "NEUTRAL",
                    
                    // Prices
                    currentPrice: prices.current || 0,
                    entryPrice: prices.current || 0,
                    previousPrice: 0, // Will be calculated if needed
                    
                    // Prices for future days (proper structure with real data)
                    prices: {
                        day_1: {
                            date: prices.day_1?.date || sortedDates[currentDateIndex + 1] || "",
                            price: prices.day_1?.close || 0,
                            open: prices.day_1?.open || 0,
                            high: prices.day_1?.high || 0,
                            low: prices.day_1?.low || 0,
                            volume: prices.day_1?.volume || 0
                        },
                        day_2: {
                            date: prices.day_2?.date || sortedDates[currentDateIndex + 2] || "",
                            price: prices.day_2?.close || 0,
                            open: prices.day_2?.open || 0,
                            high: prices.day_2?.high || 0,
                            low: prices.day_2?.low || 0,
                            volume: prices.day_2?.volume || 0
                        },
                        day_3: {
                            date: prices.day_3?.date || sortedDates[currentDateIndex + 3] || "",
                            price: prices.day_3?.close || 0,
                            open: prices.day_3?.open || 0,
                            high: prices.day_3?.high || 0,
                            low: prices.day_3?.low || 0,
                            volume: prices.day_3?.volume || 0
                        },
                        day_4: {
                            date: prices.day_4?.date || sortedDates[currentDateIndex + 4] || "",
                            price: prices.day_4?.close || 0,
                            open: prices.day_4?.open || 0,
                            high: prices.day_4?.high || 0,
                            low: prices.day_4?.low || 0,
                            volume: prices.day_4?.volume || 0
                        },
                        day_5: {
                            date: prices.day_5?.date || sortedDates[currentDateIndex + 5] || "",
                            price: prices.day_5?.close || 0,
                            open: prices.day_5?.open || 0,
                            high: prices.day_5?.high || 0,
                            low: prices.day_5?.low || 0,
                            volume: prices.day_5?.volume || 0
                        }
                    },
                    
                    // Analysis completion flags
                    catrAnalysisCompleted: true,
                    momentumAnalysisCompleted: true,
                    marketStructureAnalysisCompleted: true,
                    rrAnalysisCompleted: false,
                    trendAnalysisCompleted: true,
                    
                    // Update timestamps
                    lastADXUpdate: new Date().toISOString(),
                    lastCAtrUpdate: new Date().toISOString(),
                    lastMomentumUpdate: new Date().toISOString(),
                    lastMarketStructureUpdate: new Date().toISOString(),
                    lastFinalScoreUpdate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    
                    // Analysis dates
                    momentumAnalysisDate: new Date().toISOString().split('T')[0],
                    marketStructureAnalysisDate: new Date().toISOString().split('T')[0],
                    trendAnalysisDate: new Date().toISOString().split('T')[0],
                    volatilityAnalysisDate: new Date().toISOString().split('T')[0],
                    
                    // Additional fields (default values)
                    relativeStrength: 0,
                    stockReturn: 0,
                    spyReturn: 0,
                    atrValue: 0,
                    atrRatio: 0,
                    adxValue: 0,
                    macdHistogram: 0,
                    crossoverType: "None",
                    trendStrength: "Unknown",
                    tradeStatus: "PENDING",
                    stopLoss: 0,
                    takeProfit: 0,
                    riskDollar: 0,
                    rewardDollar: 0,
                    rrRatio: 0,
                    rrMethod: "Not Calculated",
                    rrApproved: false,
                    rrConfidence: 0,
                    
                    // Market Structure Data (from FSupportResist)
                    marketStructure: fSupportResistResults?.find(f => f.symbol === stock.symbol) || null
                };
                
                // Only save stocks with finalScore > 65 to reduce Firebase document size
                if (stock.finalScore > 65) {
                stockResults.push(stockData);
                    console.log(`💾 Processed ${stock.symbol}: finalScore=${stock.finalScore}, current=${prices.current}, marketStructure=${stockData.marketStructure ? '✅' : '❌'}`);
                } else {
                    console.log(`⏭️ Skipped ${stock.symbol}: finalScore=${stock.finalScore} (below 65 threshold)`);
                }
            }
            
            // Market Structure data is now populated directly above
            
            // Save all stocks to Firebase in one document
            console.log(`🔥 Firebase Save Debug:`);
            console.log(`📊 Total stocks processed: ${stockResults.length} (finalScore > 65)`);
            console.log(`📋 Sample stocks:`, stockResults.slice(0, 3).map(s => ({
                symbol: s.symbol,
                finalScore: s.finalScore,
                hasMarketStructure: !!s.marketStructure,
                marketStructureKeys: s.marketStructure ? Object.keys(s.marketStructure) : []
            })));
            
            const firebaseData = {
                // Main document structure
                candleDate: analysisDate,
                calculationDate: new Date().toISOString().split('T')[0],
                totalStocks: stockResults.length, // Only stocks with finalScore > 60
                
                // Analysis completion flags
                catrAnalysisCompleted: true,
                momentumAnalysisCompleted: true,
                marketStructureAnalysisCompleted: true,
                rrAnalysisCompleted: false,
                trendAnalysisCompleted: true,
                
                // Update timestamps
                lastADXUpdate: new Date().toISOString(),
                lastCAtrUpdate: new Date().toISOString(),
                lastFinalScoreUpdate: new Date().toISOString(),
                lastMarketStructureUpdate: new Date().toISOString(),
                lastMomentumUpdate: new Date().toISOString(),
                lastUpdate: new Date().toISOString(),
                lastRRUpdate: new Date().toISOString(),
                
                // Results array
                results: stockResults,
                
                // Signals summary
                signals: {
                    long: stockResults.filter(r => r.finalScore >= 70).length,
                    short: stockResults.filter(r => r.finalScore < 30).length,
                    neutral: stockResults.filter(r => r.finalScore >= 30 && r.finalScore < 70).length
                },
                
                // RR Analysis Stats (default values)
                rrAnalysisStats: {
                    approvedTrades: 0,
                    rejectedTrades: 0,
                    avgRRRatio: 0,
                    totalStocks: stockResults.length // Only stocks with finalScore > 60
                },
                
                // SPY Data (default values)
                spyData: {
                    currentPrice: 0,
                    previousPrice: 0,
                    return: 0
                },
                
                version: "1.0"
            };
            
            // Use the selected Firebase collection or create new one based on file name
            let collectionName;
            let isNewCollection = false;
            if (selectedFirebaseCollection === 'Default (Create new collection)') {
                // Create new collection with the file name (without .json extension) and long_ prefix
                const fileName = selectedStockFile.replace('.json', '');
                if (fileName.startsWith('long_')) {
                    collectionName = fileName; // Avoid double prefix
                } else {
                    collectionName = `long_${fileName}`;
                }
                isNewCollection = true;
                console.log(`🔥 NEW CODE: Creating new collection: ${collectionName} based on selected file: ${selectedStockFile}`);
            } else {
                // Use existing collection
                collectionName = selectedFirebaseCollection;
                console.log(`🔥 NEW CODE: Using existing collection: ${collectionName}`);
            }
            
            const documentId = analysisDate;
            console.log(`🔥 NEW CODE: Saving to Firebase collection: ${collectionName}, documentId: ${documentId}`);
            console.log(`🔥 NEW CODE: Firebase data structure:`, firebaseData);
            await setDoc(doc(db, collectionName, documentId), firebaseData);
            
            // If this is a new collection, add it to the collections list
            if (isNewCollection) {
                await addCollectionToList(collectionName);
            }
            
            // Verify what was saved
            console.log(`✅ Saved to Firebase: ${collectionName}/${documentId}`);
            console.log(`📊 Document contains ${stockResults.length} stocks (finalScore > 65)`);
            console.log(`🔍 Market Structure verification:`, stockResults.map(s => ({
                symbol: s.symbol,
                finalScore: s.finalScore,
                hasMarketStructure: !!s.marketStructure,
                marketStructureComplete: s.marketStructure ? {
                    hasSupportLevels: !!s.marketStructure.supportLevels,
                    hasResistanceLevels: !!s.marketStructure.resistanceLevels,
                    hasMALevels: !!s.marketStructure.maLevels,
                    hasPivotPoints: !!s.marketStructure.pivotPoints,
                    hasVolumeAnalysis: !!s.marketStructure.volumeAnalysis,
                    hasSummary: !!s.marketStructure.summary
                } : null
            })));
            
            console.log('✅ Firebase save completed successfully');

        } catch (error) {
            console.error('❌ Error saving to Firebase:', error);
        }
    };

    // Delete all data for a specific date from Firebase
    const deleteFirebaseData = async (date: string) => {
        try {
            const confirmDelete = window.confirm(
                `⚠️ האם אתה בטוח שברצונך למחוק את כל הנתונים עבור ${date}?\n\nפעולה זו לא ניתנת לביטול!`
            );
            
            if (!confirmDelete) {
                console.log('❌ Deletion cancelled by user');
                return;
            }
            
            console.log(`🗑️ Deleting Firebase data for ${date}...`);
            await FirebaseService.deleteDateData(date);
            alert(`✅ Successfully deleted all data for ${date}`);
            
        } catch (error) {
            console.error('❌ Error deleting Firebase data:', error);
            alert(`❌ Error deleting data: ${error}`);
        }
    };

    // Check if data exists in Firebase
    const checkFirebaseData = async (date: string) => {
        try {
            console.log(`🔍 Checking Firebase data for ${date}...`);
            const data = await FirebaseService.getRelativeStrengthData(date);
            
            if (data) {
                console.log('✅ Data found in Firebase:', data);
                alert(`✅ Data found in Firebase for ${date}\nTotal stocks: ${data.totalStocks || 'Unknown'}\nAnalysis date: ${data.calculationDate || 'Unknown'}`);
            } else {
                console.log('❌ No data found in Firebase');
                alert(`❌ No data found in Firebase for ${date}`);
            }
        } catch (error) {
            console.error('❌ Error checking Firebase:', error);
            alert(`❌ Error checking Firebase: ${error}`);
        }
    };

    // Handle sort
    const handleSort = (field: keyof AnalysisResult) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortField === field && sortDirection === 'asc') {
            direction = 'desc';
        }
        setSortField(field);
        setSortDirection(direction);
    };

    // Get sorted results
    const getSortedResults = () => {
        return [...results].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];
            
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            
            return sortDirection === 'asc' 
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue));
        });
    };

    // Get score color
    const getScoreColor = (score: number) => {
        if (score >= 70) return '#4caf50'; // Green
        if (score >= 50) return '#2196f3'; // Blue
        return '#ff9800'; // Orange
    };

    return (
        <Box sx={{ p: 3 }}>
            <style>{spinKeyframes}</style>
            
            <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="primary" />
                Master Analysis - Full Stock Analysis
            </Typography>

            {/* Local Data Info */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        📊 Local Data Available
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={loadLocalDataInfo}
                            disabled={isLoadingData}
                            sx={{ ml: 'auto' }}
                        >
                            {isLoadingData ? <CircularProgress size={16} /> : <Refresh />}
                            {isLoadingData ? 'Loading...' : 'Refresh'}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => checkFirebaseData(singleDate)}
                            color="secondary"
                            sx={{ ml: 1 }}
                        >
                            🔍 Check Firebase
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => deleteFirebaseData(singleDate)}
                            color="error"
                            sx={{ ml: 1 }}
                        >
                            🗑️ Delete Firebase
                        </Button>
                    </Typography>
                    
                    {localDataInfo ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                📊 <strong>Local Data Available</strong><br/>
                                📅 <strong>Date Range:</strong> {localDataInfo.startDate} - {localDataInfo.endDate}<br/>
                                📈 <strong>Total Records:</strong> {localDataInfo.totalRecords.toLocaleString()}<br/>
                                🏢 <strong>Stocks:</strong> {localDataInfo.symbols.length}<br/>
                                📁 <strong>Location:</strong> src/Stocks/Util/{selectedStockFile === 'local_stock_data.json' ? '' : 'data/'}{selectedStockFile}
                            </Typography>
                        </Alert>
                    ) : (
                        <Alert severity="warning">
                            <Typography variant="body2">
                                ⚠️ <strong>No Local Data Found</strong><br/>
                                Make sure there's a file at src/Stocks/Util/local_stock_data.json
                            </Typography>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Analysis Info */}
            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    <strong>📊 Full Analysis - 6 Steps:</strong><br/>
                    🎯 <strong>BSpy:</strong> Ratio to SPY Index<br/>
                    📈 <strong>CAtrPrice:</strong> ATR + Bollinger Bands<br/>
                    🎯 <strong>DSignals:</strong> MACD Analysis<br/>
                    🕯️ <strong>DTCandles:</strong> Bullish Candles<br/>
                    📊 <strong>EAdx:</strong> ADX Trend Strength<br/>
                    📈 <strong>FSupportResist:</strong> Market Structure Analysis<br/>
                    ⏱️ <strong>Expected Time:</strong> 7-12 seconds per stock
                </Typography>
            </Alert>

            {/* Stock File Selection */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        📁 Select Stock Data File
                    </Typography>

                    <Stack spacing={2}>
                        <FormControl fullWidth>
                            <InputLabel>Stock Data File</InputLabel>
                            <Select
                                value={selectedStockFile}
                                onChange={(e) => setSelectedStockFile(e.target.value)}
                                label="Stock Data File"
                            >
                                {availableStockFiles.map((file) => (
                                    <MenuItem key={file.name} value={file.name}>
                                        {file.displayName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </CardContent>
            </Card>

            {/* Firebase Collection Selection */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        🔥 Select Firebase Collection
                        <Button variant="outlined" size="small" onClick={loadAvailableFirebaseCollections} sx={{ ml: 'auto' }}>
                            <Refresh /> רענן רשימה
                        </Button>
                    </Typography>

                    <Stack spacing={2}>
                        <FormControl fullWidth>
                            <InputLabel>Firebase Collection</InputLabel>
                            <Select
                                value={selectedFirebaseCollection}
                                onChange={(e) => setSelectedFirebaseCollection(e.target.value)}
                                label="Firebase Collection"
                            >
                                {availableFirebaseCollections.map((collection) => (
                                    <MenuItem key={collection} value={collection}>
                                        {collection}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </CardContent>
            </Card>

            {/* Analysis Mode Selection */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🎯 Select Analysis Mode
                    </Typography>

                    <Stack spacing={2}>
                        <FormControl fullWidth>
                            <InputLabel>Analysis Mode</InputLabel>
                            <Select
                                value={analysisMode}
                                onChange={(e) => setAnalysisMode(e.target.value as 'single' | 'range')}
                                label="Analysis Mode"
                            >
                                <MenuItem value="single">Single Date</MenuItem>
                                <MenuItem value="range">Date Range</MenuItem>
                            </Select>
                        </FormControl>

                        {analysisMode === 'single' ? (
                            <TextField
                                label="Analysis Date"
                                type="date"
                                value={singleDate}
                                onChange={(e) => setSingleDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        ) : (
                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="Start Date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    label="End Date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Stack>
                        )}

                            <Button
                                variant="contained"
                            size="large"
                                onClick={analysisMode === 'single' ? runSingleDateAnalysis : runDateRangeAnalysis}
                            disabled={progress.isRunning || !localDataInfo?.hasData}
                            sx={{ mt: 2 }}
                            >
                            <Rocket sx={{ mr: 1 }} />
                            {analysisMode === 'single' ? 'Analyze Date' : 'Analyze Range'}
                            </Button>
                    </Stack>
                </CardContent>
            </Card>

            {/* Progress */}
                            {progress.isRunning && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <CircularProgress 
                                size={24} 
                                sx={{ 
                                    animation: 'spin 1s linear infinite',
                                    color: 'primary.main'
                                }} 
                            />
                            <Typography variant="body1">
                                {progress.currentStep}
                            </Typography>
                    </Stack>
                </CardContent>
            </Card>
            )}

            {/* Error */}
            {progress.error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {progress.error}
                </Alert>
            )}

            {/* Results */}
            {results.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            📊 Analysis Results ({results.length} stocks)
                        </Typography>
                        
                        {/* Score Distribution */}
                        {results.length > 0 && (
                            <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                                <Typography variant="subtitle1" gutterBottom>
                                    📈 Score Distribution:
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    {(() => {
                                        const distribution = results.reduce((acc, stock) => {
                                            const range = stock.finalScore === 0 ? '0' :
                                                         stock.finalScore < 30 ? '0-30' : 
                                                         stock.finalScore > 60 ? '>60' : '30-60';
                                            acc[range] = (acc[range] || 0) + 1;
                                            return acc;
                                        }, {} as Record<string, number>);
                                        
                                        // Ensure all ranges are displayed, even with 0 count
                                        const allRanges = ['0', '0-30', '30-60', '>60'];
                                        return allRanges.map((range) => {
                                            const count = distribution[range] || 0;
                                            return (
                                                <Chip 
                                                    key={range}
                                                    label={`${range}: ${count}`}
                                                    color={range === '0' ? 'error' : range === '0-30' ? 'warning' : range === '>60' ? 'success' : 'default'}
                                                    variant="outlined"
                                                    size="small"
                                                />
                                            );
                                        });
                                    })()}
                                </Box>
                            </Box>
                        )}
                        
                        {/* FSupportResist Status */}
                        {results.length > 0 && (
                            <Box sx={{ mb: 2, p: 2, backgroundColor: '#e8f5e8', borderRadius: 1 }}>
                                <Typography variant="subtitle1" gutterBottom>
                                    📊 Market Structure Analysis:
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    {(() => {
                                        const withMarketStructure = results.filter(r => r.marketStructure).length;
                                        const withoutMarketStructure = results.length - withMarketStructure;
                                        
                                        return (
                                            <>
                                                <Chip 
                                                    label={`With Market Structure: ${withMarketStructure}`}
                                                    color="success"
                                                    variant="outlined"
                                                    size="small"
                                                />
                                                <Chip 
                                                    label={`Without Market Structure: ${withoutMarketStructure}`}
                                                    color="error"
                                                    variant="outlined"
                                                    size="small"
                                                />
                                            </>
                                        );
                                    })()}
                                </Box>
                            </Box>
                        )}
                        
                        <Typography variant="body2" sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1, fontFamily: 'monospace' }}>
                            <strong>🧮 Final Score Formula:</strong><br/>
                            Final Score = (BSpy × 0.18) + (CAtrPrice × 0.18) + (DSignals × 0.22) + (Candles × 0.05) + (EAdx × 0.27) + (MarketStructure × 0.10)
                        </Typography>

                        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                        <TableCell 
                                            sx={{ fontWeight: 'bold', minWidth: 60 }}
                                        >
                                            #
                                        </TableCell>
                                        <TableCell 
                                                        onClick={() => handleSort('symbol')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Stock {sortField === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('bSpyScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            BSpy {sortField === 'bSpyScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('cAtrPriceScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            CAtrPrice {sortField === 'cAtrPriceScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('dSignalsScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            DSignals {sortField === 'dSignalsScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('candleScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Candles {sortField === 'candleScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('eAdxScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            EAdx {sortField === 'eAdxScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('finalScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Final Score {sortField === 'finalScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell>Date</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                    {getSortedResults().map((result, index) => (
                                        <TableRow key={`${result.symbol}-${result.analysisDate}-${index}`}>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                                                            {index + 1}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.symbol} 
                                                    color="primary" 
                                                    variant="outlined"
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                    label={result.bSpyScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.bSpyScore), color: 'white' }}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.cAtrPriceScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.cAtrPriceScore), color: 'white' }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.dSignalsScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.dSignalsScore), color: 'white' }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.candleScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.candleScore), color: 'white' }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.eAdxScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.eAdxScore), color: 'white' }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.finalScore.toFixed(1)}
                                                    sx={{ 
                                                        backgroundColor: getScoreColor(result.finalScore), 
                                                        color: 'white',
                                                        fontWeight: 'bold'
                                                    }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                <Typography variant="caption">
                                                    {result.analysisDate}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                
                                {/* Market Structure Data Display */}
                                {(() => {
                                    console.log('🔍 Debug: results.length =', results.length);
                                    return null;
                                })()}
                                {results.length > 0 ? (
                                    <Card sx={{ mt: 2 }}>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Assessment color="primary" />
                                                📊 Market Structure Analysis (Stage F)
                                            </Typography>
                                            
                                            {getSortedResults().map((result, index) => {
                                                if (index === 0) {
                                                    console.log('🔍 Debug: Processing results, first result:', result);
                                                }
                                                return (
                                                <Accordion key={`market-structure-${result.symbol}-${index}`} sx={{ mb: 1 }}>
                                                    <AccordionSummary
                                                        expandIcon={<ExpandMore />}
                                                        sx={{ 
                                                            backgroundColor: result.finalScore > 70 ? '#e8f5e8' : 
                                                                          result.finalScore > 60 ? '#fff3cd' : '#f8d7da',
                                                            borderRadius: 1
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                                            <Chip 
                                                                label={result.symbol} 
                                                                color="primary" 
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                                                Final Score: {result.finalScore.toFixed(1)}
                                                            </Typography>
                                                            {result.marketStructure && (
                                                                <Chip 
                                                                    label={`Trend: ${result.marketStructure.summary?.trend || 'Unknown'}`}
                                                                    color={result.marketStructure.summary?.trend === 'Bullish' ? 'success' : 
                                                                           result.marketStructure.summary?.trend === 'Bearish' ? 'error' : 'default'}
                                                                    size="small"
                                                                />
                                                            )}
                                                            <Typography variant="caption" sx={{ ml: 'auto' }}>
                                                                {result.analysisDate}
                                                            </Typography>
                                                        </Box>
                                                    </AccordionSummary>
                                                    <AccordionDetails>
                                                        {result.marketStructure ? (
                                                            <Box sx={{ p: 2 }}>
                                                                {/* Summary */}
                                                                <Box sx={{ mb: 3 }}>
                                                                    <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Assessment color="primary" />
                                                                        📈 Summary
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                                        <Chip 
                                                                            label={`Trend: ${result.marketStructure.summary?.trend || 'Unknown'}`}
                                                                            color={result.marketStructure.summary?.trend === 'Bullish' ? 'success' : 
                                                                                   result.marketStructure.summary?.trend === 'Bearish' ? 'error' : 'default'}
                                                                            icon={<TrendingUp />}
                                                                        />
                                                                        <Chip 
                                                                            label={`Strength: ${result.marketStructure.summary?.strength || 0}/5`}
                                                                            color="info"
                                                                        />
                                                                        <Chip 
                                                                            label={`Confidence: ${result.marketStructure.summary?.confidence || 0}%`}
                                                                            color="secondary"
                                                                        />
                                                                    </Box>
                                                                </Box>

                                                                {/* Support Levels */}
                                                                <Box sx={{ mb: 3 }}>
                                                                    <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Support color="success" />
                                                                        🛡️ Support Levels
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                                        <Chip 
                                                                            label={`Primary: $${result.marketStructure.supportLevels?.primary?.price?.toFixed(2) || 'N/A'}`}
                                                                            color="success"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`Secondary: $${result.marketStructure.supportLevels?.secondary?.price?.toFixed(2) || 'N/A'}`}
                                                                            color="success"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`Tertiary: $${result.marketStructure.supportLevels?.tertiary?.price?.toFixed(2) || 'N/A'}`}
                                                                            color="success"
                                                                            variant="outlined"
                                                                        />
                                                                    </Box>
                                                                </Box>

                                                                {/* Resistance Levels */}
                                                                <Box sx={{ mb: 3 }}>
                                                                    <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <TrendingDown color="error" />
                                                                        🚧 Resistance Levels
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                                        <Chip 
                                                                            label={`Primary: $${result.marketStructure.resistanceLevels?.primary?.price?.toFixed(2) || 'N/A'}`}
                                                                            color="error"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`Secondary: $${result.marketStructure.resistanceLevels?.secondary?.price?.toFixed(2) || 'N/A'}`}
                                                                            color="error"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`Tertiary: $${result.marketStructure.resistanceLevels?.tertiary?.price?.toFixed(2) || 'N/A'}`}
                                                                            color="error"
                                                                            variant="outlined"
                                                                        />
                                                                    </Box>
                                                                </Box>

                                                                {/* MA Levels */}
                                                                <Box sx={{ mb: 3 }}>
                                                                    <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <ShowChart color="info" />
                                                                        📊 Moving Averages
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                                        <Chip 
                                                                            label={`SMA20: $${result.marketStructure.maLevels?.sma20?.toFixed(2) || 'N/A'}`}
                                                                            color="info"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`SMA50: $${result.marketStructure.maLevels?.sma50?.toFixed(2) || 'N/A'}`}
                                                                            color="info"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`SMA200: $${result.marketStructure.maLevels?.sma200?.toFixed(2) || 'N/A'}`}
                                                                            color="info"
                                                                            variant="outlined"
                                                                        />
                                                                    </Box>
                                                                </Box>

                                                                {/* Pivot Points */}
                                                                <Box sx={{ mb: 3 }}>
                                                                    <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Assessment color="warning" />
                                                                        🎯 Pivot Points
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                                        <Chip 
                                                                            label={`PP: $${result.marketStructure.pivotPoints?.pp?.toFixed(2) || 'N/A'}`}
                                                                            color="warning"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`R1: $${result.marketStructure.pivotPoints?.r1?.toFixed(2) || 'N/A'}`}
                                                                            color="error"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`R2: $${result.marketStructure.pivotPoints?.r2?.toFixed(2) || 'N/A'}`}
                                                                            color="error"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`S1: $${result.marketStructure.pivotPoints?.s1?.toFixed(2) || 'N/A'}`}
                                                                            color="success"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`S2: $${result.marketStructure.pivotPoints?.s2?.toFixed(2) || 'N/A'}`}
                                                                            color="success"
                                                                            variant="outlined"
                                                                        />
                                                                    </Box>
                                                                </Box>

                                                                {/* Volume Analysis */}
                                                                <Box sx={{ mb: 2 }}>
                                                                    <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <TrendingUp color="secondary" />
                                                                        📊 Volume Analysis
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                                        <Chip 
                                                                            label={`Avg Volume: ${result.marketStructure.volumeAnalysis?.avgVolume?.toLocaleString() || 'N/A'}`}
                                                                            color="secondary"
                                                                            variant="outlined"
                                                                        />
                                                                        <Chip 
                                                                            label={`Volume Strength: ${result.marketStructure.volumeAnalysis?.volumeStrength?.toFixed(2) || 'N/A'}`}
                                                                            color="secondary"
                                                                            variant="outlined"
                                                                        />
                                                                    </Box>
                                                                </Box>
                                                            </Box>
                                                        ) : (
                                                            <Box sx={{ p: 2, textAlign: 'center' }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    ⚠️ No Market Structure data available
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </AccordionDetails>
                                                </Accordion>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card sx={{ mt: 2 }}>
                                        <CardContent>
                                            <Typography variant="body2" color="text.secondary">
                                                🔍 Debug: No results to display (results.length = {results.length})
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                )}
                            </CardContent>
                        </Card>
            )}
        </Box>
    );
};

export default MasterAnalysis;
