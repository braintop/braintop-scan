// EAdx Types - טיפוסים עבור EAdx Logic

export interface TrendResult {
    symbol: string;
    name: string;
    currentPrice: number;
    adxValue: number;
    LongAdxScore: number; // ציון Long מ-1 עד 100 עבור EAdx
    trendStrength: 'No Trend' | 'Weak Trend' | 'Strong Trend' | 'Very Strong' | 'Extreme';
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
