// CAtrPrice Types - טיפוסים עבור CAtrPrice Logic

export interface VolatilityResult {
    symbol: string;
    name: string;
    currentPrice: number;
    atr: number;
    atrRatio: number; // ATR/Price %
    bbWidth: number; // Bollinger Bands Width %
    bbPosition: number; // %b position (0-1)
    LongAtrPriceScore: number; // ציון Long מ-1 עד 100 עבור CAtrPrice
    analysisDate: string;
    calculationDate: string;
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
