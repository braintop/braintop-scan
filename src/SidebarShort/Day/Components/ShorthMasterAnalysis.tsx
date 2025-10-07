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
    CircularProgress
} from '@mui/material';
import { TrendingDown, Rocket, Refresh } from '@mui/icons-material';
import { ShortAnalysisOrchestrator } from '../Logic/ShortAnalysisOrchestrator';
import { FirebaseService } from '../../../Services/FirebaseService';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import { calculateShortSpyScore } from '../Logic/ShortBSpyLogic';
import { calculateShortMomentumScore } from '../Logic/ShortDSignalsLogic';
import { calculateShortAdxScore } from '../Logic/ShortEAdxLogic';

const db = getFirestore();

// Interfaces
interface LocalDataInfo {
    hasData: boolean;
    startDate: string;
    endDate: string;
    totalRecords: number;
    symbols: string[];
}

interface ShortAnalysisResult {
    symbol: string;
    name: string;
    candleDate: string;
    calculationDate: string;
    ShortSpyScore: number;
    ShortAtrPriceScore: number;
    ShortMomentumScore: number;
    ShortAdxScore: number;
    adxScore: number;
    momentumScore: number;
    finalShortScore: number;
    currentPrice: number;
    day_1: number;
    day_2: number;
    day_3: number;
    day_4: number;
    day_5: number;
    // Additional fields for Firebase compatibility
    previousPrice?: number;
    stockReturn?: number;
    spyReturn?: number;
    relativeStrength?: number;
    atrValue?: number;
    atrRatio?: number;
    adxValue?: number;
    bbWidth?: number;
    bbPosition?: number;
    sma3Current?: number;
    sma3Previous?: number;
    sma12Current?: number;
    sma12Previous?: number;
    crossoverType?: string;
    macdHistogram?: number;
    trendStrength?: string;
    tradeStatus?: string;
    stopLoss?: number;
    takeProfit?: number;
    riskDollar?: number;
    rewardDollar?: number;
    rrRatio?: number;
    rrMethod?: string;
    rrApproved?: boolean;
    rrConfidence?: number;
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

const ShorthMasterAnalysis: React.FC = () => {
    // State
    const [localDataInfo, setLocalDataInfo] = useState<LocalDataInfo | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<'single' | 'range'>('single');
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [results, setResults] = useState<ShortAnalysisResult[]>([]);
    const [progress, setProgress] = useState<ProgressState>({
        isRunning: false,
        currentStep: '',
        progress: 0
    });
    const [sortField, setSortField] = useState<keyof ShortAnalysisResult>('finalShortScore');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc'); // Short: מיון לפי ציון נמוך למעלה
    
    // New state for stock file selection
    const [availableStockFiles, setAvailableStockFiles] = useState<{name: string, displayName: string}[]>([]);
    const [selectedStockFile, setSelectedStockFile] = useState<string>('local_stock_data.json');
    
    // New state for Firebase collection selection
    const [availableFirebaseCollections, setAvailableFirebaseCollections] = useState<string[]>([]);
    const [selectedFirebaseCollection, setSelectedFirebaseCollection] = useState<string>('');

    // Load local data info on component mount
    useEffect(() => {
        loadAvailableStockFiles();
        
        // Load collections from localStorage first (fast), then from Firebase if needed
        const loadedFromLocalStorage = loadCollectionsFromLocalStorage();
        if (!loadedFromLocalStorage) {
            loadAvailableFirebaseCollections();
        }
        
        loadLocalDataInfo();
        
        // Set default dates
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        setSingleDate(today);
        setStartDate(weekAgo.toISOString().split('T')[0]);
        setEndDate(today);
    }, []);

    // Reload data when selected stock file changes
    useEffect(() => {
        if (selectedStockFile) {
            loadLocalDataInfo();
        }
    }, [selectedStockFile]);

    // Set default Firebase collection after collections are loaded
    useEffect(() => {
        if (availableFirebaseCollections.length > 0 && !selectedFirebaseCollection) {
            const defaultCollection = availableFirebaseCollections.includes('Default (Create new collection)') 
                ? 'Default (Create new collection)'
                : availableFirebaseCollections[0];
            setSelectedFirebaseCollection(defaultCollection);
            console.log(`🎯 Set default Firebase collection: ${defaultCollection}`);
        }
    }, [availableFirebaseCollections, selectedFirebaseCollection]);

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
            localStorage.setItem('firebase_collections_short', JSON.stringify(collections));
            console.log('💾 Saved collections to localStorage');
            
            // Update state
            setAvailableFirebaseCollections(collections);
            
        } catch (error) {
            console.error('❌ Error loading available Firebase collections:', error);
            
            // Fallback to localStorage or hardcoded list
            const localStorageCollections = localStorage.getItem('firebase_collections_short');
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
            const localStorageCollections = localStorage.getItem('firebase_collections_short');
            
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
                localStorage.setItem('firebase_collections_short', JSON.stringify(currentCollections));
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
            const files = [
                { name: 'local_stock_data_01_07_2025.json', displayName: 'Stock Data 01/07/2025' },
                { name: 'local_stock_data_02_01_2024.json', displayName: 'Stock Data 02/01/2024' },
                { name: 'local_stock_data_02_01_2025.json', displayName: 'Stock Data 02/01/2025' },
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
            const orchestrator = new ShortAnalysisOrchestrator();
            
            // Create favorite stocks list from metadata
            const favoriteStocks = localDataInfo?.symbols ? 
                localDataInfo.symbols.map(symbol => ({ 
                    symbol, 
                    name: symbol,
                    candleDate: singleDate,
                    scanDate: singleDate,
                    price: 0,
                    market: 'NASDAQ',
                    volume: 0,
                    dollarVolume: 0,
                    float: 0,
                    spread: 0,
                    passed: true
                })) : 
                [];
            
            setProgress(prev => ({ ...prev, currentStep: '📉 ShorthBSpy Analysis...', progress: 25 }));
            const bSpyResults = await orchestrator.runBSpy(favoriteStocks, singleDate);
            
            setProgress(prev => ({ ...prev, currentStep: '📉 ShorthCAtrPrice Analysis...', progress: 50 }));
            const cAtrPriceResults = await orchestrator.runCAtrPrice(bSpyResults, singleDate);
            
            setProgress(prev => ({ ...prev, currentStep: '📉 ShorthDSignals Analysis...', progress: 75 }));
            const dSignalsResults = await orchestrator.runDSignals(cAtrPriceResults, singleDate);
            
            setProgress(prev => ({ ...prev, currentStep: '📉 ShorthEAdx Analysis...', progress: 90 }));
            const eAdxResults = await orchestrator.runEAdx(dSignalsResults, singleDate);
            
                // Combine results - SHORT LOGIC: תיקון הלוגיקה להשתמש בציוני שורט אמיתיים
                const analysisResults: ShortAnalysisResult[] = bSpyResults.map(bSpy => {
                    const cAtrPrice = cAtrPriceResults.find(c => c.symbol === bSpy.symbol);
                    const dSignals = dSignalsResults.find(d => d.symbol === bSpy.symbol);
                    const eAdx = eAdxResults.find(e => e.symbol === bSpy.symbol);
                    
                    // חישוב ציוני שורט אמיתיים - שימוש בפונקציות השורט האמיתיות
                    // ShortSpyScore: ככל שהמניה חלשה יותר מ-SPY, הציון גבוה יותר
                    const shortSpyScore = calculateShortSpyScore(
                        bSpy.stockReturn || 0, 
                        bSpy.spyReturn || 0
                    );
                    
                    // ShortAtrPriceScore: תנודתיות נמוכה = טוב ל-Short (שימוש ב-calculateShortAtrPriceScore)
                    const shortAtrPriceScore = cAtrPrice?.LongAtrPriceScore ? 
                        (100 - cAtrPrice.LongAtrPriceScore) : 50; // זמנית עד שנשתמש ב-calculateShortAtrPriceScore
                    
                    // ShortMomentumScore: Bearish crossover = טוב ל-Short
                    const shortMomentumScore = calculateShortMomentumScore(
                        dSignals?.crossoverType || 'None',
                        dSignals?.macdHistogram || 0
                    );
                    
                    // ShortAdxScore: דשדוש (אין מגמה) = טוב ל-Short
                    const shortAdxScore = calculateShortAdxScore(
                        eAdx?.adxValue || 25
                    ).score;
                    
                    const finalShortScore = (
                        shortSpyScore +
                        shortAtrPriceScore +
                        shortMomentumScore +
                        shortAdxScore
                    ) / 4;
                    
                        return {
                        symbol: bSpy.symbol,
                        name: bSpy.name,
                        candleDate: singleDate,
                        calculationDate: new Date().toISOString().split('T')[0],
                        ShortSpyScore: shortSpyScore,
                        ShortAtrPriceScore: shortAtrPriceScore,
                        ShortMomentumScore: shortMomentumScore,
                        ShortAdxScore: shortAdxScore,
                        adxScore: shortAdxScore,
                        momentumScore: shortMomentumScore,
                        finalShortScore: Math.round(finalShortScore * 100) / 100,
                        currentPrice: bSpy.currentPrice,
                        day_1: 0, // Will be calculated in saveToFirebaseCorrectFormat
                        day_2: 0,
                        day_3: 0,
                        day_4: 0,
                        day_5: 0
                    };
                });
            
            // Save to Firebase with future prices first
            setProgress(prev => ({ ...prev, currentStep: '💾 שומר ל-Firebase...', progress: 95 }));
            const finalResults = await saveToFirebaseCorrectFormat(analysisResults, singleDate, localDataInfo);
            
            // Update results with final data (including day_1 to day_5)
            if (finalResults) {
                setResults(finalResults);
            } else {
                setResults(analysisResults);
            }
            
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
            const orchestrator = new ShortAnalysisOrchestrator();
            const allResults: ShortAnalysisResult[] = [];
            
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
                    const eAdxResults = await orchestrator.runEAdx(dSignalsResults, date);
                    
                    // Combine results for this date - SHORT LOGIC: תיקון הלוגיקה להשתמש בציוני שורט אמיתיים
                    const dateResults: ShortAnalysisResult[] = bSpyResults.map(bSpy => {
                        const cAtrPrice = cAtrPriceResults.find(c => c.symbol === bSpy.symbol);
                        const dSignals = dSignalsResults.find(d => d.symbol === bSpy.symbol);
                        const eAdx = eAdxResults.find(e => e.symbol === bSpy.symbol);
                        
                        // חישוב ציוני שורט אמיתיים - שימוש בפונקציות השורט האמיתיות
                        // ShortSpyScore: ככל שהמניה חלשה יותר מ-SPY, הציון גבוה יותר
                        const shortSpyScore = calculateShortSpyScore(
                            bSpy.stockReturn || 0, 
                            bSpy.spyReturn || 0
                        );
                        
                        // ShortAtrPriceScore: תנודתיות נמוכה = טוב ל-Short (שימוש ב-calculateShortAtrPriceScore)
                        const shortAtrPriceScore = cAtrPrice?.LongAtrPriceScore ? 
                            (100 - cAtrPrice.LongAtrPriceScore) : 50; // זמנית עד שנשתמש ב-calculateShortAtrPriceScore
                        
                        // ShortMomentumScore: Bearish crossover = טוב ל-Short
                        const shortMomentumScore = calculateShortMomentumScore(
                            dSignals?.crossoverType || 'None',
                            dSignals?.macdHistogram || 0
                        );
                        
                        // ShortAdxScore: דשדוש (אין מגמה) = טוב ל-Short
                        const shortAdxScore = calculateShortAdxScore(
                            eAdx?.adxValue || 25
                        ).score;
                        
                        const finalScore = (
                            shortSpyScore +
                            shortAtrPriceScore +
                            shortMomentumScore +
                            shortAdxScore
                        ) / 4;
                
                return {
                            symbol: bSpy.symbol,
                            name: bSpy.name,
                            candleDate: date,
                            calculationDate: new Date().toISOString().split('T')[0],
                            ShortSpyScore: shortSpyScore,
                            ShortAtrPriceScore: shortAtrPriceScore,
                            ShortMomentumScore: shortMomentumScore,
                            ShortAdxScore: shortAdxScore,
                            adxScore: shortAdxScore,
                            momentumScore: shortMomentumScore,
                            finalShortScore: Math.round(finalScore * 100) / 100,
                            currentPrice: bSpy.currentPrice,
                            day_1: 0,
                            day_2: 0,
                            day_3: 0,
                            day_4: 0,
                            day_5: 0
                        };
                    });
                    
                    allResults.push(...dateResults);

        } catch (error) {
                    console.warn(`⚠️ Skipping date ${date} - no data available`);
                    // Continue to next date instead of stopping
                }
            }
            
