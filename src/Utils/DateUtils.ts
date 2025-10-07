export class DateUtils {
    /**
     * Get all trading days between two dates (excluding weekends)
     */
    static getTradingDaysBetween(startDate: string, endDate: string): string[] {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const tradingDays: string[] = [];
        
        const current = new Date(start);
        
        while (current <= end) {
            // Skip weekends (Saturday = 6, Sunday = 0)
            if (current.getDay() !== 0 && current.getDay() !== 6) {
                tradingDays.push(current.toISOString().split('T')[0]);
            }
            current.setDate(current.getDate() + 1);
        }
        
        return tradingDays;
    }

    /**
     * Get the next 5 trading days from a given date
     */
    static getNext5TradingDays(baseDate: string): string[] {
        const base = new Date(baseDate);
        const tradingDays: string[] = [];
        let current = new Date(base);
        
        while (tradingDays.length < 5) {
            current.setDate(current.getDate() + 1);
            
            // Skip weekends
            if (current.getDay() !== 0 && current.getDay() !== 6) {
                tradingDays.push(current.toISOString().split('T')[0]);
            }
        }
        
        return tradingDays;
    }

    /**
     * Get the previous N trading days from a given date
     */
    static getPreviousNTradingDays(baseDate: string, count: number): string[] {
        const base = new Date(baseDate);
        const tradingDays: string[] = [];
        let current = new Date(base);
        
        while (tradingDays.length < count) {
            current.setDate(current.getDate() - 1);
            
            // Skip weekends
            if (current.getDay() !== 0 && current.getDay() !== 6) {
                tradingDays.unshift(current.toISOString().split('T')[0]);
            }
        }
        
        return tradingDays;
    }

    /**
     * Check if a date is a trading day (not weekend)
     */
    static isTradingDay(date: string): boolean {
        const d = new Date(date);
        return d.getDay() !== 0 && d.getDay() !== 6;
    }

    /**
     * Get the next trading day from a given date
     */
    static getNextTradingDay(baseDate: string): string {
        const base = new Date(baseDate);
        let current = new Date(base);
        
        do {
            current.setDate(current.getDate() + 1);
        } while (current.getDay() === 0 || current.getDay() === 6);
        
        return current.toISOString().split('T')[0];
    }

    /**
     * Get the previous trading day from a given date
     */
    static getPreviousTradingDay(baseDate: string): string {
        const base = new Date(baseDate);
        let current = new Date(base);
        
        do {
            current.setDate(current.getDate() - 1);
        } while (current.getDay() === 0 || current.getDay() === 6);
        
        return current.toISOString().split('T')[0];
    }

    /**
     * Format date for display (DD.MM.YYYY)
     */
    static formatDateForDisplay(date: string): string {
        const d = new Date(date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Format date for Firebase (YYYY-MM-DD)
     */
    static formatDateForFirebase(date: string): string {
        return new Date(date).toISOString().split('T')[0];
    }

    /**
     * Get today's date in YYYY-MM-DD format
     */
    static getToday(): string {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Get date N days ago
     */
    static getDaysAgo(days: number): string {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
    }

    /**
     * Get date N days from now
     */
    static getDaysFromNow(days: number): string {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    /**
     * Get the start of the week (Monday) for a given date
     */
    static getStartOfWeek(date: string): string {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        d.setDate(diff);
        return d.toISOString().split('T')[0];
    }

    /**
     * Get the end of the week (Friday) for a given date
     */
    static getEndOfWeek(date: string): string {
        const startOfWeek = this.getStartOfWeek(date);
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + 4); // Friday is 4 days after Monday
        return d.toISOString().split('T')[0];
    }

    /**
     * Get the start of the month for a given date
     */
    static getStartOfMonth(date: string): string {
        const d = new Date(date);
        d.setDate(1);
        return d.toISOString().split('T')[0];
    }

    /**
     * Get the end of the month for a given date
     */
    static getEndOfMonth(date: string): string {
        const d = new Date(date);
        d.setMonth(d.getMonth() + 1, 0); // Last day of current month
        return d.toISOString().split('T')[0];
    }

    /**
     * Get trading days for a specific frequency
     */
    static getTradingDaysForFrequency(
        startDate: string, 
        endDate: string, 
        frequency: 'daily' | 'weekly' | 'monthly'
    ): string[] {
        switch (frequency) {
            case 'daily':
                return this.getTradingDaysBetween(startDate, endDate);
            
            case 'weekly':
                return this.getWeeklyTradingDays(startDate, endDate);
            
            case 'monthly':
                return this.getMonthlyTradingDays(startDate, endDate);
            
            default:
                return this.getTradingDaysBetween(startDate, endDate);
        }
    }

    /**
     * Get weekly trading days (end of each week)
     */
    private static getWeeklyTradingDays(startDate: string, endDate: string): string[] {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const weeklyDays: string[] = [];
        
        let current = new Date(start);
        
        while (current <= end) {
            const endOfWeek = this.getEndOfWeek(current.toISOString().split('T')[0]);
            if (new Date(endOfWeek) <= end) {
                weeklyDays.push(endOfWeek);
            }
            current.setDate(current.getDate() + 7); // Move to next week
        }
        
        return weeklyDays;
    }

    /**
     * Get monthly trading days (end of each month)
     */
    private static getMonthlyTradingDays(startDate: string, endDate: string): string[] {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const monthlyDays: string[] = [];
        
        let current = new Date(start);
        
        while (current <= end) {
            const endOfMonth = this.getEndOfMonth(current.toISOString().split('T')[0]);
            if (new Date(endOfMonth) <= end) {
                monthlyDays.push(endOfMonth);
            }
            current.setMonth(current.getMonth() + 1); // Move to next month
        }
        
        return monthlyDays;
    }

    /**
     * Validate date format (YYYY-MM-DD)
     */
    static isValidDate(date: string): boolean {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(date)) return false;
        
        const d = new Date(date);
        return d.toISOString().split('T')[0] === date;
    }

    /**
     * Compare two dates
     */
    static compareDates(date1: string, date2: string): number {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getTime() - d2.getTime();
    }
}
