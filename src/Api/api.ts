// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDiDoxBzc1rZ_9Q63eGyt2GgoY5D9PNpzs",
    authDomain: "braintopai.firebaseapp.com",
    projectId: "braintopai",
    storageBucket: "braintopai.appspot.com",
    messagingSenderId: "1091362437440",
    appId: "1:1091362437440:web:1ce2b48b07a129234922a5",
    measurementId: "G-RCH8KF2HVG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
export { db };

export async function loginWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
}

// Function to get lists from top-level collection
export async function getTopLevelLists() {
    try {
        const listsCollection = collection(db, 'lists');
        const listsSnapshot = await getDocs(listsCollection);

        const lists = listsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return lists;
    } catch (error) {
        return [];
    }
}

// Function to get lists from user subcollection (for backward compatibility)
export async function getUserLists() {
    return getTopLevelLists();
}

// Function to get all lists from all users (for testing)
export async function getAllLists() {
    return getTopLevelLists();
}

// Function to get data for a specific list
export async function getListData(listId: string) {
    try {
        const listDoc = doc(db, 'lists', listId);
        const listSnapshot = await getDoc(listDoc);

        if (listSnapshot.exists()) {
            const data = listSnapshot.data();

            // Extract symbols data from the list
            const symbols = data.symbols || {};

            const stockData: any[] = [];

            Object.keys(symbols).forEach(key => {
                const symbolData = symbols[key];

                // Extract prices from the prices object
                const prices = symbolData.prices || {};

                const price1 = prices['price-1'] || null;
                const price2 = prices['price-2'] || null;
                const price3 = prices['price-3'] || null;
                const price4 = prices['price-4'] || null;
                const price5 = prices['price-5'] || null;

                stockData.push({
                    date: symbolData.date || '',
                    symbol: symbolData.symbol || key,
                    open: symbolData.open || 0,
                    market: symbolData.market || listId,
                    close: symbolData.close || 0,
                    volume: symbolData.volume || 0,
                    pattern: symbolData.pattern || '',
                    'price-1': price1,
                    'price-2': price2,
                    'price-3': price3,
                    'price-4': price4,
                    'price-5': price5,
                    result: symbolData.result || 'failure',
                    trend: symbolData.trend || 'sideways',
                    score: symbolData.score || 0,
                    position: symbolData.position || 'N',
                    chartUrl: symbolData.chartUrl || null,
                    favorite: symbolData.favorite === true // הוספתי שדה זה!
                });
            });

            return stockData;
        } else {
            return [];
        }
    } catch (error) {
        return [];
    }
}

// Function to update specific data in a list
export async function updateListData(listId: string, updates: any) {
    try {
        const listDoc = doc(db, 'lists', listId);
        const listSnapshot = await getDoc(listDoc);

        if (!listSnapshot.exists()) {
            throw new Error('List not found');
        }

        const data = listSnapshot.data();

        if (!data || !data.symbols || !Array.isArray(data.symbols)) {
            throw new Error('No symbols array found or invalid format');
        }

        // Create clean update object without undefined values
        const cleanUpdates = Object.keys(updates).reduce((acc, key) => {
            if (updates[key] !== undefined) {
                acc[key] = updates[key];
            }
            return acc;
        }, {} as any);

        // Update the document
        await updateDoc(listDoc, cleanUpdates);

    } catch (error) {
        console.error('Error updating list data:', error);
        throw error;
    }
}

