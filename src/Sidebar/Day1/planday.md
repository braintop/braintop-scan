# 📊 Day Trading Dashboard - תכנון מקיף

## 🎯 סקירה כללית

**מטרה:** מערכת מסחר יומית (Day Trading) - כניסה אחרי פתיחה (16:30 IL) ויציאה בסגירה (23:00 IL).

**טיימפריים:**
- **Daily (D1)** - סינון בלבד (מגמה/RS/ATR/רמות)
- **30 דקות** - טריגר כניסה (OR30 Break)
- **60 דקות** - מעקב מגמה
- **VWAP** - כיוון ראשי (Above/Below)

### 📊 Market Breadth Analysis (קריטי!)

**לפני שנכנסים ל-LONG/SHORT, חובה לבדוק:**

**1️⃣ Market Direction (SPY/QQQ/IWM/VIX):**
- **SPY** - S&P 500 (שוק רחב)
- **QQQ** - NASDAQ (טכנולוגיה) 
- **IWM** - Russell 2000 (מניות קטנות)
- **VIX** - פחד (Fear Index)

**2️⃣ Breadth Indicators (Production-Ready):**
- **% Above SMA20** - רק על ה-Watchlist שלנו (30-60 מניות)
- **SPY/QQQ/IWM State** - Above/Below VWAP
- **Proxy Formula:**
```
breadth = 50 + ((%AboveSMA20 - 50) × 0.5) + bias(SPY,QQQ,IWM)
bias = +10 (כולם Above VWAP) / -10 (כולם Below VWAP) / 0 (מעורב)
```

**3️⃣ Breadth Score (0-100):**
- **> 70** = Bullish Market (שורי) 🟢 → Priority to LONG
- **< 30** = Bearish Market (בריש) 🔴 → Priority to SHORT  
- **30-70** = Neutral/Range (ניטראלי) 🟡 → Wait for direction

**4️⃣ Market Filter Logic:**
```
IF Market Breadth > 70:
    → Priority to LONG setups
    → Look for bullish patterns first
    → Above VWAP, OR30 UP

IF Market Breadth < 30:
    → Priority to SHORT setups
    → Look for bearish patterns first
    → Below VWAP, OR30 DOWN

IF Market Breadth 30-70:
    → Wait for clear direction
    → Both LONG/SHORT OK
```

**לוח זמנים מעודכן (Early Entry):**

| שעה (IL) | מה קורה? | פעולות |
|----------|----------|--------|
| **09:00** | 📊 **סריקה ראשונה** | קריאת סגירה אתמול (23:00), חישוב Gap, RS vs SPY, ATR, רמות אתמול |
| **16:00-16:25** | 🔍 **הכנה סופית** | עדכון Premarket (PM High/Low), בניית Watchlist סופית (~30-60 מניות) |
| **16:30** | 🚀 **פתיחת שוק - TRADING!** | **כניסות מיידיות** - Gap-and-Go, Pullbacks, OR5 formation |
| **16:30-17:00** | ⚡ **חלון A: Early Entry** | **פעיל!** Gap fills, PM High/Low breaks, OR5 building |
| **17:00** | 🎯 **OR30 Complete** | OR30 High/Low final, Breakout triggers |
| **17:00-20:00** | 📈 **חלון B: ניהול** | מעקב VWAP, Trailing, TP1 (Partial 50% + BE) |
| **20:00-22:30** | 🎪 **חלון C: סיום** | Trailing הדוק, TP2, או יציאה מוקדמת |
| **22:55-23:00** | 🏁 **יציאה קשיחה** | סגירת כל הפוזיציות (גם אם לא הושג TP) |
| **23:05** | 💾 **שמירה** | שמירת תוצאות יום ל-Firebase |

**תשובה ישירה:**
1. **09:00 בבוקר** - סריקה ראשונה (קריאת נתוני אתמול + חישוב קונטקסט)
2. **16:00-16:25** - סריקה שנייה (עדכון PM + Watchlist סופית)
3. **16:30-17:00** - **TRADING ACTIVE!** (Gap-and-Go, PM breaks, OR5)
4. **17:00** - OR30 Complete (Breakout triggers)
5. **לאורך היום** - רענון ידני (לחיצה על "Refresh") כשרוצים לעדכן נתונים