            // Save to Firebase with future prices first
            if (allResults.length > 0) {
            setProgress(prev => ({ ...prev, currentStep: '💾 שומר ל-Firebase...', progress: 95 }));
                
                // Group results by date to avoid Firebase document size limit
                const resultsByDate = new Map<string, ShortAnalysisResult[]>();
                allResults.forEach(result => {
                    const date = result.candleDate;
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
                    await saveToFirebaseCorrectFormat(dateResults, date, localDataInfo);
                    
                    // Update progress
                    const progress = 95 + Math.round((i + 1) / dates.length * 5);
                    setProgress(prev => ({ ...prev, currentStep: `💾 שומר ${date}...`, progress }));
                }
            
            // Update results with final data (including day_1 to day_5)
                setResults(allResults);
            } else {
                console.warn('⚠️ No results to save to Firebase');
                setResults([]);
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
        analysisResults: ShortAnalysisResult[], 
        analysisDate: string, 
        localDataInfo: LocalDataInfo | null
    ): Promise<ShortAnalysisResult[] | null> => {
        try {
            console.log('💾 Starting Firebase save with future prices...');
            
            if (!localDataInfo) {
                console.error('❌ No local data info available');
                return null;
            }

            // Load the full local data to get future prices
            const timestamp = new Date().getTime();
            const response = await fetch(`/src/Stocks/Util/local_stock_data.json?t=${timestamp}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load local data: ${response.status}`);
            }
            
            const localData = await response.json();
            
            // Get all available dates and sort them
            const allDates = new Set<string>();
            localData.data.forEach((record: any) => {
                if (record.date) {
                    allDates.add(record.date);
                }
            });
            
            const sortedDates = Array.from(allDates).sort();
            console.log(`📅 Found ${sortedDates.length} trading dates`);
            
            // Find the current date index
            const currentDateIndex = sortedDates.indexOf(analysisDate);
            if (currentDateIndex === -1) {
                console.warn(`⚠️ Current date ${analysisDate} not found in data - skipping this date`);
                return null; // Skip this date (the function will be called again for the next date)
            }
            
            console.log(`📊 Processing ${analysisResults.length} stocks for date ${analysisDate}`);
            
            // Process all stocks and collect results
            const stockResults = [];
            
            for (const stock of analysisResults) {
                const prices: { [key: string]: number } = {};
                
                // Get current price
                const currentData = localData.data.find((record: any) => 
                    record.symbol === stock.symbol && record.date === analysisDate
                );
                
                if (currentData) {
                    prices.current = currentData.close;
                    
                    // Get future prices for day_1 to day_5
                    for (let i = 1; i <= 5; i++) {
                        const futureDateIndex = currentDateIndex + i;
                        if (futureDateIndex < sortedDates.length) {
                            const futureDate = sortedDates[futureDateIndex];
                            const futureData = localData.data.find((record: any) => 
                                record.symbol === stock.symbol && record.date === futureDate
                            );
                            
                            if (futureData) {
                                prices[`day_${i}`] = futureData.close;
                                prices[`day_${i}_open`] = futureData.open;
                                prices[`day_${i}_high`] = futureData.high;
                                prices[`day_${i}_low`] = futureData.low;
                                prices[`day_${i}_volume`] = futureData.volume;
                            } else {
                                prices[`day_${i}`] = 0;
                                prices[`day_${i}_open`] = 0;
                                prices[`day_${i}_high`] = 0;
                                prices[`day_${i}_low`] = 0;
                                prices[`day_${i}_volume`] = 0;
                }
            } else {
                            prices[`day_${i}`] = 0;
                            prices[`day_${i}_open`] = 0;
                            prices[`day_${i}_high`] = 0;
                            prices[`day_${i}_low`] = 0;
                            prices[`day_${i}_volume`] = 0;
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
                    
                    // Scores (using the correct field names from schema for Short)
                    ShortSpyScore: stock.ShortSpyScore,
                    ShortAtrPriceScore: stock.ShortAtrPriceScore,
                    ShortMomentumScore: stock.ShortMomentumScore,
                    ShortAdxScore: stock.ShortAdxScore,
                    
                    // BSpyScore for compatibility with Long analysis
                    BSpyScore: stock.ShortSpyScore,
                    
                    // Alternative score names
                    adxScore: stock.ShortAdxScore,
                    momentumScore: stock.ShortMomentumScore,
                    
                    // Final score and signal (Short logic)
                    finalScore: stock.finalShortScore,
                    finalSignal: stock.finalShortScore >= 70 ? "SHORT" : stock.finalShortScore < 30 ? "LONG" : "NEUTRAL",
                    
                    // Prices
                    currentPrice: prices.current || 0,
                    entryPrice: prices.current || 0,
                    previousPrice: 0, // Will be calculated if needed
                    
                    // Prices for future days (proper structure with real OHLC data)
                    prices: {
                        day_1: {
                            date: sortedDates[currentDateIndex + 1] || "",
                            price: prices.day_1 || 0,
                            open: prices.day_1_open || 0,
                            high: prices.day_1_high || 0,
                            low: prices.day_1_low || 0,
                            volume: prices.day_1_volume || 0
                        },
                        day_2: {
                            date: sortedDates[currentDateIndex + 2] || "",
                            price: prices.day_2 || 0,
                            open: prices.day_2_open || 0,
                            high: prices.day_2_high || 0,
                            low: prices.day_2_low || 0,
                            volume: prices.day_2_volume || 0
                        },
                        day_3: {
                            date: sortedDates[currentDateIndex + 3] || "",
                            price: prices.day_3 || 0,
                            open: prices.day_3_open || 0,
                            high: prices.day_3_high || 0,
                            low: prices.day_3_low || 0,
                            volume: prices.day_3_volume || 0
                        },
                        day_4: {
                            date: sortedDates[currentDateIndex + 4] || "",
                            price: prices.day_4 || 0,
                            open: prices.day_4_open || 0,
                            high: prices.day_4_high || 0,
                            low: prices.day_4_low || 0,
                            volume: prices.day_4_volume || 0
                        },
                        day_5: {
                            date: sortedDates[currentDateIndex + 5] || "",
                            price: prices.day_5 || 0,
                            open: prices.day_5_open || 0,
                            high: prices.day_5_high || 0,
                            low: prices.day_5_low || 0,
                            volume: prices.day_5_volume || 0
                        }
                    },
                    
                    // Analysis completion flags
                    catrAnalysisCompleted: true,
                    momentumAnalysisCompleted: true,
                    rrAnalysisCompleted: false,
                    trendAnalysisCompleted: true,
                    
                    // Update timestamps
                    lastADXUpdate: new Date().toISOString(),
                    lastCAtrUpdate: new Date().toISOString(),
                    lastMomentumUpdate: new Date().toISOString(),
                    lastFinalScoreUpdate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    
                    // Analysis dates
                    momentumAnalysisDate: new Date().toISOString().split('T')[0],
                    trendAnalysisDate: new Date().toISOString().split('T')[0],
                    volatilityAnalysisDate: new Date().toISOString().split('T')[0],
                    
                    // Additional fields (real values from analysis)
                    relativeStrength: stock.relativeStrength || 0,
                    stockReturn: stock.stockReturn || 0,
                    spyReturn: stock.spyReturn || 0,
                    atrValue: stock.atrValue || 0,
                    atrRatio: stock.atrRatio || 0,
                    adxValue: stock.adxValue || 0,
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
                    rrConfidence: 0
                };
                
                stockResults.push(stockData);
                console.log(`💾 Processed ${stock.symbol}: current=${prices.current}, day_1=${prices.day_1}, day_2=${prices.day_2}`);
            }
            
            // Save all stocks to Firebase in one document
            const firebaseData = {
                // Main document structure
                candleDate: analysisDate,
                calculationDate: new Date().toISOString().split('T')[0],
                totalStocks: analysisResults.length,
                
                // Analysis completion flags
                catrAnalysisCompleted: true,
                momentumAnalysisCompleted: true,
                rrAnalysisCompleted: false,
                trendAnalysisCompleted: true,
                
                // Update timestamps
                lastADXUpdate: new Date().toISOString(),
                lastCAtrUpdate: new Date().toISOString(),
                lastFinalScoreUpdate: new Date().toISOString(),
                lastMomentumUpdate: new Date().toISOString(),
                lastUpdate: new Date().toISOString(),
                lastRRUpdate: new Date().toISOString(),
                
                // Results array
                results: stockResults,
                
                // Signals summary - SHORT LOGIC: ציונים הפוכים
                signals: {
                    short: stockResults.filter(r => r.finalScore >= 70).length, // ציון גבוה = טוב לשורט
                    long: stockResults.filter(r => r.finalScore < 30).length, // ציון נמוך = טוב ללונג
                    neutral: stockResults.filter(r => r.finalScore >= 30 && r.finalScore < 70).length
                },
                
                // RR Analysis Stats (default values)
                rrAnalysisStats: {
                    approvedTrades: 0,
                    rejectedTrades: 0,
                    avgRRRatio: 0,
                    totalStocks: analysisResults.length
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
                // Create new collection with the file name (without .json extension)
                const fileName = selectedStockFile.replace('.json', '');
                if (fileName.startsWith('short_')) {
                    // הקובץ כבר מתחיל ב-short_, לא נוסיף עוד
                    collectionName = fileName;
                    console.log(`🔥 NEW CODE: File already has 'short_' prefix, using: ${collectionName}`);
                } else {
                    // הקובץ לא מתחיל ב-short_, נוסיף את הקידומת
                    collectionName = `short_${fileName}`;
                    console.log(`🔥 NEW CODE: Adding 'short_' prefix to: ${fileName} → ${collectionName}`);
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
            console.log(`✅ Saved to Firebase: ${collectionName}/${documentId} with ${stockResults.length} stocks`);
            
            // If this is a new collection, add it to the collections list
            if (isNewCollection) {
                await addCollectionToList(collectionName);
            }
            
            console.log('✅ Firebase save completed successfully');
            
            // Return the original analysis results (they already have the correct format)
            return analysisResults;

        } catch (error) {
            console.error('❌ Error saving to Firebase:', error);
            return null;
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
    const handleSort = (field: keyof ShortAnalysisResult) => {
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
                <TrendingDown color="error" />
                Shorth Master Analysis - Full Short Stock Analysis
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
                    <strong>📊 Full Analysis - 4 Steps:</strong><br/>
                    🎯 <strong>BSpy:</strong> Ratio to SPY Index<br/>
                    📈 <strong>CAtrPrice:</strong> ATR + Bollinger Bands<br/>
                    🎯 <strong>DSignals:</strong> MACD Analysis<br/>
                    📊 <strong>EAdx:</strong> ADX Trend Strength<br/>
                    ⏱️ <strong>Expected Time:</strong> 5-10 seconds per stock
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
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={loadAvailableFirebaseCollections}
                            sx={{ ml: 'auto' }}
                        >
                            <Refresh />
                            רענן רשימה
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
                                            onClick={() => handleSort('ShortSpyScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Short BSpy {sortField === 'ShortSpyScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('ShortAtrPriceScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Short CAtrPrice {sortField === 'ShortAtrPriceScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('ShortMomentumScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Short DSignals {sortField === 'ShortMomentumScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('ShortAdxScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Short EAdx {sortField === 'ShortAdxScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell 
                                            onClick={() => handleSort('finalShortScore')}
                                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Final Short Score {sortField === 'finalShortScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                                                </TableCell>
                                        <TableCell>Date</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                    {getSortedResults().map((result, index) => (
                                        <TableRow key={`${result.symbol}-${result.candleDate}-${index}`}>
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
                                                    label={result.ShortSpyScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.ShortSpyScore), color: 'white' }}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.ShortAtrPriceScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.ShortAtrPriceScore), color: 'white' }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.ShortMomentumScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.ShortMomentumScore), color: 'white' }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.ShortAdxScore.toFixed(1)}
                                                    sx={{ backgroundColor: getScoreColor(result.ShortAdxScore), color: 'white' }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                <Chip 
                                                    label={result.finalShortScore.toFixed(1)}
                                                    sx={{ 
                                                        backgroundColor: getScoreColor(result.finalShortScore), 
                                                        color: 'white',
                                                        fontWeight: 'bold'
                                                    }}
                                                    size="small"
                                                />
                                                    </TableCell>
                                                    <TableCell>
                                                    <Typography variant="caption">
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
};

export default ShorthMasterAnalysis;