// Function to delete a row from a list
export async function deleteListRow(listId: string, symbolIndex: number) {
    try {
        const listDoc = doc(db, 'lists', listId);
        const listSnapshot = await getDoc(listDoc);

        if (!listSnapshot.exists()) {
            throw new Error('List not found');
        }

        const data = listSnapshot.data();

        if (!data || !data.symbols || !Array.isArray(data.symbols)) {
            throw new Error('No symbols array found or invalid format');
        }

        const updatedSymbols = [...data.symbols]; // Create a copy of the array

        if (symbolIndex < 0 || symbolIndex >= updatedSymbols.length) {
            throw new Error('Invalid symbol index for deletion');
        }

        updatedSymbols.splice(symbolIndex, 1); // Remove the item at the given index

        await updateDoc(listDoc, { symbols: updatedSymbols }); // Update Firestore with the new array
    } catch (error) {
        console.error('Error deleting list row:', error);
        throw error;
    }
}

export async function updateFavoriteInArray(listId: string, symbolIndex: number, newValue: boolean) {
    const listDoc = doc(db, 'lists', listId);
    const listSnapshot = await getDoc(listDoc);

    if (!listSnapshot.exists()) throw new Error('List not found');
    const data = listSnapshot.data();

    if (!data || !data.symbols || !Array.isArray(data.symbols)) throw new Error('No symbols array found or invalid format');

    // עדכן את השדה במערך
    const updatedSymbols = [...data.symbols];
    updatedSymbols[symbolIndex] = {
        ...updatedSymbols[symbolIndex],
        favorite: newValue
    };

    // שלח את כל המערך המעודכן
    await updateDoc(listDoc, { symbols: updatedSymbols });
}

export async function updateResultInArray(listId: string, symbolIndex: number, newValue: 'success' | 'failure') {
    const listDoc = doc(db, 'lists', listId);
    const listSnapshot = await getDoc(listDoc);

    if (!listSnapshot.exists()) throw new Error('List not found');
    const data = listSnapshot.data();

    if (!data || !data.symbols || !Array.isArray(data.symbols)) throw new Error('No symbols array found or invalid format');

    const updatedSymbols = [...data.symbols];
    updatedSymbols[symbolIndex] = {
        ...updatedSymbols[symbolIndex],
        result: newValue
    };

    await updateDoc(listDoc, { symbols: updatedSymbols });
}

export async function deleteSymbolFromArray(listId: string, symbolIndex: number) {
    const listDoc = doc(db, 'lists', listId);
    const listSnapshot = await getDoc(listDoc);

    if (!listSnapshot.exists()) throw new Error('List not found');
    const data = listSnapshot.data();

    if (!data || !data.symbols || !Array.isArray(data.symbols)) throw new Error('No symbols array found or invalid format');

    const updatedSymbols = [...data.symbols];
    updatedSymbols.splice(symbolIndex, 1);

    await updateDoc(listDoc, { symbols: updatedSymbols });
}

// Function to get cross events list - each document is a cross event
export async function getCrossData() {
    try {
        const crossCollection = collection(db, 'cross');
        const crossSnapshot = await getDocs(crossCollection);

        const crossData = crossSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return crossData;
    } catch (error) {
        console.error('Error fetching cross data:', error);
        return [];
    }
}