---

## 🎯 אסטרטגיה חדשה - Early Entry (16:30+)

### כלל מינימלי - LONG
**כניסה רק אם כולם מתקיימים:**
- ✅ **Breadth ≥ 80** (על ה-Watchlist)
- ✅ **SPY & QQQ מעל VWAP**
- ✅ **Gap-and-Go:** מחיר מעל PM High (עם buffer קטן)
- ✅ **RVOL ≥ 2.0** (נפח מצטבר עד עכשיו ÷ ממוצע היסטורי לאותה שעה)
- ✅ **Spread ≤ 0.2%** (NBBO)

**כניסה:**
- **Breakout:** קנייה ב-PMHigh × (1 + 0.0005)
- **Retest:** לימיט על ריטסט של PMHigh

**סטופ לוס (מבני):**
- **Stop = min(PM_Low, OR5_Low) × (1 - 0.0005)**

**גודל פוזיציה (Risk-First):**
- **risk_per_share = entry - stop**
- **position = floor(max_daily_risk × 0.5 / risk_per_share)**
- **דוגמה:** max_daily_risk=1%, risk_fraction=0.5 → 0.5% סיכון לטרייד

### כלל מינימלי - SHORT (סימטרי)
**כניסה רק אם כולם מתקיימים:**
- ✅ **Breadth ≤ 20**
- ✅ **SPY & QQQ מתחת ל-VWAP**
- ✅ **Gap-and-Go-Down:** מחיר מתחת PM Low (+buffer)
- ✅ **RVOL ≥ 2.0**
- ✅ **Spread ≤ 0.2%**

**כניסה:**
- **Breakout:** מכירה מתחת PMLow × (1 - 0.0005)
- **Retest:** לימיט על ריטסט של PMLow

**סטופ לוס:**
- **Stop = max(PM_High, OR5_High) × (1 + 0.0005)**

### יציאה בסיסית (זהה ל-LONG/SHORT):
1. **TP1 = entry + 1R** → סגור 50% והעבר SL ל-BE
2. **TP2 = entry + 2R** → סגור יתרה
3. **Exit קשיח ב-23:00 IL**

---

## ⚙️ Production-Ready Details

### 1️⃣ Market Breadth - Proxy מעשי
**לא נשתמש ב-Universe רחב, אלא:**
- **%AboveSMA20** - רק על ה-Watchlist שלנו (30-60 מניות)
- **SPY/QQQ/IWM State** - Above/Below VWAP
- **נרמול ל-0-100** עם bias מעשי

### 2️⃣ VWAP - Anchored מסשן
**VWAP מצטבר מהפתיחה (16:30 IL):**
```
cumPV += close × volume
cumV += volume  
vwap = cumPV / cumV
```
**איפוס בפתיחה/החלפת יום**

### 3️⃣ RVOL - אמיתי לשעה
**RVOL איכותי:**
```
rvol = (נפח מצטבר עד עכשיו) ÷ (ממוצע נפח מצטבר לאותה שעה ב-N ימים)
```
**לא מול נפח יומי מלא - זה גבוה מדי בתחילת היום**

### 4️⃣ ADX-30m - מימוש מלא
**Polygon לא נותן ADX → מימוש DI+/DI-:**
- חלון 14 נרות של 30 דקות
- מימוש מלא כמו בספר (לא SimplifiedADX)

### 5️⃣ OR30 - מדויק
**16:30-17:00 IL עם נרות 1-5 דקות:**
- מינימום 1 דקה (עדיף)
- 5 דקות גם עובד
- עוצר בדיוק עם סגירת הנר

### 6️⃣ Spread% - חסם כניסה
**Spread% מ-NBBO:**
- חסם כניסה אם Spread > 0.2%
- גם אם כל השאר "ירוק"

---

## 🏗️ שלבי הבנייה

### שלב 1: יחסיות ל-SPY (Relative Strength)
**מטרה:** זיהוי מניות חזקות/חלשות יותר מהשוק

