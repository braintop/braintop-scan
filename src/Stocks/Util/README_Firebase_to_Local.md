# Firebase to Local Data Creator

## תיאור
כלי ליצירת נתונים מקומיים של OHLC עבור כל המניות שעברו את שלב AScan ונשמרו ב-Firebase.

## דרישות
- Node.js (גרסה 14+)
- Firebase project עם נתוני מניות ב-`favorite > my-favorites`
- Polygon API key
- Firebase configuration

## הגדרה

### 1. הגדרת משתני סביבה
צור קובץ `.env` בשורש הפרויקט:

```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_POLYGON_API_KEY=your-polygon-api-key
```

### 2. התקנת dependencies
```bash
npm install firebase
```

## שימוש

### 1. שימוש עם npm script:
```bash
npm run create-local-data [start-date] [output-path]
```

### 2. שימוש ישיר:
```bash
node src/Stocks/Util/createLocalData.js [start-date] [output-path]
```

### 3. שימוש ב-TypeScript:
```typescript
import { createLocalStockData } from './firebaseToLocalData';

// יצירת נתונים מקומיים
const localData = await createLocalStockData();
```

## פרמטרים

- **start-date** (אופציונלי): תאריך התחלה בפורמט YYYY-MM-DD (ברירת מחדל: 2024-11-01)
- **output-path** (אופציונלי): נתיב לשמירת קובץ JSON (ברירת מחדל: `src/Stocks/Util/local_stock_data.json`)

## דוגמאות

### יצירת נתונים מ-1/11/2024:
```bash
npm run create-local-data
```

### יצירת נתונים מתאריך ספציפי:
```bash
npm run create-local-data "2024-01-01" "C:\\path\\to\\output.json"
```

## פורמט קובץ JSON
הקובץ JSON שיוצר כולל:

```json
{
  "metadata": {
    "created": "2025-01-11T10:00:00.000Z",
    "startDate": "2024-11-01",
    "endDate": "2025-01-11",
    "totalRecords": 1000000,
    "symbols": ["AAPL", "MSFT", "GOOGL"],
    "source": "Firebase + Polygon API",
    "description": "Local OHLC data for 1000 favorite stocks from 2024-11-01 to 2025-01-11 - 1000000 total records"
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

## תכונות

### ✅ עיבוד בקבוצות
- עיבוד 5 מניות בו-זמנית (ניתן לשנות)
- השהיה של 2 שניות בין קבוצות (ניתן לשנות)
- מניעת עומס על Polygon API

### ✅ ניהול שגיאות
- המשך עיבוד גם אם מניה אחת נכשלת
- לוגים מפורטים לכל שלב
- סטטיסטיקות סיום

### ✅ אופטימיזציה
- מיון נתונים אוטומטי
- הסרת כפילויות
- שמירה יעילה

## פונקציות עזר

### `loadFavoriteStocksFromFirebase()`
טוען מניות מועדפות מ-Firebase.

### `fetchOHLCDataForStock(symbol, startDate)`
מוריד נתוני OHLC עבור מניה ספציפית.

### `fetchAllFavoriteStocksOHLC(startDate, batchSize, delay)`
מוריד נתוני OHLC עבור כל המניות המועדפות.

### `saveLocalDataToFile(data, filePath)`
שומר נתונים מקומיים לקובץ JSON.

### `getStockDataFromLocal(localData, symbol, startDate?, endDate?)`
מחזיר נתונים עבור מניה ספציפית.

## פתרון בעיות

### "No favorite stocks found in Firebase"
- בדוק שהנתונים קיימים ב-`favorite > my-favorites`
- בדוק הגדרות Firebase

### "VITE_POLYGON_API_KEY not found"
- הוסף את מפתח Polygon API לקובץ `.env`
- בדוק שהמפתח תקין

### "HTTP 429: Too Many Requests"
- הגדל את `delayBetweenBatches`
- הקטן את `batchSize`

### "No historical data found for [symbol]"
- בדוק שהמניה קיימת ב-Polygon
- בדוק שהתאריכים תקינים

## הערות חשובות

1. **זמן עיבוד**: עיבוד 7,696 מניות יכול לקחת 2-4 שעות
2. **שימוש ב-API**: כל מניה דורשת בקשה אחת ל-Polygon
3. **שמירת נתונים**: הקובץ יכול להיות גדול (100MB+)
4. **רשת**: דרושה חיבור יציב לאינטרנט

## דוגמה מלאה

```bash
# יצירת נתונים מקומיים
npm run create-local-data

# בדיקת התוצאה
ls -la src/Stocks/Util/local_stock_data.json

# שימוש בנתונים
node -e "
const data = require('./src/Stocks/Util/local_stock_data.json');
console.log('Records:', data.metadata.totalRecords);
console.log('Symbols:', data.metadata.symbols.length);
"
```
