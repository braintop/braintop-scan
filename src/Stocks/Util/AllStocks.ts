import { CRYPTO_STOCKS } from './CRYPTO_STOCKS';
import { NASDAQ_STOCKS } from './NASDAQ_STOCKS';
import { NYSE_STOCKS } from './NYSE_STOCKS';
import { SP500_STOCKS } from './SP500_STOCKS';
import { Etf_STOCKS } from './Etf_Stock';
export const getAllStocks = () => {
    const allStocks = [
        ...NASDAQ_STOCKS.map(stock => ({ symbol: stock, market: 'NASDAQ' })),
        ...NYSE_STOCKS.map(stock => ({ symbol: stock, market: 'NYSE' })),
        ...CRYPTO_STOCKS.map(stock => ({ symbol: stock, market: 'CRYPTO' })),
        ...SP500_STOCKS.map(stock => ({ symbol: stock, market: 'SP500' })),
        ...Etf_STOCKS.map(stock => ({ symbol: stock, market: 'ETF' }))
    ];

    return allStocks;
};