**חישוב:**
```javascript
const spyPerformance = (spyPrice - spyPreviousClose) / spyPreviousClose * 100;
const stockPerformance = (stockPrice - stockPreviousClose) / stockPreviousClose * 100;
const relativeStrength = stockPerformance - spyPerformance;

// דירוג:
// RS > +2%  = חזק מאוד (💪💪)
// RS > +1%  = חזק (💪)
// RS -1% to +1% = נייטרלי (➖)
// RS < -1%  = חלש (👎)
// RS < -2%  = חלש מאוד (👎👎)
```

**נתונים נדרשים:**
- מחיר סגירה אתמול (23:00)
- מחיר נוכחי (real-time)
- SPY - סגירה אתמול + נוכחי

**API Calls:**
```javascript
// 1. הבאת סגירה קודמת
GET /v2/aggs/ticker/{symbol}/prev

// 2. הבאת מחיר נוכחי
GET /v2/last/trade/{symbol}
```

---

### שלב 2: ATR Price (Average True Range)
**מטרה:** מדידת תנודתיות למחירי Stop Loss ו-Take Profit

**חישוב:**
```javascript
// ATR(14) מ-14 ימים אחרונים
const atr14 = calculateATR(dailyCandles, 14);

// חישוב רמות:
const stopLoss = currentPrice - (atr14 * 2);
const takeProfit1 = currentPrice + (atr14 * 2); // RR 1:1
const takeProfit2 = currentPrice + (atr14 * 4); // RR 1:2

// דירוג תנודתיות:
// ATR < 1% של מחיר = תנודתיות נמוכה
// ATR 1%-3% = תנודתיות בינונית
// ATR > 3% = תנודתיות גבוהה
```

**נתונים נדרשים:**
- 14 ימי מסחר אחרונים (OHLC)

**API Calls:**
```javascript
// הבאת 14 ימים אחרונים
const endDate = new Date();
const startDate = new Date(endDate.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 ימים (כולל סופי שבוע)

GET /v2/aggs/ticker/{symbol}/range/1/day/{startDate}/{endDate}
```

---

### שלב 3: אינדיקטורים טכניים (SMA, MACD, RSI, ADX)
**מטרה:** זיהוי מגמות, מומנטום ועוצמת מגמה

#### 3.1 SMA (Simple Moving Average)
```javascript
// SMA מ-Polygon (מהיר ומדויק)
GET /v1/indicators/sma/{symbol}?timespan=day&window=20
GET /v1/indicators/sma/{symbol}?timespan=day&window=50
GET /v1/indicators/sma/{symbol}?timespan=day&window=200

// אות:
// מחיר > SMA20 > SMA50 > SMA200 = מגמת עלייה חזקה 🟢🟢🟢
// מחיר > SMA20 > SMA50 = מגמת עלייה 🟢🟢
// מחיר > SMA20 = מגמת עלייה קצרת טווח 🟢
// מחיר < SMA20 < SMA50 < SMA200 = מגמת ירידה חזקה 🔴🔴🔴
```

#### 3.2 MACD (Moving Average Convergence Divergence)
```javascript
// MACD מ-Polygon
GET /v1/indicators/macd/{symbol}?timespan=day&short_window=12&long_window=26&signal_window=9

// אות:
// MACD > Signal && MACD > 0 = בוליש חזק 🟢🟢
// MACD > Signal && MACD < 0 = בוליש 🟢
// MACD < Signal && MACD < 0 = בריש חזק 🔴🔴
// MACD < Signal && MACD > 0 = בריש 🔴
```

#### 3.3 RSI (Relative Strength Index)
```javascript
// RSI מ-Polygon
GET /v1/indicators/rsi/{symbol}?timespan=day&window=14

// אות:
// RSI > 70 = Overbought (קנייה יתר) ⚠️
// RSI 50-70 = בוליש 🟢
// RSI 30-50 = בריש 🔴
// RSI < 30 = Oversold (מכירה יתר) ⚠️⚠️
```

#### 3.4 ADX (Average Directional Index)
```javascript
// ADX - חישוב עצמי (Polygon לא מספק)
const adx = calculateSimplifiedADX(ohlcData);

// אות:
// ADX > 40 = מגמה חזקה מאוד 💪💪💪
// ADX 25-40 = מגמה בינונית 💪💪
// ADX < 25 = אין מגמה ברורה 👎
```

