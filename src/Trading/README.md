# 🎯 Risk/Reward Calculator Module

מודול מתקדם לחישוב יחס סיכון-רווח (R:R) עבור טריידים, כולל חישוב אוטומטי של Stop Loss ו-Target מבוסס על ניתוח טכני.

## 📋 תוכן עניינים

- [מה זה R:R](#מה-זה-rr)
- [כלל הזהב](#כלל-הזהב)
- [שימוש בסיסי](#שימוש-בסיסי)
- [שימוש מתקדם](#שימוש-מתקדם)
- [API Reference](#api-reference)
- [דוגמאות](#דוגמאות)

## 🎯 מה זה R:R?

**Risk/Reward Ratio** הוא יחס בין הסיכון (Risk) לבין הרווח הפוטנציאלי (Reward) בטרייד:

```
R:R = Reward ÷ Risk

Risk = |Entry Price - Stop Loss|
Reward = |Target Price - Entry Price|
```

### דוגמה:
```
Entry: $100
Stop Loss: $95 (סיכון $5)
Target: $110 (רווח $10)
R:R = $10 ÷ $5 = 2.0 ✅
```

## 🥇 כלל הזהב

**❌ לא להיכנס לטרייד ללא R:R של לפחות 2:1**

למה? כי סטטיסטית, גם עם 50% הצלחה תהיה רווחי:
- 50% הצלחה × 2.0 רווח = +1.0
- 50% כישלון × 1.0 הפסד = -0.5
- **תוצאה נטו: +0.5 (רווח!)** 💰

## 🚀 שימוש בסיסי

### חישוב R:R פשוט
```typescript
import { calculateSimpleRR } from './RiskRewardCalculator';

const result = calculateSimpleRR(
    100,  // Entry price
    95,   // Stop loss
    110   // Target
);

console.log(`R:R: ${result.ratio.toFixed(2)}:1`);
console.log(`Approved: ${result.isApproved}`);
```

### בדיקת אישור טרייד
```typescript
import { approveTradeWithRR } from './RiskRewardCalculator';

const tradeSetup = approveTradeWithRR(
    'AAPL',           // Symbol
    'Long',           // Direction
    150.00,           // Entry price
    75,               // Technical score (0-100)
    ohlcData          // Historical data
);

if (tradeSetup.finalApproval) {
    console.log('✅ Trade approved for execution!');
    console.log(`R:R: ${tradeSetup.riskReward.ratio.toFixed(2)}:1`);
} else {
    console.log('❌ Trade rejected');
}
```

## 🔬 שימוש מתקדם

### חישוב עם ניתוח טכני אוטומטי
```typescript
import { calculateRiskReward } from './RiskRewardCalculator';

const analysis = calculateRiskReward(
    150.00,     // Entry price
    'Long',     // Direction
    ohlcData,   // Historical OHLC data
    2.5         // Minimum R:R ratio (optional, default: 2.0)
);

console.log('📊 Advanced Analysis:');
console.log(`Stop Loss: $${analysis.stopLoss.toFixed(2)} (${analysis.method})`);
console.log(`Target: $${analysis.target.toFixed(2)}`);
console.log(`R:R: ${analysis.ratio.toFixed(2)}:1`);
console.log(`Confidence: ${analysis.confidence}%`);
```

### זיהוי רמות תמיכה והתנגדות
```typescript
import { findSupportResistanceLevels } from './RiskRewardCalculator';

const levels = findSupportResistanceLevels(ohlcData, currentPrice);

levels.forEach(level => {
    console.log(`${level.type}: $${level.price.toFixed(2)} (tested ${level.strength}x)`);
});
```

## 📚 API Reference

### Core Functions

#### `calculateSimpleRR(entry, stopLoss, target)`
חישוב R:R בסיסי עם פרמטרים ידניים.

**Parameters:**
- `entry` (number): מחיר כניסה
- `stopLoss` (number): מחיר Stop Loss
- `target` (number): מחיר Target

**Returns:**
```typescript
{
    ratio: number;        // יחס R:R
    isApproved: boolean;  // האם עובר מבחן 2:1
    risk: number;         // סכום סיכון בדולרים
    reward: number;       // סכום רווח בדולרים
}
```

#### `calculateRiskReward(entry, direction, ohlcData, minRatio?)`
חישוב R:R מתקדם עם ניתוח טכני אוטומטי.

**Parameters:**
- `entry` (number): מחיר כניסה
- `direction` ('Long' | 'Short'): כיוון הטרייד
- `ohlcData` (OHLCData[]): נתוני OHLC היסטוריים
- `minRatio` (number, optional): יחס R:R מינימלי (ברירת מחדל: 2.0)

**Returns:** `RiskRewardResult` - ניתוח מלא כולל Stop/Target אוטומטיים

#### `approveTradeWithRR(symbol, direction, entry, score, ohlcData, minRatio?, minScore?)`
אישור טרייד מלא - משלב ציון טכני עם R:R.

**Parameters:**
- `symbol` (string): סמל המניה
- `direction` ('Long' | 'Short'): כיוון הטרייד  
- `entry` (number): מחיר כניסה
- `score` (number): ציון טכני 0-100
- `ohlcData` (OHLCData[]): נתוני OHLC
- `minRatio` (number, optional): R:R מינימלי (ברירת מחדל: 2.0)
- `minScore` (number, optional): ציון מינימלי (ברירת מחדל: 60)

**Returns:** `TradeSetup` - הגדרת טרייד מלאה עם אישור סופי

### Helper Functions

#### `calculateATR(ohlcData, period?)`
חישוב Average True Range (תנודתיות).

#### `findSupportResistanceLevels(ohlcData, currentPrice, lookbackPeriod?)`
זיהוי רמות תמיכה והתנגדות.

#### `calculateStopLoss(entry, direction, atr, levels)`
חישוב Stop Loss אוטומטי.

#### `calculateTarget(entry, direction, atr, levels, riskAmount)`
חישוב Target אוטומטי.

## 💡 דוגמאות מעשיות

### דוגמה 1: Long Trade
```typescript
// AAPL Long Setup
const setup = approveTradeWithRR(
    'AAPL', 'Long', 150.00, 78, aaplOhlcData
);

// Output:
// ✅ Trade approved!
// Entry: $150.00
// Stop: $147.50 (Support Level, tested 3x)
// Target: $156.00 (Resistance Level, tested 2x) 
// R:R: 2.4:1
// Confidence: 82%
```

### דוגמה 2: Short Trade
```typescript
// TSLA Short Setup
const setup = approveTradeWithRR(
    'TSLA', 'Short', 200.00, 65, tslaOhlcData
);

// Output:
// ❌ Trade rejected!
// Reason: R:R = 1.3:1 < 2.0 minimum
```

### דוגמה 3: Pipeline Integration
```typescript
// שילוב במערכת טריידינג אוטומטית
const candidates = await analyzeStocks(stockList);

const approvedTrades = candidates
    .filter(stock => stock.score >= 70)
    .map(stock => approveTradeWithRR(
        stock.symbol, 
        stock.direction, 
        stock.price, 
        stock.score, 
        stock.ohlcData
    ))
    .filter(trade => trade.finalApproval);

console.log(`✅ ${approvedTrades.length} trades approved for execution`);
```

## 🛡️ ניהול סיכונים

### שילוב עם Position Sizing
```typescript
const accountSize = 100000; // $100K חשבון
const riskPerTrade = 0.02;   // 2% סיכון לטרייד

const maxLoss = accountSize * riskPerTrade; // $2,000
const positionSize = maxLoss / setup.riskReward.risk;

console.log(`Position size: ${positionSize.toFixed(0)} shares`);
```

### Multiple Time Frame Analysis
```typescript
// בדיקה במספר טיימפריימים
const daily = calculateRiskReward(entry, 'Long', dailyData);
const hourly = calculateRiskReward(entry, 'Long', hourlyData);

const finalApproval = daily.isApproved && hourly.isApproved;
```

## 🎨 UI Components

השתמש ב-`TradeAnalyzer` component לממשק משתמש:

```tsx
import TradeAnalyzer from './TradeAnalyzer';

<TradeAnalyzer 
    symbol="AAPL"
    currentPrice={150.00}
    direction="Long"
    score={78}
    ohlcData={historicalData}
/>
```

## 🚨 Important Notes

1. **תמיד בדוק R:R לפני כניסה לטרייד**
2. **אל תתפשר על יחס נמוך מ-2:1**
3. **השתמש בנתוני OHLC עדכניים**
4. **בדוק מספר טיימפריימים**
5. **שלב עם position sizing**

---

**💎 זכור: טריידינג מוצלח זה לא על להיות צודק תמיד, אלא על לנהל סיכונים נכון!**
