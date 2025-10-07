// DSignals Types - טיפוסים עבור DSignals Logic

export interface MomentumResult {
    symbol: string;
    name: string;
    currentPrice: number;
    sma3Current: number;
    sma3Previous: number;
    sma12Current: number;
    sma12Previous: number;
    crossoverType: 'Bullish' | 'Bearish' | 'None';
    macdHistogram: number;
    LongMomentumScore: number; // ציון Long מ-1 עד 100 עבור DSignals
    analysisDate: string;
    calculationDate: string;
}

export interface FavoriteStock {
    candleDate: string;
    scanDate: string;
    symbol: string;
    name: string;
    price: number;
    market: string;
    volume: number;
    dollarVolume: number;
    float: number;
    spread: number;
    passed: boolean;
    marketCap?: number;
    avgVolume20?: number;
}

export interface OHLCData {
    date: string;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjusted_close?: number;
}

export interface LocalStockData {
    metadata: {
        created: string;
        startDate: string;
        endDate: string;
        totalRecords: number;
        symbols: string[];
    };
    data: OHLCData[];
}

export interface MACDData {
    macd: number[];
    signal: number[];
    histogram: number[];
}