---

### שלב 4: זיהוי נרות (Candlestick Patterns)
**מטרה:** זיהוי נקודות היפוך ומשכיות

**נרות בוליש (Bullish):**
```javascript
1. **Hammer** 🔨
   - גוף קטן בחלק העליון
   - צל תחתון ארוך (פי 2 מהגוף)
   - צל עליון קצר או לא קיים
   - אות: היפוך עלייה בתחתית מגמה

2. **Bullish Engulfing** 🟢
   - נר ירוק שבולע את הנר האדום הקודם
   - פתיחה מתחת לסגירה הקודמת
   - סגירה מעל הפתיחה הקודמת
   - אות: היפוך עלייה חזק

3. **Morning Star** ⭐
   - 3 נרות: אדום גדול → קטן → ירוק גדול
   - אות: היפוך עלייה בתחתית מגמה

4. **Piercing Pattern** 🎯
   - נר ירוק שחוצה את אמצע הנר האדום הקודם
   - אות: היפוך עלייה

5. **Doji** ➕
   - גוף קטן מאוד (פתיחה = סגירה)
   - צללים ארוכים
   - אות: חוסר החלטה, אפשרי היפוך
```

**נרות בריש (Bearish):**
```javascript
1. **Shooting Star** 💫
   - גוף קטן בחלק התחתון
   - צל עליון ארוך (פי 2 מהגוף)
   - צל תחתון קצר או לא קיים
   - אות: היפוך ירידה בראש מגמה

2. **Bearish Engulfing** 🔴
   - נר אדום שבולע את הנר הירוק הקודם
   - אות: היפוך ירידה חזק

3. **Evening Star** 🌙
   - 3 נרות: ירוק גדול → קטן → אדום גדול
   - אות: היפוך ירידה בראש מגמה

4. **Dark Cloud Cover** ☁️
   - נר אדום שחוצה את אמצע הנר הירוק הקודם
   - אות: היפוך ירידה

5. **Hanging Man** 🏃
   - כמו Hammer אבל בראש מגמה
   - אות: אזהרת היפוך ירידה
```

**API Calls:**
```javascript
// הבאת 5 נרות אחרונים (לזיהוי פטרנים)
GET /v2/aggs/ticker/{symbol}/range/1/day/{5daysAgo}/{today}
```

---

### שלב 5: Support & Resistance (רמות תמיכה והתנגדות)
**מטרה:** זיהוי רמות מפתח לכניסה ויציאה

**חישוב:**
```javascript
// גישה 1: Pivot Points (קלאסי)
const pivot = (high + low + close) / 3;
const r1 = (2 * pivot) - low;
const r2 = pivot + (high - low);
const s1 = (2 * pivot) - high;
const s2 = pivot - (high - low);

// גישה 2: EMA 200 (רמה דינמית)
GET /v1/indicators/ema/{symbol}?timespan=day&window=200

// גישה 3: High/Low של 50 ימים
const highest50 = Math.max(...last50Days.map(d => d.h));
const lowest50 = Math.min(...last50Days.map(d => d.l));

// דירוג:
// מחיר ליד Support = הזדמנות לקנייה 🟢
// מחיר ליד Resistance = הזדמנות למכירה 🔴
// מחיר בין Support ל-Resistance = נייטרלי ➖
```

**API Calls:**
```javascript
// הבאת 50 ימים אחרונים
GET /v2/aggs/ticker/{symbol}/range/1/day/{50daysAgo}/{today}

// EMA 200
GET /v1/indicators/ema/{symbol}?timespan=day&window=200
```

---

### שלב 6: חישוב Score ו-RR
**מטרה:** קביעת LONG/SHORT/WAIT + Entry/Stop/TP

**ניקוד:**
- Relative Strength (15) - יחסיות ל-SPY
- ATR (10) - תנודתיות
- Prev Day Levels (15) - רמות אתמול/PM
- **VWAP (15)** ⭐ - Above/Below
- **ORB-30 (20)** ⭐⭐ - Break UP/DOWN
- **RVOL (15)** ⭐ - נפח ≥1.5
- ADX-30m (10) - עוצמת מגמה

