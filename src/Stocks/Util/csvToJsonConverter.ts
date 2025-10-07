import fs from 'fs';
// import path from 'path';

// Interface עבור נתוני מניה
interface StockData {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjusted_close?: number;
}

// Interface עבור קובץ JSON הסופי
interface StockDataFile {
    metadata: {
        created: string;
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
        description: string;
    };
    data: StockData[];
}

/**
 * ממיר קובץ CSV לנתוני מניות ל-JSON
 * @param csvFilePath - נתיב לקובץ CSV
 * @param outputPath - נתיב לשמירת קובץ JSON
 */
export function convertCsvToJson(csvFilePath: string, outputPath: string): void {
    try {
        console.log('🔄 Starting CSV to JSON conversion...');
        
        // קריאת קובץ CSV
        const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            throw new Error('CSV file is empty or has no data rows');
        }
        
        // קבלת כותרות
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        console.log('📋 CSV Headers:', headers);
        
        // מיפוי עמודות (גמיש)
        const getColumnIndex = (possibleNames: string[]): number => {
            for (const name of possibleNames) {
                const index = headers.findIndex(h => h.includes(name));
                if (index !== -1) return index;
            }
            return -1;
        };
        
        const dateIndex = getColumnIndex(['date', 'timestamp', 'time']);
        const symbolIndex = getColumnIndex(['symbol', 'ticker', 'stock']);
        const openIndex = getColumnIndex(['open', 'o']);
        const highIndex = getColumnIndex(['high', 'h']);
        const lowIndex = getColumnIndex(['low', 'l']);
        const closeIndex = getColumnIndex(['close', 'c', 'price']);
        const volumeIndex = getColumnIndex(['volume', 'vol', 'v']);
        const adjustedCloseIndex = getColumnIndex(['adjusted_close', 'adj_close', 'adjusted']);
        
        // בדיקת עמודות חובה
        if (dateIndex === -1 || symbolIndex === -1 || openIndex === -1 || 
            highIndex === -1 || lowIndex === -1 || closeIndex === -1 || volumeIndex === -1) {
            throw new Error('Missing required columns. Need: date, symbol, open, high, low, close, volume');
        }
        
        console.log('✅ Found all required columns');
        
        // עיבוד נתונים
        const stockData: StockData[] = [];
        const symbols = new Set<string>();
        let startDate = '';
        let endDate = '';
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            
            if (values.length < headers.length) {
                console.warn(`⚠️ Skipping incomplete row ${i + 1}`);
                continue;
            }
            
            try {
                const stock: StockData = {
                    date: values[dateIndex],
                    symbol: values[symbolIndex].toUpperCase(),
                    open: parseFloat(values[openIndex]) || 0,
                    high: parseFloat(values[highIndex]) || 0,
                    low: parseFloat(values[lowIndex]) || 0,
                    close: parseFloat(values[closeIndex]) || 0,
                    volume: parseInt(values[volumeIndex]) || 0
                };
                
                // הוספת adjusted_close אם קיים
                if (adjustedCloseIndex !== -1 && values[adjustedCloseIndex]) {
                    stock.adjusted_close = parseFloat(values[adjustedCloseIndex]) || stock.close;
                }
                
                // בדיקת תקינות נתונים
                if (stock.open > 0 && stock.high > 0 && stock.low > 0 && 
                    stock.close > 0 && stock.volume > 0) {
                    
                    stockData.push(stock);
                    symbols.add(stock.symbol);
                    
                    // עדכון תאריכים
                    if (!startDate || stock.date < startDate) startDate = stock.date;
                    if (!endDate || stock.date > endDate) endDate = stock.date;
                } else {
                    console.warn(`⚠️ Skipping invalid data row ${i + 1}:`, stock);
                }
                
            } catch (error) {
                console.warn(`⚠️ Error parsing row ${i + 1}:`, error);
            }
        }
        
        // מיון לפי תאריך ואז לפי סימול
        stockData.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.symbol.localeCompare(b.symbol);
        });
        
        // יצירת קובץ JSON
        const jsonData: StockDataFile = {
            metadata: {
                created: new Date().toISOString(),
                startDate,
                endDate,
                totalRecords: stockData.length,
                symbols: Array.from(symbols).sort(),
                description: `Stock data from ${startDate} to ${endDate} - ${symbols.size} symbols, ${stockData.length} records`
            },
            data: stockData
        };
        
        // שמירת קובץ
        fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
        
        console.log('✅ Conversion completed successfully!');
        console.log(`📊 Converted ${stockData.length} records`);
        console.log(`📈 ${symbols.size} unique symbols`);
        console.log(`📅 Date range: ${startDate} to ${endDate}`);
        console.log(`💾 Saved to: ${outputPath}`);
        
    } catch (error) {
        console.error('❌ Error converting CSV to JSON:', error);
        throw error;
    }
}

/**
 * פונקציה עזר לטעינת נתוני מניות מ-JSON
 * @param jsonFilePath - נתיב לקובץ JSON
 * @returns נתוני מניות
 */
export function loadStockDataFromJson(jsonFilePath: string): StockDataFile {
    try {
        const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
        const data: StockDataFile = JSON.parse(jsonContent);
        
        console.log(`📊 Loaded stock data: ${data.metadata.description}`);
        console.log(`📈 ${data.metadata.symbols.length} symbols, ${data.metadata.totalRecords} records`);
        
        return data;
    } catch (error) {
        console.error('❌ Error loading JSON file:', error);
        throw error;
    }
}

/**
 * פונקציה עזר לקבלת נתונים עבור מניה ספציפית
 * @param stockData - נתוני מניות
 * @param symbol - סימול המניה
 * @param startDate - תאריך התחלה (אופציונלי)
 * @param endDate - תאריך סיום (אופציונלי)
 * @returns נתונים מסוננים
 */
export function getStockData(
    stockData: StockDataFile, 
    symbol: string, 
    startDate?: string, 
    endDate?: string
): StockData[] {
    let filtered = stockData.data.filter(stock => 
        stock.symbol.toUpperCase() === symbol.toUpperCase()
    );
    
    if (startDate) {
        filtered = filtered.filter(stock => stock.date >= startDate);
    }
    
    if (endDate) {
        filtered = filtered.filter(stock => stock.date <= endDate);
    }
    
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * פונקציה עזר לקבלת רשימת תאריכים זמינים
 * @param stockData - נתוני מניות
 * @returns רשימת תאריכים ייחודיים
 */
export function getAvailableDates(stockData: StockDataFile): string[] {
    const dates = new Set(stockData.data.map(stock => stock.date));
    return Array.from(dates).sort();
}

/**
 * פונקציה עזר לקבלת רשימת סימולים זמינים
 * @param stockData - נתוני מניות
 * @returns רשימת סימולים ייחודיים
 */
export function getAvailableSymbols(stockData: StockDataFile): string[] {
    return stockData.metadata.symbols;
}

// דוגמה לשימוש:
if (require.main === module) {
    const csvPath = 'C:\\Users\\asafa\\OneDrive\\Desktop\\Desk\\braintop-temp\\braintop-scan-v2\\src\\Stocks\\Util\\stock_data.csv';
    const jsonPath = 'C:\\Users\\asafa\\OneDrive\\Desktop\\Desk\\braintop-temp\\braintop-scan-v2\\src\\Stocks\\Util\\stock_data.json';
    
    try {
        convertCsvToJson(csvPath, jsonPath);
    } catch (error) {
        console.error('Failed to convert CSV:', error);
    }
}
