# CSV to JSON Converter for Stock Data

## תיאור
כלי להמרת קובץ CSV של נתוני מניות לקובץ JSON מובנה לשימוש במערכת BrainTop.

## דרישות
- Node.js (גרסה 14+)
- קובץ CSV עם נתוני מניות

## פורמט קובץ CSV נדרש
הקובץ CSV צריך לכלול את העמודות הבאות (באנגלית או עברית):
- **Date/Timestamp** - תאריך (YYYY-MM-DD)
- **Symbol/Ticker** - סימול המניה
- **Open** - מחיר פתיחה
- **High** - מחיר גבוה
- **Low** - מחיר נמוך
- **Close** - מחיר סגירה
- **Volume** - נפח מסחר
- **Adjusted Close** (אופציונלי) - מחיר סגירה מותאם

### דוגמה לקובץ CSV:
```csv
date,symbol,open,high,low,close,volume,adjusted_close
2024-11-01,AAPL,150.00,155.00,149.00,154.00,1000000,154.00
2024-11-01,MSFT,300.00,305.00,298.00,302.00,800000,302.00
```

## שימוש

### 1. שימוש עם npm script:
```bash
npm run convert-csv [path/to/input.csv] [path/to/output.json]
```

### 2. שימוש ישיר:
```bash
node src/Stocks/Util/convertCsvToJson.js [path/to/input.csv] [path/to/output.json]
```

### 3. שימוש ב-TypeScript:
```typescript
import { convertCsvToJson, loadStockDataFromJson } from './csvToJsonConverter';

// המרה
convertCsvToJson('input.csv', 'output.json');

// טעינה
const stockData = loadStockDataFromJson('output.json');
```

## פורמט קובץ JSON
הקובץ JSON שיוצר כולל:

```json
{
  "metadata": {
    "created": "2025-01-11T10:00:00.000Z",
    "startDate": "2024-11-01",
    "endDate": "2025-09-11",
    "totalRecords": 1000000,
    "symbols": ["AAPL", "MSFT", "GOOGL"],
    "description": "Stock data from 2024-11-01 to 2025-09-11 - 1000 symbols, 1000000 records"
  },
  "data": [
    {
      "date": "2024-11-01",
      "symbol": "AAPL",
      "open": 150.00,
      "high": 155.00,
      "low": 149.00,
      "close": 154.00,
      "volume": 1000000,
      "adjusted_close": 154.00
    }
  ]
}
```

## פונקציות עזר

### `getStockData(stockData, symbol, startDate?, endDate?)`
מחזיר נתונים עבור מניה ספציפית עם סינון תאריכים.

### `getAvailableDates(stockData)`
מחזיר רשימת תאריכים זמינים.

### `getAvailableSymbols(stockData)`
מחזיר רשימת סימולים זמינים.

## דוגמה מלאה

```typescript
import { 
    convertCsvToJson, 
    loadStockDataFromJson, 
    getStockData 
} from './csvToJsonConverter';

// המרת CSV ל-JSON
convertCsvToJson(
    'C:\\path\\to\\stock_data.csv',
    'C:\\path\\to\\stock_data.json'
);

// טעינת נתונים
const stockData = loadStockDataFromJson('C:\\path\\to\\stock_data.json');

// קבלת נתונים עבור AAPL
const aaplData = getStockData(stockData, 'AAPL', '2024-11-01', '2025-01-01');

// קבלת רשימת תאריכים
const dates = getAvailableDates(stockData);

// קבלת רשימת מניות
const symbols = getAvailableSymbols(stockData);
```

## הערות חשובות
1. הקובץ CSV צריך להיות בקידוד UTF-8
2. הפרדה בין עמודות: פסיק (,)
3. כותרות יכולות להיות באנגלית או עברית
4. הקובץ JSON שיוצר מותאם לשימוש במערכת BrainTop
5. הנתונים ממוינים לפי תאריך ואז לפי סימול

## פתרון בעיות
- **"Missing required columns"** - בדוק שהקובץ CSV כולל את כל העמודות הנדרשות
- **"CSV file not found"** - בדוק שהנתיב לקובץ CSV נכון
- **"Invalid data row"** - בדוק שהנתונים בכל שורה תקינים (מספרים חיוביים)