**כללי החלטה:**
- **LONG**: Score > 50 + Above VWAP + ORB UP + RVOL ≥ 1.5
- **SHORT**: Score < -50 + Below VWAP + ORB DOWN + RVOL ≥ 1.5
- **WAIT**: אחרת

---

## 🔄 זרימת עבודה

**16:00-16:25** - הכנה: RS, ATR, Prev H/L, PM H/L, Gap → Watchlist → Firebase

**16:30-17:00** - OR30: מעקב High/Low, VWAP, RVOL

**17:00** - טריגר: ORB Break + VWAP + RVOL ≥ 1.5 → LONG/SHORT/WAIT

**17:00-20:00** - ניהול: TP1 (Partial 50% + BE), Trailing (EMA20-30m)

**20:00-22:30** - סיום: TP2 או Trailing הדוק

**22:55** - Exit קשיח (כל הפוזיציות)

---

## 💾 מבנה נתונים לשמירה

### סריקה 1️⃣ - 09:00 בבוקר (קונטקסט יומי)

**מה שומרים ב-09:00?** (אין מסחר עדיין!)

1. **מידע בסיסי** - סימבול, תאריך 09:00
2. **מחירים אתמול** (D1):
   - סגירה אתמול (23:00 אתמול)
   - פתיחה אתמול (16:30 אתמול)
   - גבוה אתמול (הגבוה ביותר אתמול)
   - נמוך אתמול (הנמוך ביותר אתמול)
3. **יחסיות ל-SPY (D1)** - ערך, דירוג (חזק/חלש)
4. **ATR (14 ימים)** - ערך, אחוזים, תנודתיות
5. **אינדיקטורים יומיים** - SMA20/50/200, MACD, RSI, ADX (D1)
6. **נרות יומיים** - פטרן אתמול (Hammer, Doji...)
7. **תמיכה/התנגדות** - רמות אתמול, Pivot, EMA200
8. **ציון ראשוני** - Score בסיסי (ללא OR30/VWAP/RVOL)

---

### סריקה 2️⃣ - 16:00-16:25 (Premarket)

**מה מוסיפים/מעדכנים?**

1. **Premarket High/Low** - הגבוה/נמוך לפני פתיחה
2. **Gap** - אחוזים, סוג (UP/DOWN) מסגירה אתמול
3. **Watchlist סופית** - ~30-60 מניות מסוננות

---

### סריקה 3️⃣ - 17:00+ (תוך-יומי)

**מה מוסיפים אחרי פתיחה?**

1. **מחירים נוכחיים** (real-time):
   - נוכחי (עכשיו)
   - פתיחה (16:30)
   - גבוה (הגבוה מאז 16:30)
   - נמוך (הנמוך מאז 16:30)
   - נפח (מצטבר מאז 16:30)

2. **OR30** (17:00):
   - OR30 High - הגבוה של 30 דקות ראשונות (16:30-17:00)
   - OR30 Low - הנמוך של 30 דקות ראשונות (16:30-17:00)
   - Range - הטווח (High - Low)

3. **VWAP** - מחיר משוקלל בנפח מאז 16:30

4. **RVOL** - נפח יחסי (נוכחי / ממוצע לאותה שעה)

5. **אינדיקטורים 30m** - EMA20, ADX, Swing High/Low

6. **RR מלא** - Entry, Stop Loss, TP1, TP2

7. **ציון סופי** - Score + OR30 + VWAP + RVOL

8. **ניהול** - Partial, BE, Trailing, Exit 23:00

---

### נתיב שמירה:
```
/dayTrading/2025-10-08/scans/scan_morning_09_00/    ← קונטקסט יומי
/dayTrading/2025-10-08/scans/scan_premarket_16_00/ ← PM + Gap
/dayTrading/2025-10-08/scans/scan_or30_17_00/      ← OR30 סגור
/dayTrading/2025-10-08/final/                      ← סריקה אחרונה
```

---

## 🎯 כללי זהב למסחר יום

