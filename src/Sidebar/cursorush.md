# תוכניות למחר בבוקר - מסחר 5 דקות

## מה יש לנו עכשיו ✅
- מסך Min5 עובד עם 100 מניות
- סינון לפי Volume > 50,000 (כפתור)
- מיון לפי Patterns + Score
- טיימר לאחור לסיום הנר
- אינדיקטור שוק (SPY) עם ציון -10 עד +10
- עמודת Pattern + Volume
- שמירה ב-localStorage

## מה רוצים לבדוק מחר בבוקר 🔍

### 1. אינדיקטורים של Polygon
- **SMA** (Simple Moving Average)
- **EMA** (Exponential Moving Average)  
- **MACD** (Moving Average Convergence Divergence)
- **RSI** (Relative Strength Index)
- **VWAP** (Volume Weighted Average Price)

**מטרה:** לעבור מחשבונים עצמיים לאינדיקטורים של Polygon

### 2. תיקוני באגים
- **חלון זמנים** - לתקן את ה-API call (כרגע מחזיר כל היום)
- **MACD אמיתי** - עם Signal Line ו-Histogram
- **VWAP מעוגן** - לפתיחת השוק (09:30 NY)

### 3. מסכים נוספים
- **15 דקות** - RR מפורט, חישובים מורכבים
- **שעה** - כיוון בינוני, עדכון כל שעה
- **יומי** - מגמה ארוכת טווח, עדכון יומי

## המבנה הסופי 🎯

```
Daily Dashboard:
- עדכון: פעם ביום
- מטרה: מגמה ארוכת טווח
- אינדיקטורים: Support/Resistance, SMA(200), EMA(50)

Hour Dashboard:
- עדכון: כל שעה
- מטרה: כיוון בינוני
- אינדיקטורים: SMA(20), MACD, RSI

15min Dashboard:
- עדכון: כל 15 דקות
- מטרה: RR מפורט
- אינדיקטורים: ATR, Support/Resistance, RR מלא

5min Dashboard:
- עדכון: כל 5 דקות
- מטרה: כניסות מהירות
- אינדיקטורים: Patterns, אותות מהירים
```

## RR (Risk/Reward) 📊
**פלט צריך לכלול:**
- Entry Price (מחיר כניסה)
- Stop Loss (סטופ לוס)
- Take Profit (טייק פרופיט)
- RR Ratio (יחס סיכון/תשואה)

**דוגמה:**
```
LONG AAPL:
Entry: $150.25
Stop: $149.50 (-$0.75)
Target: $151.75 (+$1.50)
RR: 1:2
```

## אינדיקטורים של Polygon 🚀
**מה Polygon מחזיר:**
- ✅ SMA, EMA, MACD, RSI, VWAP
- ✅ Support/Resistance Levels
- ❌ ADX (לא זמין - נחשב בעצמנו או נוותר)

**יתרונות:**
- מהיר יותר (פחות API calls)
- מדויק יותר (חישובים מקצועיים)
- אמין יותר (אין באגים בחישוב)

## סינון Volume 📈
**כרגע:**
- כפתור "Filter by Volume"
- מסנן לפי Volume > 50,000 מהנר הראשון
- שומר ל-localStorage

**מחר:**
- לבדוק כמה מניות נשארות אחרי הסינון
- אולי לשנות לסף אחר (60,000 או 40,000)

## שעות מסחר ⏰
- **11:00 שעון ישראל** - פתיחת המסחר
- **16:30 שעון ישראל** - פתיחת המסחר האמריקאי
- **23:00 שעון ישראל** - סגירת המסחר

## מה לעשות מחר בבוקר 🌅
1. **11:00** - לבדוק את האינדיקטורים של Polygon
2. **לעבור לאינדיקטורים** של Polygon במקום חישובים עצמיים
3. **לתקן חלון הזמנים** ב-API calls
4. **לבדוק VWAP** של Polygon
5. **לבדוק MACD** עם Signal Line
6. **להתחיל לתכנן** מסך 15 דקות

## הערות חשובות 📝
- **API Key** - צריך לעבור לשרת Proxy (סיכון אבטחה)
- **Rate Limiting** - להוסיף concurrency limit
- **Caching** - לשמור תוצאות לאותו נר
- **WebSocket** - לשקול במקום polling

## קבצים חשובים 📁
- `/src/Sidebar/Min5/Components/Min5Dashboard.tsx` - המסך הראשי
- `/public/5min.json` - רשימת 337 מניות
- `/src/Sidebar/cursorush.md` - הקובץ הזה

---
**נוצר:** 9 בינואר 2025
**מטרה:** מסחר 5 דקות מקצועי עם Polygon API
