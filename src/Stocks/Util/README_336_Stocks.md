# 336 Stocks OHLC Data Creator

## תיאור
כלי מיוחד ליצירת נתונים מקומיים של OHLC עבור 336 המניות שעברו את שלב AScan ונשמרו ב-Firebase.

## דרישות
- Node.js (גרסה 14+)
- Firebase project עם 336 מניות ב-`favorite > my-favorites`
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
npm run create-336-data [start-date] [output-path]
```

### 2. שימוש ישיר:
```bash
node src/Stocks/Util/create336StocksData.js [start-date] [output-path]
```

## פרמטרים

- **start-date** (אופציונלי): תאריך התחלה בפורמט YYYY-MM-DD (ברירת מחדל: 2024-11-01)
- **output-path** (אופציונלי): נתיב לשמירת קובץ JSON (ברירת מחדל: `local_336_stocks_data.json`)

## דוגמאות

### יצירת נתונים מ-1/11/2024:
```bash
npm run create-336-data
```

### יצירת נתונים מתאריך ספציפי:
```bash
npm run create-336-data "2024-01-01" "C:\\path\\to\\output.json"
```

## תכונות מיוחדות עבור 336 מניות

### ✅ אופטימיזציה מתקדמת
- **Batch size**: 15 מניות בקבוצה (במקום 5)
- **Delay**: 1.5 שניות בין קבוצות (במקום 2)
- **זמן עיבוד משוער**: 15-20 דקות (במקום 4 שעות)

### ✅ מעקב מפורט
- הצגת התקדמות לכל קבוצה
- רשימת מניות בכל קבוצה
- סטטיסטיקות סיום מפורטות
- מדידת זמן עיבוד

### ✅ ניהול שגיאות משופר
- המשך עיבוד גם אם מניה נכשלת
- דיווח על מניות שנכשלו
- סטטיסטיקות הצלחה/כישלון

## פורמט קובץ JSON
הקובץ JSON שיוצר כולל:

```json
{
  "metadata": {
    "created": "2025-01-11T10:00:00.000Z",
    "startDate": "2024-11-01",
    "endDate": "2025-01-11",
    "totalRecords": 50000,
    "symbols": ["AAPL", "MSFT", "GOOGL", "..."],
    "source": "Firebase + Polygon API",
    "processingTime": "18m 32s",
    "description": "Local OHLC data for 336 favorite stocks from 2024-11-01 to 2025-01-11 - 50000 total records"
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

## הערכות זמן

### עבור 336 מניות:
- **קבוצות**: 23 קבוצות (15 מניות כל אחת)
- **זמן עיבוד**: 15-20 דקות
- **נתונים**: ~50,000 רשומות OHLC
- **גודל קובץ**: ~20-30 MB

### עבור 7,696 מניות (להשוואה):
- **קבוצות**: 1,540 קבוצות (5 מניות כל אחת)
- **זמן עיבוד**: 4-6 שעות
- **נתונים**: ~1,000,000 רשומות OHLC
- **גודל קובץ**: ~500-800 MB

## דוגמה מלאה

```bash
# יצירת נתונים מקומיים עבור 336 מניות
npm run create-336-data

# בדיקת התוצאה
ls -la src/Stocks/Util/local_336_stocks_data.json

# שימוש בנתונים
node -e "
const data = require('./src/Stocks/Util/local_336_stocks_data.json');
console.log('Records:', data.metadata.totalRecords);
console.log('Symbols:', data.metadata.symbols.length);
console.log('Processing time:', data.metadata.processingTime);
"
```

## פתרון בעיות

### "Expected 336 stocks but got X"
- בדוק שהנתונים ב-Firebase נכונים
- ייתכן שמספר המניות השתנה

### "No historical data found for [symbol]"
- בדוק שהמניה קיימת ב-Polygon
- בדוק שהתאריכים תקינים

### "HTTP 429: Too Many Requests"
- הגדל את `delayBetweenBatches`
- הקטן את `batchSize`

## יתרונות עבור 336 מניות

1. **מהירות**: 15-20 דקות במקום 4 שעות
2. **יעילות**: פחות בקשות ל-API
3. **אמינות**: פחות סיכוי לשגיאות
4. **ניהול**: קל יותר לעקוב אחר התקדמות
5. **אחסון**: קובץ קטן יותר (20-30 MB)

## הערות חשובות

1. **זמן עיבוד**: 15-20 דקות עבור 336 מניות
2. **שימוש ב-API**: 336 בקשות ל-Polygon (במקום 7,696)
3. **שמירת נתונים**: הקובץ יהיה קטן יותר
4. **רשת**: דרושה חיבור יציב לאינטרנט
5. **זיכרון**: פחות דרישות זיכרון

## השוואה: 336 vs 7,696 מניות

| פרמטר | 336 מניות | 7,696 מניות |
|--------|-----------|-------------|
| זמן עיבוד | 15-20 דקות | 4-6 שעות |
| בקשות API | 336 | 7,696 |
| גודל קובץ | 20-30 MB | 500-800 MB |
| קבוצות | 23 | 1,540 |
| יעילות | גבוהה | נמוכה |