### כללי כניסה
1. ✅ **לא נכנסים לפני OR30** (לפני 17:00 IL) - רעשים של פתיחה
2. ✅ **Above/Below VWAP** - מסנן כיוון ראשי
3. ✅ **RVOL ≥ 1.5** - מסנן איכות (נפח גבוה)
4. ✅ **ADX-30m ≥ 20** - עוצמת מגמה מינימלית
5. ✅ **סטופ מבני** - PM/OR30/Swing לפני ATR
6. ✅ **R:R מינימום 1:2** - לא פחות!

### כללי ניהול
1. ✅ **Partial 50% ב-TP1 (1R)** - תמיד!
2. ✅ **העבר SL ל-BE** - אחרי TP1
3. ✅ **Trailing Stop** - EMA20-30m או Swing
4. ✅ **Exit 23:00 IL** - בכל מקרה!
5. ✅ **Max Loss יומי** - עצור אם הגעת!

### איזה מניות לבחור?
- ✅ Dollar Volume > $10M יומי
- ✅ Spread < 0.1% (נזילות גבוהה)
- ✅ RVOL ≥ 1.5 (עניין בשוק)
- ✅ RS vs SPY > 0 (LONG) או < 0 (SHORT)
- ✅ ATR% 1-5% (לא יותר מדי תנודתי)

---

## 🎨 עיצוב המסך

### פאנל עליון
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ 📊 Day Trading Dashboard - OR30 Strategy                                            │
│ ⏰ 16:45 IL | OR30 closes at 17:00                                                   │
│ 📈 Market Breadth: SPY +0.8% | QQQ +1.2% | IWM +0.3% | VIX 18.5 | Breadth 78% 🟢    │
│ 📋 Watchlist: 42/337 | Above VWAP: 28 | ORB-UP: 12 | RVOL≥1.5: 18                   │
│ 🎯 Triggers: 5 LONG | 2 SHORT | 35 WAIT                                             │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### טבלה ראשית (עמודות חדשות)
```
| Symbol | Price | OR30 H/L | VWAP | Dist% | RVOL | PrevH/L% | Spread | Badges | Score | Action |
|--------|-------|----------|------|-------|------|----------|--------|--------|-------|--------|
| AAPL   | 184.2 | 184.2/182.1 | 183.0 | +0.65% | 1.9 | H:-2.1% L:+5.2% | 0.05% | ORB_UP ABOVE_VWAP RVOL_HIGH | +75 | LONG🟢 |
| NVDA   | 520.5 | 521.0/518.2 | 519.0 | +0.29% | 2.1 | H:-0.8% L:+3.5% | 0.04% | ORB_UP ABOVE_VWAP RVOL_VERY_HIGH TREND | +85 | LONG🟢 |
| TSLA   | 245.8 | 246.5/243.9 | 245.0 | +0.32% | 1.6 | H:-1.5% L:+4.8% | 0.08% | ABOVE_VWAP RVOL_HIGH | +45 | WAIT⚪ |
```

**Badges מוצעים:**
- `ORB_UP` - נר 30ד׳ נסגר מעל OR30 High
- `ORB_DOWN` - נר 30ד׳ נסגר מתחת OR30 Low
- `ABOVE_VWAP` - מחיר מעל VWAP
- `BELOW_VWAP` - מחיר מתחת VWAP
- `RVOL_VERY_HIGH` - RVOL ≥ 2.0
- `RVOL_HIGH` - RVOL ≥ 1.5
- `TREND` - ADX-30m ≥ 25
- `STRONG_TREND` - ADX-30m ≥ 40

### כפתורים
```
[🔔 Arm OR30 Triggers] - הצג התראות רק אחרי 17:00 על פריצות
[📊 Show Day Plan] - פתח כרטיס עם Stop/TP/Trailing/Exit 23:00
[🔄 Refresh Now] - רענן נתונים ידני
[🏁 Force EOD Exit] - סגירה ידנית לפני 23:00
```

