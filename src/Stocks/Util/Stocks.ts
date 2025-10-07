import { CRYPTO_STOCKS } from './CRYPTO_STOCKS';
import { NASDAQ_STOCKS } from './NASDAQ_STOCKS';
import { NYSE_STOCKS } from './NYSE_STOCKS';
import { SP500_STOCKS } from './SP500_STOCKS';
import { Etf_STOCKS } from './Etf_Stock';

export const getSymbolsArray = (market: string) => {
    switch (market) {
        case 'NASDAQ':
            return NASDAQ_STOCKS;
        case 'NYSE':
            return NYSE_STOCKS;
        case 'CRYPTO':
            return CRYPTO_STOCKS;
        case 'SP500':
            return SP500_STOCKS;
        case 'ETF':
            return Etf_STOCKS;
        default:
            return [];
    }
};

export const getAllStocks = () => {
    // Create a Map to track unique symbols and their first occurrence market
    const uniqueStocks = new Map();

    // Process each market's stocks in order of priority
    NASDAQ_STOCKS.forEach(stock => {
        if (!uniqueStocks.has(stock)) {
            uniqueStocks.set(stock, 'NASDAQ');
        }
    });

    NYSE_STOCKS.forEach(stock => {
        if (!uniqueStocks.has(stock)) {
            uniqueStocks.set(stock, 'NYSE');
        }
    });

    SP500_STOCKS.forEach(stock => {
        if (!uniqueStocks.has(stock)) {
            uniqueStocks.set(stock, 'SP500');
        }
    });

    CRYPTO_STOCKS.forEach(stock => {
        if (!uniqueStocks.has(stock)) {
            uniqueStocks.set(stock, 'CRYPTO');
        }
    });

    // Convert Map back to array of objects
    return Array.from(uniqueStocks).map(([symbol, market]) => ({
        symbol,
        market
    }));
};
