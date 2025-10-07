import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    // updateDoc,
    // addDoc,
    query,
    where,
    getDocs,
    Timestamp,
    deleteDoc
} from 'firebase/firestore';

const db = getFirestore();

export interface FirebaseAnalysisResult {
    date: string;
    frequency: string;
    step: string;
    results: any[];
    timestamp: Timestamp;
    totalStocks: number;
    averageScore?: number;
}

export class FirebaseService {
    static async saveAnalysisResults(
        date: string, 
        step: string, 
        results: any[], 
        frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<void> {
        try {
            console.log(`💾 Saving ${step} results for ${date} (${frequency})`);
            
            const docId = `${date}_${step}_${frequency}`;
            const collectionName = this.getCollectionName(frequency);
            
            const data: FirebaseAnalysisResult = {
                date,
                frequency,
                step,
                results,
                timestamp: Timestamp.now(),
                totalStocks: results.length,
                averageScore: this.calculateAverageScore(results)
            };

            await setDoc(doc(db, collectionName, docId), data);
            console.log(`✅ Saved ${step} results: ${results.length} stocks`);
            
        } catch (error) {
            console.error(`❌ Error saving ${step} results:`, error);
            throw error;
        }
    }

    static async getAnalysisResults(
        date: string, 
        step: string, 
        frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<any[]> {
        try {
            const docId = `${date}_${step}_${frequency}`;
            const collectionName = this.getCollectionName(frequency);
            
            const docRef = doc(db, collectionName, docId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data() as FirebaseAnalysisResult;
                return data.results;
            } else {
                console.warn(`No results found for ${date}_${step}_${frequency}`);
                return [];
            }
            
        } catch (error) {
            console.error(`❌ Error getting ${step} results:`, error);
            throw error;
        }
    }

    static async saveFinalResults(
        date: string, 
        results: any[], 
        frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<void> {
        try {
            console.log(`💾 Saving final results for ${date} (${frequency})`);
            
            const docId = `${date}_final_${frequency}`;
            const collectionName = this.getCollectionName(frequency);
            
            const data = {
                date,
                frequency,
                step: 'final',
                results,
                timestamp: Timestamp.now(),
                totalStocks: results.length,
                averageScore: this.calculateAverageScore(results),
                analysisCompleted: true
            };

            await setDoc(doc(db, collectionName, docId), data);
            console.log(`✅ Saved final results: ${results.length} stocks`);
            
        } catch (error) {
            console.error(`❌ Error saving final results:`, error);
            throw error;
        }
    }

    static async updateRelativeStrength(
        date: string, 
        results: any[], 
        frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<void> {
        try {
            console.log(`💾 Updating relative-strength for ${date} (${frequency})`);
            
            // const docId = `${date}_relative_strength`;
            
            // Update each stock result
            for (const stock of results) {
                const stockDocId = `${date}_${stock.symbol}_relative_strength`;
                
                const stockData = {
                    ...stock,
                    analysisDate: date,
                    frequency,
                    lastUpdated: Timestamp.now()
                };

                await setDoc(doc(db, 'relative-strength', stockDocId), stockData);
            }
            
            console.log(`✅ Updated relative-strength: ${results.length} stocks`);
            
        } catch (error) {
            console.error(`❌ Error updating relative-strength:`, error);
            throw error;
        }
    }

    static async addFuturePrices(
        date: string, 
        symbol: string, 
        prices: { [key: string]: any }, 
        frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<void> {
        try {
            console.log(`💾 Adding future prices for ${symbol} on ${date}`);
            
            const docId = `${date}_${symbol}_prices`;
            
            const priceData = {
                symbol,
                date,
                frequency,
                prices,
                timestamp: Timestamp.now()
            };

            await setDoc(doc(db, 'future-prices', docId), priceData);
            console.log(`✅ Added future prices for ${symbol}`);
            
        } catch (error) {
            console.error(`❌ Error adding future prices:`, error);
            throw error;
        }
    }

    static async getAnalysisHistory(
        frequency: 'daily' | 'weekly' | 'monthly',
        limit: number = 10
    ): Promise<FirebaseAnalysisResult[]> {
        try {
            const collectionName = this.getCollectionName(frequency);
            const q = query(
                collection(db, collectionName),
                where('step', '==', 'final')
            );
            
            const querySnapshot = await getDocs(q);
            const results: FirebaseAnalysisResult[] = [];
            
            querySnapshot.forEach((doc) => {
                results.push(doc.data() as FirebaseAnalysisResult);
            });
            
            // Sort by date descending and limit
            return results
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, limit);
                
        } catch (error) {
            console.error(`❌ Error getting analysis history:`, error);
            throw error;
        }
    }

    static async deleteAnalysisResults(
        date: string, 
        frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<void> {
        try {
            console.log(`🗑️ Deleting analysis results for ${date} (${frequency})`);
            
            const collectionName = this.getCollectionName(frequency);
            const steps = ['ascan', 'bspy', 'catrprice', 'dsignals', 'eadx', 'final'];
            
            for (const step of steps) {
                const docId = `${date}_${step}_${frequency}`;
                const docRef = doc(db, collectionName, docId);
                await setDoc(docRef, {}, { merge: false }); // This will delete the document
            }
            
            console.log(`✅ Deleted analysis results for ${date}`);
            
        } catch (error) {
            console.error(`❌ Error deleting analysis results:`, error);
            throw error;
        }
    }

    private static getCollectionName(frequency: 'daily' | 'weekly' | 'monthly'): string {
        switch (frequency) {
            case 'daily':
                return 'analysis-daily';
            case 'weekly':
                return 'analysis-weekly';
            case 'monthly':
                return 'analysis-monthly';
            default:
                return 'analysis-daily';
        }
    }

    private static calculateAverageScore(results: any[]): number {
        if (results.length === 0) return 0;
        
        const total = results.reduce((sum, result) => {
            return sum + (result.finalScore || 0);
        }, 0);
        
        return Math.round(total / results.length);
    }

    // Helper method to get all analysis steps for a specific date
    static async getAllStepsForDate(
        date: string, 
        frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<{ [step: string]: any[] }> {
        try {
            const steps = ['ascan', 'bspy', 'catrprice', 'dsignals', 'eadx', 'final'];
            const results: { [step: string]: any[] } = {};
            
            for (const step of steps) {
                results[step] = await this.getAnalysisResults(date, step, frequency);
            }
            
            return results;
            
        } catch (error) {
            console.error(`❌ Error getting all steps for date:`, error);
            throw error;
        }
    }

    // Get favorite stocks from Firebase
    static async getFavoriteStocks(): Promise<any[]> {
        try {
            console.log(`📊 Getting favorite stocks from Firebase...`);
            
            const querySnapshot = await getDocs(collection(db, 'favorite'));
            let stocksData: any[] = [];
            
            querySnapshot.forEach((doc) => {
                if (doc.id === 'my-favorites') {
                    const data = doc.data();
                    if (data.stocks && Array.isArray(data.stocks)) {
                        stocksData = data.stocks;
                    }
                }
            });
            
            console.log(`✅ Found ${stocksData.length} favorite stocks`);
            return stocksData;
            
        } catch (error) {
            console.error(`❌ Error getting favorite stocks:`, error);
            throw error;
        }
    }

    // Get relative strength data for a specific date
    static async getRelativeStrengthData(date: string): Promise<any | null> {
        try {
            console.log(`📊 Getting relative strength data for ${date}...`);
            
            // const docId = `${date}_relative_strength`;
            const docRef = doc(db, 'relative-strength', `${date}_relative_strength`);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log(`✅ Found relative strength data for ${date}`);
                return data;
            } else {
                console.warn(`❌ No relative strength data found for ${date}`);
                return null;
            }
            
        } catch (error) {
            console.error(`❌ Error getting relative strength data for ${date}:`, error);
            throw error;
        }
    }

    // Get multiple relative strength data for comparison
    static async getMultipleRelativeStrengthData(dates: string[]): Promise<{[date: string]: any}> {
        try {
            console.log(`📊 Getting relative strength data for multiple dates: ${dates.join(', ')}...`);
            
            const results: {[date: string]: any} = {};
            
            for (const date of dates) {
                const data = await this.getRelativeStrengthData(date);
                if (data) {
                    results[date] = data;
                }
            }
            
            console.log(`✅ Retrieved data for ${Object.keys(results).length} dates`);
            return results;
            
        } catch (error) {
            console.error(`❌ Error getting multiple relative strength data:`, error);
            throw error;
        }
    }

    // Delete all documents for a specific date (both old and new formats)
    static async deleteDateData(date: string): Promise<void> {
        try {
            console.log(`🗑️ Deleting all data for date: ${date}`);
            
            // Get all documents in the relative-strength collection
            const collectionRef = collection(db, 'relative-strength');
            const snapshot = await getDocs(collectionRef);
            
            const documentsToDelete: string[] = [];
            
            snapshot.forEach((doc) => {
                const docId = doc.id;
                
                // Check if document is for the specified date
                if (docId.startsWith(`${date}_`)) {
                    documentsToDelete.push(docId);
                }
            });
            
            console.log(`📋 Found ${documentsToDelete.length} documents to delete for ${date}`);
            
            // Delete all matching documents
            const deletePromises = documentsToDelete.map(async (docId) => {
                try {
                    await deleteDoc(doc(db, 'relative-strength', docId));
                    console.log(`✅ Deleted: ${docId}`);
                } catch (error) {
                    console.error(`❌ Error deleting ${docId}:`, error);
                }
            });
            
            await Promise.all(deletePromises);
            
            console.log(`🎉 Successfully deleted ${documentsToDelete.length} documents for ${date}`);
            
        } catch (error) {
            console.error(`❌ Error deleting date data for ${date}:`, error);
            throw error;
        }
    }
}