### כרטיס Day Plan (פופאפ)
```
┌─────────────────────────────────────────────────────┐
│ 📊 AAPL - Day Trading Plan                          │
├─────────────────────────────────────────────────────┤
│ Trigger: ORB-30 Break UP + VWAP + RVOL 1.9         │
│                                                      │
│ Entry:                                              │
│   💰 $184.25 (LIMIT)                                │
│   📍 OR30 High + $0.05                              │
│                                                      │
│ Stop Loss:                                          │
│   🛑 $182.00 (STRUCTURAL)                           │
│   📍 OR30 Low                                       │
│   ⚠️  Risk: -$2.25 (-1.22%)                        │
│                                                      │
│ Take Profit:                                        │
│   🎯 TP1: $186.50 (+$2.25, 1R) - Partial 50%       │
│   🎯 TP2: $188.75 (+$4.50, 2R) - Full Exit         │
│                                                      │
│ Management:                                         │
│   ✅ TP1 → Close 50% + Move SL to BE                │
│   📈 Trailing: EMA20-30m ($182.80)                  │
│   ⏰ Force Exit: 23:00 IL (20:00 UTC)               │
│                                                      │
│ Position Size: 100 shares                          │
│ Max Risk: $225 (1% of account)                     │
│ Max Reward: $450 (2% of account)                   │
└─────────────────────────────────────────────────────┘
```

---

## 📂 מבנה קבצים

```
/src/Sidebar/Day1/
├── Components/
│   ├── DayDashboard.tsx          # קומפוננטה ראשית
│   ├── StockTable.tsx             # טבלת מניות (OR30, VWAP, RVOL, Badges)
│   ├── PreMarketPanel.tsx         # פאנל הכנה 16:00-16:25
│   ├── OR30Panel.tsx              # פאנל OR30 (16:30-17:00)
│   ├── DayPlanCard.tsx            # כרטיס Day Plan (פופאפ)
│   └── FiltersBar.tsx             # בר סינונים + כפתורים
│
├── Logic/
│   ├── OR30Logic.ts               # חישוב OR30 (High/Low/Range)
│   ├── VWAPLogic.ts               # חישוב VWAP
│   ├── RVOLLogic.ts               # חישוב RVOL
│   ├── IndicatorsIntraday.ts      # EMA20-30m, ADX-30m, Swing High/Low
│   ├── RelativeStrength.ts        # חישוב RS vs SPY (D1)
│   ├── ATRCalculator.ts           # חישוב ATR (D1)
│   ├── SupportResistance.ts       # Prev H/L, PM H/L, Pivot
│   ├── ScoringLogic.ts            # ניקוד מותאם Day Trading
│   └── RRCalculator.ts            # Entry/Stop/TP + Partial/BE/Trailing
│
├── Types/
│   ├── DayTypes.ts                # טייפים כלליים
│   ├── OR30Types.ts               # טייפים ל-OR30
│   ├── VWAPTypes.ts               # טייפים ל-VWAP
│   ├── RVOLTypes.ts               # טייפים ל-RVOL
│   ├── IntradayTypes.ts           # טייפים ל-30m/60m
│   └── RRTypes.ts                 # טייפים ל-RR + Management
│
├── Services/
│   ├── PolygonDay.ts              # API calls ל-Polygon (Daily)
│   ├── PolygonIntraday.ts         # API calls ל-Polygon (30m/60m)
│   └── FirebaseDay.ts             # שמירה/קריאה מ-Firebase
│
└── planday.md                     # מסמך זה
```

---

## 🚀 יתרונות האסטרטגיה

### Day Trading מותאם
1. ✅ **OR30 Strategy** - מוכחת ועובדת (ממתינים לפתיחה להתייצב)
2. ✅ **VWAP כמסנן** - כיוון ברור (Above/Below)
3. ✅ **RVOL כמסנן** - רק מניות עם עניין בשוק
4. ✅ **סטופ מבני** - לא שרירותי, מבוסס OR30/PM/Swing
5. ✅ **Partial + BE + Trailing** - ניהול מקצועי
6. ✅ **Exit 23:00** - לא נשארים בין לילה

