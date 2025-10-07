// BSpy Types - טיפוסים עבור BSpy Logic

export interface SPYData {
    currentPrice: number;
    previousPrice: number;
    return: number; // תשואה באחוזים
}

export interface RelativeStrengthResult {
    symbol: string;
    name: string;
    currentPrice: number;
    previousPrice: number;
    stockReturn: number; // תשואת המניה באחוזים
    spyReturn: number; // תשואת SPY באחוזים
    relativeStrength: number; // יחס החוזק
    LongSpyScore: number; // ציון LongSpy מ-0 עד 100
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
