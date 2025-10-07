const fs = require('fs');
const path = require('path');

/**
 * ממיר קובץ CSV לנתוני מניות ל-JSON
 * @param {string} csvFilePath - נתיב לקובץ CSV
 * @param {string} outputPath - נתיב לשמירת קובץ JSON
 */
function convertCsvToJson(csvFilePath, outputPath) {
    try {
        console.log('🔄 Starting CSV to JSON conversion...');
        
        // בדיקה אם קובץ CSV קיים
        if (!fs.existsSync(csvFilePath)) {
            throw new Error(`CSV file not found: ${csvFilePath}`);
        }
        
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
        const getColumnIndex = (possibleNames) => {
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
        const stockData = [];
        const symbols = new Set();
        let startDate = '';
        let endDate = '';
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            
            if (values.length < headers.length) {
                console.warn(`⚠️ Skipping incomplete row ${i + 1}`);
                continue;
            }
            
            try {
                const stock = {
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
        const jsonData = {
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
        
        // יצירת תיקייה אם לא קיימת
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // שמירת קובץ
        fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
        
        console.log('✅ Conversion completed successfully!');
        console.log(`📊 Converted ${stockData.length} records`);
        console.log(`📈 ${symbols.size} unique symbols`);
        console.log(`📅 Date range: ${startDate} to ${endDate}`);
        console.log(`💾 Saved to: ${outputPath}`);
        
        return jsonData;
        
    } catch (error) {
        console.error('❌ Error converting CSV to JSON:', error);
        throw error;
    }
}

// הפעלה אם הקובץ רץ ישירות
if (require.main === module) {
    const csvPath = process.argv[2] || 'C:\\Users\\asafa\\OneDrive\\Desktop\\Desk\\braintop-temp\\braintop-scan-v2\\src\\Stocks\\Util\\stock_data.csv';
    const jsonPath = process.argv[3] || 'C:\\Users\\asafa\\OneDrive\\Desktop\\Desk\\braintop-temp\\braintop-scan-v2\\src\\Stocks\\Util\\stock_data.json';
    
    console.log('🚀 CSV to JSON Converter');
    console.log(`📁 Input CSV: ${csvPath}`);
    console.log(`📁 Output JSON: ${jsonPath}`);
    console.log('');
    
    try {
        convertCsvToJson(csvPath, jsonPath);
        console.log('');
        console.log('🎉 Conversion completed successfully!');
    } catch (error) {
        console.error('');
        console.error('💥 Conversion failed:', error.message);
        process.exit(1);
    }
}

module.exports = { convertCsvToJson };