### טכנולוגיה
1. ✅ **Polygon API** - נתונים מהירים ואמינים (SMA, EMA, MACD, RSI, VWAP)
2. ✅ **Firebase** - שמירה אוטומטית אחרי כל סריקה
3. ✅ **Real-time** - עדכונים ידניים (לא אוטומטי - יותר שליטה)
4. ✅ **Multi-timeframe** - D1 לקונטקסט, 30m לטריגר, 60m למעקב

### ניהול סיכונים
1. ✅ **R:R מינימום 1:2** - לא פחות!
2. ✅ **Partial 50% ב-TP1** - מבטיח רווח
3. ✅ **BE אחרי TP1** - מבטל סיכון
4. ✅ **Trailing Stop** - מקסימום רווח
5. ✅ **Max Loss יומי** - מגן על חשבון

---

## 📝 הערות חשובות

### לפני כניסה
1. ⚠️ **לא לפני OR30** - המתן עד 17:00 IL (נר 30ד׳ נסגר)
2. ⚠️ **RVOL < 1.5** - אל תיכנס! (אין עניין בשוק)
3. ⚠️ **ADX-30m < 20** - אין מגמה ברורה (סיכון גבוה)
4. ⚠️ **Spread > 0.2%** - נזילות נמוכה (קשה לצאת)
5. ⚠️ **ATR% > 5%** - תנודתיות גבוהה מדי (סיכון)

### במהלך המסחר
1. ✅ **מעקב אחרי VWAP** - אם חוצה, שקול יציאה
2. ✅ **מעקב אחרי RVOL** - אם יורד מתחת 1.0, שקול יציאה
3. ✅ **מעקב אחרי ADX-30m** - אם יורד מתחת 20, מגמה נחלשת
4. ✅ **Trailing Stop** - העבר כל הזמן (EMA20-30m או Swing)
5. ✅ **22:55 IL** - התחל לסגור (לא לחכות ל-23:00 בדיוק)

### אחרי המסחר
1. 📊 **סטטיסטיקות** - רשום Win/Loss, R multiple, Best/Worst
2. 📝 **יומן** - מה עבד? מה לא עבד?
3. 🔍 **ביקורת** - האם עקבת אחרי הכללים?
4. 📈 **שיפור** - איזה פטרנים חוזרים?
5. 💾 **שמירה** - Firebase שומר הכול אוטומטית

---

---

## 🚀 גרסה פשוטה (כמו Min5)

**אם נרצה להתחיל פשוט ולהרחיב אחר כך:**

### MVP (Minimum Viable Product) - קובץ אחד
```typescript
// DayDashboard.tsx - גרסה פשוטה (כמו Min5)

1. טבלה אחת עם:
   - Symbol
   - Price
   - VWAP (Above/Below)
   - RVOL
   - OR30 Break (UP/DOWN/NONE)
   - Score (פשוט)
   - Action (LONG/SHORT/WAIT)

2. חישובים פשוטים:
   - VWAP = סכום(מחיר × נפח) / סכום(נפח)
   - RVOL = נפח נוכחי / ממוצע נפח
   - OR30 = High/Low של 30 דקות ראשונות
   - Score = VWAP (50%) + RVOL (30%) + ORB (20%)

3. רענון ידני:
   - כפתור "Refresh"
   - לא אוטומטי
   - לא Firebase (בינתיים)

4. קובץ אחד:
   - ~500 שורות (כמו Min5)
   - פשוט להבין
   - פשוט לתחזק
```

### אחר כך נוסיף (Phase 2):
- ✅ Firebase
- ✅ Partial/BE/Trailing
- ✅ Multiple timeframes
- ✅ קבצים נפרדים (Logic/Types/Services)

---

**🤔 מה אתה מעדיף?**

**אפשרות A:** גרסה פשוטה (MVP) - קובץ אחד כמו Min5
- ✅ מהיר לבנות (1-2 שעות)
- ✅ פשוט להבין
- ✅ עובד מיד
- ❌ פחות פיצ'רים

**אפשרות B:** גרסה מלאה (כמו התוכנית)
- ✅ כל הפיצ'רים
- ✅ מקצועי
- ✅ ניהול מתקדם
- ❌ לוקח זמן (5-10 שעות)

**איזו אפשרות תעדיף?** 🎯

---

**🎯 מוכן לבנייה!**

