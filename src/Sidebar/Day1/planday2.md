# 📊 Day Trading Strategy - תכנית מסחר יומית

## 🎯 אסטרטגיה אחת - סקאוט + חיזוק

**קנייה ב-16:20 + חיזוק ב-17:00**

### שלב 1️⃣ - סקאוט (16:20)
**כניסה ראשונית עם גודל קטן**

**שערים קשיחים (חובה!):**
- ✅ **Breadth ≥ 80** (שוק חזק)
- ✅ **SPY & QQQ & IWM מעל VWAP**
- ✅ **VIX ≤ 25** (פחד נמוך)
- ✅ **Gap-and-Go:** מחיר מעל PM High
- ✅ **RVOL ≥ 2.0** (נפח גבוה)
- ✅ **Spread ≤ 0.2%** (נזילות טובה)
- ✅ **Weekly Context:** מגמה שבועית ↑ + מעל VWAP שבועי

**ניהול סקאוט:**
- **גודל:** ¼ מהפוזיציה הרגילה
- **Entry:** PM High + buffer קטן (0.05%)
- **Stop Loss:** min(PM_Low, OR5_Low) - buffer
- **אישור ב-17:00** - חיזוק או יציאה

### שלב 2️⃣ - חיזוק (17:00)
**הגדלת פוזיציה או יציאה**

**תנאי חיזוק:**
- ✅ **OR30 Break:** מעל OR30 High
- ✅ **VWAP:** עדיין מעל VWAP
- ✅ **RVOL:** נפח נמשך גבוה