// Function to get specific cross event data with all symbols
export async function getCrossEventData(crossId: string) {
    try {
        const crossDoc = doc(db, 'cross', crossId);
        const crossSnapshot = await getDoc(crossDoc);

        if (crossSnapshot.exists()) {
            const data = crossSnapshot.data();
            
            // Create symbols array from the document data
            let symbolsArray = [];
            
            // Check if data is already an array of symbols
            if (Array.isArray(data)) {
                symbolsArray = data.map((symbolData, index) => ({
                    id: symbolData.symbol || `symbol_${index}`,
                    symbol: symbolData.symbol || `Symbol_${index}`,
                    ...symbolData
                }));
            } else {
                // Check if data contains an array field with symbols
                Object.keys(data).forEach((key) => {
                    const value = data[key];
                    
                    // If this field is an array, it might contain the symbols
                    if (Array.isArray(value) && value.length > 0) {
                        // Check if the first item looks like a symbol
                        const firstItem = value[0];
                        if (firstItem && typeof firstItem === 'object' && 
                            (firstItem.symbol || firstItem.price !== undefined || firstItem.score !== undefined)) {
                            symbolsArray = value.map((symbolData, index) => ({
                                id: symbolData.symbol || `${key}_${index}`,
                                symbol: symbolData.symbol || `Symbol_${index}`,
                                ...symbolData
                            }));
                        }
                    }
                    
                    // If the value is an object and contains symbol-like data
                    else if (value && typeof value === 'object' && !Array.isArray(value)) {
                        // Check if this looks like a symbol object
                        const hasSymbolFields = 
                            value.hasOwnProperty('symbol') || 
                            value.hasOwnProperty('price') || 
                            value.hasOwnProperty('score') ||
                            value.hasOwnProperty('type') ||
                            value.hasOwnProperty('macd');
                        
                        if (hasSymbolFields) {
                            symbolsArray.push({
                                id: key,
                                symbol: value.symbol || key,
                                ...value
                            });
                        }
                    }
                });
                
                // If no symbols found through object parsing, check if the document itself is a symbol
                if (symbolsArray.length === 0) {
                    if (data.symbol || data.price !== undefined || data.score !== undefined) {
                        symbolsArray.push({
                            id: crossSnapshot.id,
                            symbol: data.symbol || crossSnapshot.id,
                            ...data
                        });
                    }
                }
            }
            
            
            return {
                id: crossSnapshot.id,
                symbolsArray: symbolsArray,
                ...data
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching cross event data:', error);
        return null;
    }
}

// Function to update symbol heart status
export async function updateSymbolHeart(crossId: string, symbolId: string, heartValue: boolean) {
    try {
        
        const crossDoc = doc(db, 'cross', crossId);
        const crossSnapshot = await getDoc(crossDoc);
        
        if (!crossSnapshot.exists()) {
            throw new Error('Cross event not found');
        }
        
        const data = crossSnapshot.data();
        let updatedData = { ...data };
        let symbolFound = false;
        
        // Check if data is an array of symbols
        if (Array.isArray(data)) {
            updatedData = data.map((symbolData, index) => {
                if (symbolData.symbol === symbolId || symbolData.id === symbolId || index.toString() === symbolId) {
                    symbolFound = true;
                    return { ...symbolData, heart: heartValue };
                }
                return symbolData;
            });
        } else {
            // Check if data contains an array field with symbols
            Object.keys(data).forEach((key) => {
                const value = data[key];
                
                // If this field is an array, it might contain the symbols
                if (Array.isArray(value) && value.length > 0) {
                    const firstItem = value[0];
                    if (firstItem && typeof firstItem === 'object' && 
                        (firstItem.symbol || firstItem.price !== undefined || firstItem.score !== undefined)) {
                        
                        // Update the symbol in this array
                        updatedData[key] = value.map((symbolData, index) => {
                            if (symbolData.symbol === symbolId || symbolData.id === symbolId || index.toString() === symbolId) {
                                symbolFound = true;
                                return { ...symbolData, heart: heartValue };
                            }
                            return symbolData;
                        });
                    }
                }
                
                // If the value is an object and matches our symbol
                else if (value && typeof value === 'object' && !Array.isArray(value)) {
                    if (key === symbolId || value.symbol === symbolId || value.id === symbolId) {
                        symbolFound = true;
                        updatedData[key] = { ...value, heart: heartValue };
                    }
                }
            });
            
            // If the document itself is a symbol
            if (!symbolFound && (data.symbol === symbolId || data.id === symbolId)) {
                symbolFound = true;
                updatedData = { ...data, heart: heartValue };
            }
        }
        
        if (!symbolFound) {
            throw new Error(`Symbol ${symbolId} not found in cross event ${crossId}`);
        }
        
        // Update the document
        await updateDoc(crossDoc, updatedData);
        
        return true;
    } catch (error) {
        console.error('Error updating symbol heart:', error);
        throw error;
    }
}

