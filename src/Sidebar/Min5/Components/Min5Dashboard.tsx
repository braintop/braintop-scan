import * as React from 'react';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import Remove from '@mui/icons-material/Remove';

// Load symbols from 5min.json - using fetch instead of import
const SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMD']; // Fallback symbols

const API_BASE_URL = 'https://api.polygon.io';
const API_KEY = 'p5X63iFIJpWktly8p0eGfw8cv7gJgdAz';

interface Candle5m {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

function SymbolList({ symbols, selected, onSelect }: { symbols: string[]; selected: string | null; onSelect: (s: string) => void }): React.ReactElement {
  const displaySymbols = symbols.slice(0, 100); // Show first 100 symbols
  return (
    <div style={{ minWidth: 200, borderRight: '1px solid #eee', padding: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Symbols ({displaySymbols.length})</div>
      {displaySymbols.map((s) => (
        <div
          key={s}
          onClick={() => onSelect(s)}
          style={{
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: 6,
            background: selected === s ? '#e3f2fd' : 'transparent',
            fontWeight: selected === s ? 700 : 400,
            marginBottom: 4,
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );
}

// Candlestick pattern detection
function detectCandlePattern(candles: Candle5m[]): { pattern: string; signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' } {
  if (candles.length < 3) return { pattern: 'N/A', signal: 'NEUTRAL' };
  
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  const { o, h, l, c } = last;
  const { o: o2, c: c2 } = prev;
  
  const body = Math.abs(c - o);
  const upperShadow = h - Math.max(o, c);
  const lowerShadow = Math.min(o, c) - l;
  const totalRange = h - l;
  
  // Hammer
  if (lowerShadow > 2 * body && upperShadow < body && body > 0) {
    return { pattern: 'Hammer', signal: 'BULLISH' };
  }
  
  // Shooting Star
  if (upperShadow > 2 * body && lowerShadow < body && body > 0) {
    return { pattern: 'Shooting Star', signal: 'BEARISH' };
  }
  
  // Bullish Engulfing
  if (c2 < o2 && c > o && o < c2 && c > o2) {
    return { pattern: 'Bullish Engulfing', signal: 'BULLISH' };
  }
  
  // Bearish Engulfing
  if (c2 > o2 && c < o && o > c2 && c < o2) {
    return { pattern: 'Bearish Engulfing', signal: 'BEARISH' };
  }
  
  // Doji
  if (body < totalRange * 0.1) {
    return { pattern: 'Doji', signal: 'NEUTRAL' };
  }
  
  return { pattern: 'Normal', signal: 'NEUTRAL' };
}

// Calculate indicators
function calculateIndicators(candles: Candle5m[]) {
  if (candles.length < 12) return null;
  
  const closes = candles.map(c => c.c);
  const sma3 = closes.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const sma12 = closes.slice(-12).reduce((a, b) => a + b, 0) / 12;
  const lastClose = closes[closes.length - 1];
  
  // VWAP
  const totalVolume = candles.reduce((sum, c) => sum + c.v, 0);
  const vwap = candles.reduce((sum, c) => sum + (c.c * c.v), 0) / totalVolume;
  
  // Simple MACD
  const ema12 = closes.slice(-12).reduce((a, b) => a + b, 0) / 12;
  const ema26 = closes.slice(-26).reduce((a, b) => a + b, 0) / 26;
  const macd = ema12 - ema26;
  
  return {
    price: lastClose,
    sma3,
    sma12,
    vwap,
    macd,
    trend: sma3 > sma12 ? 'UP' : 'DOWN',
    vwapSignal: lastClose > vwap ? 'ABOVE' : 'BELOW',
    macdSignal: macd > 0 ? 'BULLISH' : 'BEARISH'
  };
}

// Calculate entry level based on pattern and indicators
function calculateEntryLevel(price: number, pattern: any, indicators: any): string {
  if (!indicators) return 'N/A';
  
  const { sma3, sma12, vwap } = indicators;
  
  // For bullish patterns, suggest entry near support levels
  if (pattern.signal === 'BULLISH') {
    if (sma3 > sma12) {
      return `Above ${Math.min(sma3, vwap).toFixed(2)}`;
    } else {
      return `Above ${Math.min(price * 0.998, sma12).toFixed(2)}`;
    }
  }
  
  // For bearish patterns, suggest entry near resistance levels
  if (pattern.signal === 'BEARISH') {
    if (sma3 < sma12) {
      return `Below ${Math.max(sma3, vwap).toFixed(2)}`;
    } else {
      return `Below ${Math.max(price * 1.002, sma12).toFixed(2)}`;
    }
  }
  
  // For neutral patterns, use SMA levels
  if (indicators.trend === 'UP') {
    return `Above ${sma3.toFixed(2)}`;
  } else {
    return `Below ${sma3.toFixed(2)}`;
  }
}

function TradingTable({ symbols, selectedSymbol, onSymbolSelect }: { 
  symbols: string[]; 
  selectedSymbol: string | null; 
  onSymbolSelect: (s: string) => void;
}): React.ReactElement {
  const [symbolData, setSymbolData] = React.useState<{[key: string]: any}>({});
  const [loading, setLoading] = React.useState<boolean>(false);
  const [timeToNextCandle, setTimeToNextCandle] = React.useState<string>('');
  const [isTimerUrgent, setIsTimerUrgent] = React.useState<boolean>(false);
  const [marketTrend, setMarketTrend] = React.useState<{ score: number; icon: 'up' | 'down' | 'neutral'; color: string } | null>(null);
  const [isFiltering, setIsFiltering] = React.useState<boolean>(false);
  const [filteredSymbols, setFilteredSymbols] = React.useState<string[] | null>(null);

  // Calculate time to next 5-minute candle
  React.useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      
      // Calculate seconds until next 5-minute mark (0, 5, 10, 15, etc.)
      const next5Min = Math.ceil(minutes / 5) * 5;
      const next5MinTime = new Date(now);
      
      if (next5Min >= 60) {
        // If next 5-minute mark is in next hour, set to next hour at 0 minutes
        next5MinTime.setHours(next5MinTime.getHours() + 1);
        next5MinTime.setMinutes(0, 0, 0);
      } else {
        // Otherwise, just set the minutes
        next5MinTime.setMinutes(next5Min, 0, 0);
      }
      
      const diffMs = next5MinTime.getTime() - now.getTime();
      const diffSeconds = Math.max(0, Math.floor(diffMs / 1000)); // Ensure non-negative
      
      const minutesLeft = Math.floor(diffSeconds / 60);
      const secondsLeft = diffSeconds % 60;
      
      setTimeToNextCandle(`${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}`);
      setIsTimerUrgent(diffSeconds <= 30); // Red when 30 seconds or less
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load filtered symbols from localStorage on component mount
  React.useEffect(() => {
    const loadFilteredSymbols = () => {
      try {
        const stored = localStorage.getItem('min5_filtered_symbols');
        const storedDate = localStorage.getItem('min5_filter_date');
        const today = new Date().toISOString().split('T')[0];
        
        if (stored && storedDate === today) {
          const symbols = JSON.parse(stored);
          setFilteredSymbols(symbols);
          console.log(`📋 Loaded ${symbols.length} filtered symbols from localStorage for ${today}`);
        } else {
          console.log('📋 No valid filtered symbols found in localStorage');
        }
      } catch (error) {
        console.error('Error loading filtered symbols:', error);
      }
    };
    
    loadFilteredSymbols();
  }, []);

  // Fetch market data (SPY) and calculate its trend
  const fetchMarketData = React.useCallback(async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if within market hours (16:30 to 23:00 Israeli time)
    // 16:30 IST = 9:30 AM EST
    // 23:00 IST = 4:00 PM EST
    const isMarketOpen = (currentHour > 16 || (currentHour === 16 && currentMinute >= 30)) && currentHour < 23;

    if (!isMarketOpen) {
      setMarketTrend(null); // Clear market trend outside market hours
      return;
    }

    try {
      const symbol = 'SPY'; // Using SPY as the market index
      const fiveMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000); // Need enough candles for indicators
      const url = `${API_BASE_URL}/v2/aggs/ticker/${symbol}/range/5/minute/${fiveMinutesAgo.toISOString().split('T')[0]}/${now.toISOString().split('T')[0]}`;

      const response = await fetch(`${url}?${new URLSearchParams({
        adjusted: "true",
        sort: "asc",
        apiKey: API_KEY
      })}`);

      if (!response.ok) {
        console.error(`Error fetching market data for ${symbol}:`, response.statusText);
        setMarketTrend(null);
        return;
      }

      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        console.warn(`No market data results for ${symbol}`);
        setMarketTrend(null);
        return;
      }

      const candles = data.results.map((item: any) => ({
        t: item.t, o: item.o, h: item.h, l: item.l, c: item.c, v: item.v
      }));

      const indicators = calculateIndicators(candles);
      const pattern = detectCandlePattern(candles);

      if (indicators && pattern) {
        const score = getScore({ indicators, pattern }); // Reuse getScore for SPY
        const scaledScore = Math.round(score / 10); // Scale to -10 to 10

        let iconType: 'up' | 'down' | 'neutral' = 'neutral';
        let color = '#424242'; // Grey

        if (scaledScore > 0) {
          iconType = 'up';
          color = '#2e7d32'; // Green
        } else if (scaledScore < 0) {
          iconType = 'down';
          color = '#d32f2f'; // Red
        }

        setMarketTrend({ score: scaledScore, icon: iconType, color });
      } else {
        setMarketTrend(null);
      }

    } catch (error) {
      console.error('Error fetching market data:', error);
      setMarketTrend(null);
    }
  }, []);

  // Filter symbols by volume (Volume > 50,000 from first candle)
  const filterByVolume = React.useCallback(async () => {
    setIsFiltering(true);
    console.log('🔍 Starting volume filter for all 337 symbols...');
    
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      // Fetch data for all symbols
      const promises = symbols.map(async (symbol) => {
        try {
          const url = `${API_BASE_URL}/v2/aggs/ticker/${symbol}/range/5/minute/${fiveMinutesAgo.toISOString().split('T')[0]}/${now.toISOString().split('T')[0]}`;
          
          const response = await fetch(`${url}?${new URLSearchParams({
            adjusted: "true",
            sort: "asc",
            apiKey: API_KEY
          })}`);
          
          if (!response.ok) return null;
          
          const data = await response.json();
          if (!data.results || data.results.length === 0) return null;
          
          // Get volume from first candle (16:30-16:35)
          const firstCandle = data.results[0];
          const volume = firstCandle.v || 0;
          
          return {
            symbol,
            volume,
            price: firstCandle.c
          };
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      const validResults = results.filter(result => result !== null);
      
      // Filter by volume > 50,000
      const filtered = validResults.filter(result => result.volume > 50000);
      
      // Sort by volume descending
      filtered.sort((a, b) => b.volume - a.volume);
      
      const filteredSymbolList = filtered.map(result => result.symbol);
      
      // Save to localStorage
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('min5_filtered_symbols', JSON.stringify(filteredSymbolList));
      localStorage.setItem('min5_filter_date', today);
      localStorage.setItem('min5_filter_volume', '50000');
      
      setFilteredSymbols(filteredSymbolList);
      
      console.log(`✅ Volume filter completed:`);
      console.log(`   Total symbols: ${validResults.length}`);
      console.log(`   Filtered (Volume > 50K): ${filtered.length}`);
      console.log(`   Top 10 by volume:`, filtered.slice(0, 10).map(r => `${r.symbol}(${r.volume.toLocaleString()})`));
      
    } catch (error) {
      console.error('Error in volume filter:', error);
    } finally {
      setIsFiltering(false);
    }
  }, [symbols]);

  // Fetch data for all symbols
  const fetchAllSymbols = React.useCallback(async () => {
    setLoading(true);
    
    // Use filtered symbols if available, otherwise use first 100
    const symbolsToFetch = filteredSymbols || symbols.slice(0, 100);
    console.log(`🔄 Fetching data for ${symbolsToFetch.length} symbols ${filteredSymbols ? '(filtered)' : '(first 100)'}`);
    
    const promises = symbolsToFetch.map(async (symbol) => {
      try {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        const url = `${API_BASE_URL}/v2/aggs/ticker/${symbol}/range/5/minute/${fiveMinutesAgo.toISOString().split('T')[0]}/${now.toISOString().split('T')[0]}`;
        
        const response = await fetch(`${url}?${new URLSearchParams({
          adjusted: "true",
          sort: "asc",
          apiKey: API_KEY
        })}`);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (!data.results || data.results.length === 0) return null;
        
        const candles = data.results.map((item: any) => ({
          t: item.t,
          o: item.o,
          h: item.h,
          l: item.l,
          c: item.c,
          v: item.v
        }));
        
        const indicators = calculateIndicators(candles);
        const pattern = detectCandlePattern(candles);
        
        // Calculate entry level based on current price and pattern
        const lastClose = candles[candles.length - 1]?.c || 0;
        const entryLevel = calculateEntryLevel(lastClose, pattern, indicators);
        
        return {
          symbol,
          candles,
          indicators,
          pattern,
          entryLevel,
          lastUpdate: new Date()
        };
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    const dataMap: {[key: string]: any} = {};
    results.forEach(result => {
      if (result) {
        dataMap[result.symbol] = result;
      }
    });
    
    setSymbolData(dataMap);
    console.log(`✅ Loaded ${Object.keys(dataMap).length} symbols successfully`);
    setLoading(false);
  }, [symbols, filteredSymbols]);

  // Auto-refresh every 5 minutes
  React.useEffect(() => {
    fetchAllSymbols();
    fetchMarketData(); // Fetch market data initially
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing data every 5 minutes');
      fetchAllSymbols();
      fetchMarketData(); // Refresh market data with symbols
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllSymbols, fetchMarketData]);

  const getActionColor = (data: any) => {
    if (!data?.indicators || !data?.pattern) return '#666';
    
    const { indicators, pattern } = data;
    const bullishCount = [
      indicators.trend === 'UP',
      indicators.macdSignal === 'BULLISH',
      indicators.vwapSignal === 'ABOVE',
      pattern.signal === 'BULLISH'
    ].filter(Boolean).length;
    
    if (bullishCount >= 3) return '#2e7d32'; // Green for LONG
    if (bullishCount <= 1) return '#d32f2f'; // Red for SHORT
    return '#f57c00'; // Orange for WAIT
  };

  const getAction = (data: any) => {
    if (!data?.indicators || !data?.pattern) return 'WAIT';
    
    const { indicators, pattern } = data;
    const bullishCount = [
      indicators.trend === 'UP',
      indicators.macdSignal === 'BULLISH',
      indicators.vwapSignal === 'ABOVE',
      pattern.signal === 'BULLISH'
    ].filter(Boolean).length;
    
    if (bullishCount >= 3) return 'LONG';
    if (bullishCount <= 1) return 'SHORT';
    return 'WAIT';
  };

  const getScore = (data: any) => {
    if (!data?.indicators || !data?.pattern) return 0;
    
    const { indicators, pattern } = data;
    let score = 0;
    
    // Trend (0-25 points)
    if (indicators.trend === 'UP') score += 25;
    else if (indicators.trend === 'DOWN') score -= 25;
    
    // MACD (0-25 points)
    if (indicators.macdSignal === 'BULLISH') score += 25;
    else if (indicators.macdSignal === 'BEARISH') score -= 25;
    
    // VWAP (0-25 points)
    if (indicators.vwapSignal === 'ABOVE') score += 25;
    else if (indicators.vwapSignal === 'BELOW') score -= 25;
    
    // Pattern (0-25 points)
    if (pattern.signal === 'BULLISH') score += 25;
    else if (pattern.signal === 'BEARISH') score -= 25;
    
    return Math.max(-100, Math.min(100, score)); // Clamp between -100 and 100
  };

  const getSMAColor = (price: number, sma: number) => {
    const diff = ((price - sma) / sma) * 100; // Percentage difference
    if (diff > 0.5) return '#1976d2'; // Blue for bullish (>0.5% above)
    if (diff < -0.5) return '#d32f2f'; // Red for bearish (>0.5% below)
    return '#424242'; // Black for neutral (±0.5%)
  };

  // Sort by pattern first (any pattern beats Normal), then by score
  const sortSymbolsByPatternFirst = (symbolData: any[]) => {
    return symbolData.sort((a: any, b: any) => {
      const aData = a;
      const bData = b;
      
      // Pattern priority: Any pattern beats Normal
      const aHasPattern = aData.pattern?.pattern && aData.pattern.pattern !== 'Normal';
      const bHasPattern = bData.pattern?.pattern && bData.pattern.pattern !== 'Normal';
      
      // Patterns first
      if (aHasPattern && !bHasPattern) return -1;
      if (!aHasPattern && bHasPattern) return 1;
      
      // If both have patterns or both are Normal, sort by score
      const aScore = getScore(aData);
      const bScore = getScore(bData);
      return bScore - aScore; // Higher score first
    });
  };

  return (
    <div style={{ flex: 1, padding: 16 }}>
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}
      </style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>Trading Signals - 5min</h2>
          <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>
            Sorted by: Patterns First, then Score
            {filteredSymbols && (
              <span style={{ marginLeft: 8, color: '#4caf50', fontWeight: 'bold' }}>
                | {filteredSymbols.length} symbols (filtered)
              </span>
            )}
          </div>
          {marketTrend && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: marketTrend.color + '1A', // Light background tint
              padding: '4px 8px',
              borderRadius: 4,
              border: `1px solid ${marketTrend.color}`,
              fontWeight: 'bold',
              fontSize: 16,
              color: marketTrend.color
            }}>
              {marketTrend.icon === 'up' && <ArrowUpward style={{ color: marketTrend.color, fontSize: 20 }} />}
              {marketTrend.icon === 'down' && <ArrowDownward style={{ color: marketTrend.color, fontSize: 20 }} />}
              {marketTrend.icon === 'neutral' && <Remove style={{ color: marketTrend.color, fontSize: 20 }} />}
              <span>{marketTrend.score}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={filterByVolume}
            disabled={isFiltering}
            style={{
              background: isFiltering ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: 14,
              cursor: isFiltering ? 'not-allowed' : 'pointer',
              opacity: isFiltering ? 0.6 : 1
            }}
          >
            {isFiltering ? '🔍 Filtering...' : '📊 Filter by Volume'}
          </button>
          <div style={{ 
            background: isTimerUrgent ? '#ffebee' : '#e3f2fd', 
            padding: '8px 12px', 
            borderRadius: 8, 
            border: `2px solid ${isTimerUrgent ? '#f44336' : '#2196f3'}`,
            fontWeight: 'bold',
            fontSize: 16,
            color: isTimerUrgent ? '#d32f2f' : '#1976d2',
            animation: isTimerUrgent ? 'pulse 1s infinite' : 'none'
          }}>
            ⏰ Next Candle: {timeToNextCandle}
          </div>
          {loading && <div>🔄 Updating...</div>}
          <div style={{ fontSize: 12, color: '#666' }}>
            Last: {Object.values(symbolData)[0]?.lastUpdate?.toLocaleTimeString() || 'Never'}
          </div>
        </div>
      </div>
      
      <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
              <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ddd' }}>Symbol</th>
              <th style={{ padding: 8, textAlign: 'right', border: '1px solid #ddd' }}>Price</th>
              <th style={{ padding: 8, textAlign: 'center', border: '1px solid #ddd' }}>Time</th>
              <th style={{ padding: 8, textAlign: 'center', border: '1px solid #ddd' }}>Score</th>
              <th style={{ padding: 8, textAlign: 'right', border: '1px solid #ddd' }}>SMA3</th>
              <th style={{ padding: 8, textAlign: 'right', border: '1px solid #ddd' }}>SMA12</th>
              <th style={{ padding: 8, textAlign: 'center', border: '1px solid #ddd' }}>Trend</th>
              <th style={{ padding: 8, textAlign: 'center', border: '1px solid #ddd' }}>MACD</th>
              <th style={{ padding: 8, textAlign: 'center', border: '1px solid #ddd' }}>VWAP</th>
              <th style={{ padding: 8, textAlign: 'center', border: '1px solid #ddd', minWidth: 120, maxWidth: 150 }}>Pattern / Volume</th>
              <th style={{ padding: 8, textAlign: 'center', border: '1px solid #ddd' }}>Entry Level</th>
              <th style={{ padding: 8, textAlign: 'center', border: '1px solid #ddd' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortSymbolsByPatternFirst(Object.values(symbolData))
              .map((data: any) => (
              <tr 
                key={data.symbol}
                style={{ 
                  cursor: 'pointer',
                  background: selectedSymbol === data.symbol ? '#e3f2fd' : 'transparent',
                  borderBottom: '1px solid #eee'
                }}
                onClick={() => onSymbolSelect(data.symbol)}
              >
                <td style={{ padding: 8, border: '1px solid #ddd', fontWeight: 'bold' }}>
                  {data.symbol}
                </td>
                <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right' }}>
                  {data.indicators?.price?.toFixed(2) || 'N/A'}
                </td>
                <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center', fontSize: 12 }}>
                  {data.lastUpdate?.toLocaleTimeString('he-IL', { 
                    timeZone: 'Asia/Jerusalem',
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }) || 'N/A'}
                </td>
                <td style={{ 
                  padding: 8, 
                  border: '1px solid #ddd', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: getScore(data) > 50 ? '#2e7d32' : getScore(data) < -50 ? '#d32f2f' : '#666'
                }}>
                  {getScore(data) > 0 ? '+' : ''}{getScore(data)}
                </td>
                <td style={{ 
                  padding: 8, 
                  border: '1px solid #ddd', 
                  textAlign: 'right',
                  color: data.indicators?.price && data.indicators?.sma3 ? 
                    getSMAColor(data.indicators.price, data.indicators.sma3) : '#424242',
                  fontWeight: 'bold'
                }}>
                  {data.indicators?.sma3?.toFixed(2) || 'N/A'}
                </td>
                <td style={{ 
                  padding: 8, 
                  border: '1px solid #ddd', 
                  textAlign: 'right',
                  color: data.indicators?.price && data.indicators?.sma12 ? 
                    getSMAColor(data.indicators.price, data.indicators.sma12) : '#424242',
                  fontWeight: 'bold'
                }}>
                  {data.indicators?.sma12?.toFixed(2) || 'N/A'}
                </td>
                <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                  {data.indicators?.trend === 'UP' ? '✅ UP' : '❌ DOWN'}
                </td>
                <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                  {data.indicators?.macdSignal === 'BULLISH' ? '✅' : '❌'}
                </td>
                <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center' }}>
                  {data.indicators?.vwapSignal === 'ABOVE' ? '✅' : '❌'}
                </td>
                <td style={{ 
                  padding: 8, 
                  border: '1px solid #ddd', 
                  textAlign: 'center',
                  background: data.pattern?.pattern && data.pattern.pattern !== 'Normal' ? '#e8f5e8' : 'transparent',
                  color: data.pattern?.pattern && data.pattern.pattern !== 'Normal' ? '#2e7d32' : 'inherit',
                  fontWeight: data.pattern?.pattern && data.pattern.pattern !== 'Normal' ? 'bold' : 'normal',
                  fontSize: 12,
                  minWidth: 120,
                  maxWidth: 150
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 2 }}>
                    {data.pattern?.pattern || 'Normal'}
                  </div>
                  <div style={{ fontSize: 10, color: '#666' }}>
                    Vol: {data.candles?.[data.candles.length - 1]?.v ? 
                      (data.candles[data.candles.length - 1].v / 1000).toFixed(0) + 'K' : 'N/A'}
                  </div>
                </td>
                <td style={{ padding: 8, border: '1px solid #ddd', textAlign: 'center', fontSize: 12 }}>
                  {data.entryLevel || 'N/A'}
                </td>
                <td style={{ 
                  padding: 8, 
                  border: '1px solid #ddd', 
                  textAlign: 'center',
                  color: getActionColor(data),
                  fontWeight: 'bold'
                }}>
                  {getAction(data) === 'LONG' ? '🟢 LONG' : 
                   getAction(data) === 'SHORT' ? '🔴 SHORT' : '⚪ WAIT'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export function Min5Dashboard(): React.ReactElement {
  const [selected, setSelected] = React.useState<string | null>('AAPL');
  const [symbols, setSymbols] = React.useState<string[]>(SYMBOLS);

  // Load symbols from JSON file
  React.useEffect(() => {
    const loadSymbols = async () => {
      try {
        const response = await fetch('/5min.json');
        const data = await response.json();
        if (data.symbols && Array.isArray(data.symbols)) {
          setSymbols(data.symbols);
          console.log(`📋 Loaded ${data.symbols.length} symbols from 5min.json`);
        }
      } catch (error) {
        console.warn('⚠️ Could not load symbols from 5min.json, using fallback:', error);
        // Use more symbols as fallback
        setSymbols(['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMD', 'GOOGL', 'META', 'AMZN', 'NFLX', 'ADBE']);
      }
    };
    loadSymbols();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 540 }}>
      <SymbolList symbols={symbols} selected={selected} onSelect={setSelected} />
      <TradingTable symbols={symbols} selectedSymbol={selected} onSymbolSelect={setSelected} />
    </div>
  );
}