**ניהול חיזוק:**
- **גודל:** ¾ מהפוזיציה (סה"כ 100%)
- **Entry:** OR30 High + buffer
- **Stop Loss:** OR30 Low (מבני)
- **אלטרנטיבה:** יציאה אם אין אישור

---

## 📅 לוח זמנים יומי

| שעה | פעולה | תיאור |
|------|--------|--------|
| **יום ראשון 09:00** | סריקה שבועית | נתוני שבוע שעבר, מגמה שבועית, VWAP שבועי |
| **09:00** | סריקה ראשונה | נתוני אתמול, Gap, RS, ATR, רמות |
| **16:15** | כפתור Premarket | עדכון PM High/Low |
| **16:20** | סקאוט | כניסה ראשונית (¼ גודל) |
| **17:00** | חיזוק | הגדלה (¾ גודל) או יציאה |
| **23:00** | יציאה קשיחה | כל הפוזיציות |

---

## 📊 שערים קשיחים

### Market Breadth
- **Breadth ≥ 80** (שוק חזק)

### Market Direction  
- **SPY & QQQ & IWM מעל VWAP**
- **VIX ≤ 25** (פחד נמוך)

### Price Action
- **Gap-and-Go:** מעל PM High

### Volume & Liquidity
- **RVOL ≥ 2.0** (נפח גבוה)
- **Spread ≤ 0.2%** (נזילות טובה)

### Weekly Context
- **מגמה שבועית ↑** + **מעל VWAP שבועי** (ל-LONG)
- **מגמה שבועית ↓** + **מתחת VWAP שבועי** (ל-SHORT)
- **לא צמוד ל-PWH/PWL** (רמות שבועיות)
- **Gate נוסף** - מעלה איכות, מוריד כמות טריידים

---

## 🎯 ניהול עסקאות

### כניסה
- **16:20:** PM High + 0.05% buffer
- **17:00:** OR30 High + 0.05% buffer

### Stop Loss
- **16:20:** min(PM_Low, OR5_Low) - 0.05%
- **17:00:** OR30 Low (מבני)

### Take Profit
- **TP1 = 1R:** סגור 50% + העבר SL ל-BE
- **TP2 = 2R:** סגור יתרה

### יציאה
- **Exit:** עד 23:00 IL (בכל מקרה!)

---

## 🖥️ ממשק משתמש (UI)

### כותרת עליונה
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ 📊 Day Trading Dashboard - Scout + Reinforcement Strategy                           │
│ ⏰ 16:18 IL | Scout Window: 16:20 | Reinforcement: 17:00                            │
│ 📈 Market: SPY +0.8% | QQQ +1.2% | IWM +0.3% | VIX 18.5 | Breadth 78% 🟢           │
│ 🎯 Gates: 5/7 PASS | Scout: 12/337 stocks | Reinforcement: 3 ready                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### אינדיקטור כיוון שוק (עגולים מעל המסך)
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Weekly: -3    🟢 Daily: +7                                                       │
│                                                                                      │
│ 📊 Day Trading Dashboard - Scout + Reinforcement Strategy                           │
│ ⏰ 16:18 IL | Scout Window: 16:20 | Reinforcement: 17:00                            │
│ 📈 Market: SPY +0.8% | QQQ +1.2% | IWM +0.3% | VIX 18.5 | Breadth 78% 🟢           │
│ 🎯 Gates: 5/7 PASS | Scout: 12/337 stocks | Reinforcement: 3 ready                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**אינדיקטורים:**
- **Weekly:** -10 עד +10 (עגול אדום/ירוק)
- **Daily:** -10 עד +10 (עגול אדום/ירוק)
- **צבעים:** ירוק (+1 עד +10), אדום (-1 עד -10), אפור (0)

### כפתורי פעולה
- **📅 Weekly Scan** - סריקה שבועית (יום ראשון 09:00)
- **🔍 Scan 09:00** - סריקה ראשונה (שמירה ל-Firebase)
- **📊 Premarket 16:15** - עדכון PM + RR calculation
- **⚡ Scout 16:20** - כניסה ראשונית (¼ גודל)
- **💪 Reinforce 17:00** - חיזוק או יציאה (¾ גודל)
- **🔄 Refresh** - רענון נתונים
- **🏁 Exit All** - יציאה קשיחה מכל הפוזיציות

### טבלה ראשית
```
| Symbol | Price | PM H/L | OR5 H/L | VWAP | RVOL | Spread | Weekly | Daily | Score | Direction | Gates | Scout | Reinforce | RR |
|--------|-------|--------|---------|------|------|--------|--------|-------|-------|-----------|-------|-------|-----------|----| 
| AAPL   | 184.2 | 184.5/182.1 | 184.2/182.3 | 183.0 | 2.1 | 0.05% | 🟢+8 | 🟢+7 | +85 | 🟢LONG | ✅✅✅✅✅✅✅ | READY | WAIT | 1:2 |
| NVDA   | 520.5 | 521.0/518.2 | 520.8/518.5 | 519.0 | 2.3 | 0.04% | 🟢+9 | 🟢+8 | +92 | 🟢LONG | ✅✅✅✅✅✅✅ | READY | WAIT | 1:2.5 |
| TSLA   | 245.8 | 246.5/243.9 | 246.0/244.1 | 245.0 | 1.8 | 0.08% | 🔴-2 | 🟢+3 | +25 | ⚪WAIT | ❌❌✅✅✅✅✅ | FAIL | - | - |
| MSFT   | 385.2 | 386.1/383.8 | 385.5/384.0 | 384.5 | 1.9 | 0.06% | 🔴-5 | 🔴-3 | -65 | 🔴SHORT | ✅✅✅✅✅✅✅ | READY | WAIT | 1:1.8 |
```

**עמודות חדשות:**
- **Weekly:** -10 עד +10 (עגול אדום/ירוק/אפור)
- **Daily:** -10 עד +10 (עגול אדום/ירוק/אפור)

**Gates Status:**
- ✅ = PASS, ❌ = FAIL
- **7 Gates:** Breadth≥80, SPY↑, QQQ↑, IWM↑, VIX≤25, RVOL≥2.0, Spread≤0.2%

---

## 🔧 ארכיטקטורת קבצים

### מבנה תיקיות
```
src/Sidebar/Day1/
├── Components/
│   ├── DayDashboard.tsx          # קובץ ראשי
│   ├── MarketDirectionIndicators.tsx # אינדיקטורי כיוון שוק (עגולים)
│   ├── MarketBreadthPanel.tsx    # פאנל עליון
│   ├── ActionButtons.tsx         # כפתורי פעולה
│   ├── TradingTable.tsx          # טבלה ראשית
│   ├── GatesStatus.tsx           # סטטוס שערים
│   └── RRCalculator.tsx          # חישוב RR
├── Services/
│   ├── PolygonService.ts         # שימוש ב-polygonApi.ts הקיים
│   ├── FirebaseService.ts        # שימוש ב-api.ts הקיים
│   └── MarketDataService.ts      # נתוני שוק (חדש)
├── Types/
│   ├── DayTradingTypes.ts        # טייפים
│   └── MarketTypes.ts            # נתוני שוק
├── Utils/
│   ├── Calculations.ts           # חישובים
│   ├── GatesLogic.ts             # לוגיקת שערים
│   ├── MarketDirectionUtils.ts   # חישוב אינדיקטורי כיוון שוק
│   └── TimeUtils.ts              # פונקציות זמן
├── Hooks/
│   ├── useDayTrading.ts          # הוק ראשי
│   ├── useMarketData.ts          # נתוני שוק
│   └── useGatesStatus.ts         # סטטוס שערים
└── index.ts                      # Export
```

---

## 🔌 שימוש ב-Polygon API

### נתונים נדרשים
**Weekly Scan (יום ראשון 09:00):**
- **Weekly candles** - שבוע שעבר לכל מניה
- **Weekly SMA20/50** - מגמה שבועית
- **Weekly VWAP** - מחיר משוקלל שבועי
- **PWH/PWL** - Weekly High/Low
- **Weekly Context** - Bullish/Bearish/Neutral

**09:00 Scan:**
- **Market data:** SPY, QQQ, IWM, VIX (D1)
- **Market breadth:** %AboveSMA20 על כל 337 מניות
- **Daily candles (D1)** - אתמול לכל מניה
- **SMA20/50/200, MACD, RSI, ADX** - לכל מניה
- **Support/Resistance levels** - לכל מניה
- **ATR (14 days)** - לכל מניה
- **Relative Strength vs SPY** - לכל מניה

**16:15 Premarket:**
- Premarket High/Low
- Gap calculation
- RR calculation

**16:20+ Real-time:**
- 1-5 minute candles
- VWAP (anchored from 16:30)
- RVOL calculation
- OR5/OR30 formation
- Spread (NBBO)

### רשימת מניות
**מקור:** `/public/5min.json`
- **337 מניות** בסה"כ
- **דוגמאות:** AAPL, NVDA, TSLA, AMZN, AMD, MSFT, GOOGL, META
- **טעינה:** `fetch('/5min.json')` - דינמי
- **סינון:** רק מניות שעוברות את כל השערים

### שימוש ב-API הקיים

**Polygon API (polygonApi.ts):**
- שימוש בפונקציות קיימות: getPreviousClose, getAggregates, getMarketStatus
- קבלת נתונים יומיים, תוך-יומיים, ונתוני שוק
- נתוני SPY, QQQ, IWM, VIX

**Firebase API (api.ts):**
- שימוש בפונקציות קיימות: addDocument, updateDocument
- שמירה ועדכון נתונים ל-Firebase
- מבנה נתונים היררכי לפי תאריך וסוג סריקה

---

## 💾 שמירה ל-Firebase

### מבנה קולקשיינים
**כל קולקשיין: שם + תאריך**

#### 1️⃣ weekly_scan_2025_01_06
```json
{
  "scan_date": "2025-01-06",
  "scan_type": "weekly",
  "timestamp": "2025-01-06T09:00:00Z",
  "market_data": {
    "spy_weekly": { "close": 485.2, "sma20": 480.1, "vwap": 482.5 },
    "qqq_weekly": { "close": 425.8, "sma20": 420.3, "vwap": 422.1 },
    "iwm_weekly": { "close": 198.5, "sma20": 195.2, "vwap": 196.8 },
    "vix_weekly": { "close": 18.5, "sma20": 19.2, "vwap": 18.8 }
  },
  "stocks_data": {
    "AAPL": {
      "symbol": "AAPL",
      "weekly_close": 184.2,
      "weekly_sma20": 180.5,
      "weekly_sma50": 175.2,
      "weekly_vwap": 182.1,
      "pwh": 186.5,
      "pwl": 178.9,
      "weekly_trend": "bullish",
      "above_vwap": true,
      "distance_to_pwh": 0.012,
      "distance_to_pwl": 0.029
    }
  }
}
```

#### 2️⃣ daily_scan_2025_01_08
```json
{
  "scan_date": "2025-01-08",
  "scan_type": "daily",
  "timestamp": "2025-01-08T09:00:00Z",
  "market_data": {
    "spy": { "close": 487.5, "change": 0.8, "above_vwap": true },
    "qqq": { "close": 428.2, "change": 1.2, "above_vwap": true },
    "iwm": { "close": 199.1, "change": 0.3, "above_vwap": true },
    "vix": { "close": 18.5, "above_25": false },
    "breadth": 78
  },
  "stocks_data": {
    "AAPL": {
      "symbol": "AAPL",
      "price": 184.2,
      "prev_close": 182.8,
      "change": 0.76,
      "atr": 3.2,
      "rs_vs_spy": 0.45,
      "sma20": 180.5,
      "sma50": 175.2,
      "sma200": 165.8,
      "macd": { "value": 2.1, "signal": 1.8, "histogram": 0.3 },
      "rsi": 65.2,
      "adx": 28.5,
      "support_resistance": {
        "support": 180.0,
        "resistance": 186.0,
        "pivot": 183.0
      }
    }
  }
}
```

#### 3️⃣ premarket_scan_2025_01_08
```json
{
  "scan_date": "2025-01-08",
  "scan_type": "premarket",
  "timestamp": "2025-01-08T16:15:00Z",
  "market_data": {
    "spy_premarket": { "high": 488.5, "low": 487.0, "current": 488.1 },
    "qqq_premarket": { "high": 429.2, "low": 427.8, "current": 428.9 },
    "iwm_premarket": { "high": 199.8, "low": 198.9, "current": 199.5 }
  },
  "stocks_data": {
    "AAPL": {
      "symbol": "AAPL",
      "pm_high": 185.5,
      "pm_low": 183.8,
      "gap_percent": 1.41,
      "gap_type": "UP",
      "rr_calculation": {
        "entry": 185.8,
        "stop_loss": 183.5,
        "take_profit_1": 188.1,
        "take_profit_2": 190.4,
        "rr_ratio": 2.0
      }
    }
  }
}
```

#### 4️⃣ scout_entries_2025_01_08
```json
{
  "scan_date": "2025-01-08",
  "scan_type": "scout",
  "timestamp": "2025-01-08T16:20:00Z",
  "gates_status": {
    "breadth_80": true,
    "spy_above_vwap": true,
    "qqq_above_vwap": true,
    "iwm_above_vwap": true,
    "vix_low": true,
    "weekly_context": true,
    "all_passed": true
  },
  "entries": {
    "AAPL": {
      "symbol": "AAPL",
      "entry_price": 185.8,
      "position_size": 250,
      "stop_loss": 183.5,
      "take_profit_1": 188.1,
      "take_profit_2": 190.4,
      "or5_high": 185.9,
      "or5_low": 184.1,
      "vwap": 184.8,
      "rvol": 2.1,
      "spread": 0.05,
      "status": "ENTRY_EXECUTED"
    }
  }
}
```

#### 5️⃣ reinforcement_2025_01_08
```json
{
  "scan_date": "2025-01-08",
  "scan_type": "reinforcement",
  "timestamp": "2025-01-08T17:00:00Z",
  "or30_data": {
    "or30_high": 186.2,
    "or30_low": 183.8,
    "or30_closed": true,
    "breakout_direction": "UP"
  },
  "reinforcements": {
    "AAPL": {
      "symbol": "AAPL",
      "scout_entry": 185.8,
      "reinforcement_price": 186.3,
      "total_position": 1000,
      "stop_loss": 183.8,
      "take_profit_1": 188.8,
      "take_profit_2": 192.8,
      "status": "REINFORCED"
    }
  }
}
```

#### 6️⃣ end_of_day_2025_01_08
```json
{
  "scan_date": "2025-01-08",
  "scan_type": "end_of_day",
  "timestamp": "2025-01-08T23:00:00Z",
  "final_results": {
    "AAPL": {
      "symbol": "AAPL",
      "entry_price": 185.8,
      "reinforcement_price": 186.3,
      "exit_price": 189.2,
      "total_shares": 1000,
      "total_pnl": 3400,
      "pnl_percent": 1.83,
      "max_profit": 4200,
      "max_loss": -800,
      "exit_reason": "TAKE_PROFIT_2",
      "duration_minutes": 400
    }
  },
  "daily_performance": {
    "total_pnl": 12500,
    "total_trades": 8,
    "winning_trades": 6,
    "losing_trades": 2,
    "win_rate": 75,
    "avg_win": 2800,
    "avg_loss": -1200,
    "profit_factor": 2.33
  }
}
```

---

## ⏰ לוגיקת כפתורים

### כפתור "Weekly Scan" (יום ראשון 09:00)
**פעולות:**
1. טעינת 337 מניות מ-5min.json
2. קבלת נתוני שבוע שעבר (Weekly candles)
3. חישוב מגמה שבועית (Weekly SMA20/50)
4. חישוב VWAP שבועי
5. זיהוי PWH/PWL (Weekly High/Low)
6. סינון מניות לא צמודות לרמות שבועיות
7. שמירה ל-Firebase
8. עדכון Weekly Context לכל מניה

### כפתור "Scan 09:00"
**פעולות:**
1. טעינת 337 מניות מ-5min.json
2. קבלת נתוני שוק (SPY, QQQ, IWM, VIX)
3. סריקה יומית לכל המניות
4. חישוב Relative Strength vs SPY
5. חישוב Market Breadth
6. שמירה ל-Firebase
7. עדכון UI

### כפתור "Premarket 16:15"
**פעולות:**
1. קבלת נתוני Premarket
2. חישוב PM High/Low ו-Gap
3. חישוב RR לכל מניה
4. שמירה ל-Firebase
5. הפעלת כפתור "Scout 16:20"

### כפתור "Scout 16:20"
**פעולות:**
1. בדיקת סטטוס כל השערים
2. חישוב Entry/Stop/TP למניות שעוברות
3. ביצוע כניסות סקאוט (¼ גודל)
4. שמירה ל-Firebase
5. הפעלת כפתור "Reinforce 17:00"

### כפתור "Reinforce 17:00"
**פעולות:**
1. בדיקת סטטוס OR30 Break
2. חיזוק או יציאה מפוזיציות סקאוט
3. ביצוע כניסות חיזוק (¾ גודל)
4. שמירה ל-Firebase

---

## 🎯 נוסחת כניסה סופית למניה

### תנאי כניסה (כל השערים חייבים לעבור)

#### שערים יומיים (כל יום 09:00):
1. **Market Breadth ≥ 80** (שוק חזק)
2. **SPY & QQQ & IWM מעל VWAP** (כיוון שוק חיובי)
3. **VIX ≤ 25** (פחד נמוך)
4. **RVOL ≥ 2.0** (נפח גבוה)
5. **Spread ≤ 0.2%** (נזילות טובה)

#### שערים שבועיים (יום ראשון 09:00):
6. **Weekly Trend ↑** + **מעל Weekly VWAP** (ל-LONG)
7. **Weekly Trend ↓** + **מתחת Weekly VWAP** (ל-SHORT)
8. **לא צמוד ל-PWH/PWL** (רמות שבועיות)

### נוסחת כניסה:
```
IF (Daily Gates 1-5 = PASS) AND (Weekly Gates 6-8 = PASS):
    SCORE = (Daily Score × 70%) + (Weekly Score × 30%)
    
    IF SCORE ≥ +70:
        DIRECTION = LONG
        ENTRY = PM High + 0.05% buffer
        STOP LOSS = min(PM_Low, OR5_Low) - 0.05%
        
    ELSE IF SCORE ≤ -70:
        DIRECTION = SHORT  
        ENTRY = PM Low - 0.05% buffer
        STOP LOSS = max(PM_High, OR5_High) + 0.05%
        
    ELSE:
        DIRECTION = WAIT
        NO ENTRY (Score between -49 and +49)
    
    IF DIRECTION ≠ WAIT:
        TAKE PROFIT 1 = Entry + 1R (סגור 50%)
        TAKE PROFIT 2 = Entry + 2R (סגור יתרה)
        POSITION SIZE = ¼ גודל (Scout) + ¾ גודל (Reinforcement)
ELSE:
    NO ENTRY (Gates failed)
```

### חישוב ציון:

#### Daily Score (0-100):
- **Market Breadth ≥ 80:** +20 נקודות
- **SPY & QQQ & IWM מעל VWAP:** +15 נקודות
- **VIX ≤ 25:** +10 נקודות
- **RVOL ≥ 2.0:** +15 נקודות
- **Spread ≤ 0.2%:** +10 נקודות
- **Gap-and-Go (מעל PM High):** +20 נקודות
- **Weekly Context Bonus:** +10 נקודות

#### Weekly Score (-100 עד +100):
- **Weekly Trend Bullish:** +30 נקודות
- **מעל Weekly VWAP:** +25 נקודות
- **לא צמוד ל-PWH/PWL:** +20 נקודות
- **Weekly RS vs SPY:** +25 נקודות

#### Final Score (-100 עד +100):
- **+70 עד +100:** LONG (HIGH CONFIDENCE)
- **+50 עד +69:** LONG (MEDIUM CONFIDENCE)
- **-50 עד -69:** SHORT (MEDIUM CONFIDENCE)
- **-70 עד -100:** SHORT (HIGH CONFIDENCE)
- **-49 עד +49:** WAIT (NO DIRECTION)

### סיכום:
**8 שערים + ציון סה"כ:**
- **5 שערים יומיים** (כל יום)
- **3 שערים שבועיים** (יום ראשון)
- **רק אם כולם עוברים** → חישוב ציון
- **ציון ≥ 70** → כניסה למניה
- **איכות גבוהה, כמות נמוכה**

---

---


