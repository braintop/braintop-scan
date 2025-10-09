// Firebase Service - שימוש ב-FirebaseService הקיים
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  Timestamp
} from 'firebase/firestore';

const db = getFirestore();

export class FirebaseService {
  // Save weekly scan data
  static async saveWeeklyScan(date: string, data: any) {
    try {
      const collectionName = `weekly_scan_${date.replace(/-/g, '_')}`;
      const docRef = doc(collection(db, collectionName));
      await setDoc(docRef, {
        ...data,
        timestamp: Timestamp.now()
      });
      console.log(`Weekly scan saved: ${collectionName}`);
    } catch (error) {
      console.error('Error saving weekly scan:', error);
      throw error;
    }
  }

  // Save daily scan data
  static async saveDailyScan(date: string, data: any) {
    try {
      const collectionName = `daily_scan_${date.replace(/-/g, '_')}`;
      const docRef = doc(collection(db, collectionName));
      
      // Remove undefined values before saving
      const cleanData = JSON.parse(JSON.stringify(data, (key, value) => 
        value === undefined ? null : value
      ));
      
      await setDoc(docRef, {
        ...cleanData,
        timestamp: Timestamp.now()
      });
      console.log(`Daily scan saved: ${collectionName}`);
    } catch (error) {
      console.error('Error saving daily scan:', error);
      throw error;
    }
  }

  // Save premarket scan data
  static async savePremarketScan(date: string, data: any) {
    try {
      const collectionName = `premarket_scan_${date.replace(/-/g, '_')}`;
      const docRef = doc(collection(db, collectionName));
      await setDoc(docRef, {
        ...data,
        timestamp: Timestamp.now()
      });
      console.log(`Premarket scan saved: ${collectionName}`);
    } catch (error) {
      console.error('Error saving premarket scan:', error);
      throw error;
    }
  }

  // Save scout entries
  static async saveScoutEntries(date: string, data: any) {
    try {
      const collectionName = `scout_entries_${date.replace(/-/g, '_')}`;
      const docRef = doc(collection(db, collectionName));
      await setDoc(docRef, {
        ...data,
        timestamp: Timestamp.now()
      });
      console.log(`Scout entries saved: ${collectionName}`);
    } catch (error) {
      console.error('Error saving scout entries:', error);
      throw error;
    }
  }

  // Save reinforcement data
  static async saveReinforcement(date: string, data: any) {
    try {
      const collectionName = `reinforcement_${date.replace(/-/g, '_')}`;
      const docRef = doc(collection(db, collectionName));
      await setDoc(docRef, {
        ...data,
        timestamp: Timestamp.now()
      });
      console.log(`Reinforcement saved: ${collectionName}`);
    } catch (error) {
      console.error('Error saving reinforcement:', error);
      throw error;
    }
  }

  // Save end of day results
  static async saveEndOfDay(date: string, data: any) {
    try {
      const collectionName = `end_of_day_${date.replace(/-/g, '_')}`;
      const docRef = doc(collection(db, collectionName));
      await setDoc(docRef, {
        ...data,
        timestamp: Timestamp.now()
      });
      console.log(`End of day saved: ${collectionName}`);
    } catch (error) {
      console.error('Error saving end of day:', error);
      throw error;
    }
  }

  // Load scan data
  static async loadScanData(collectionName: string) {
    try {
      const docRef = doc(db, collectionName, 'data');
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error(`Error loading scan data: ${collectionName}`, error);
      return null;
    }
  }

  // Load all scans for a date
  static async loadAllScansForDate(date: string) {
    try {
      const dateStr = date.replace(/-/g, '_');
      const collections = [
        `weekly_scan_${dateStr}`,
        `daily_scan_${dateStr}`,
        `premarket_scan_${dateStr}`,
        `scout_entries_${dateStr}`,
        `reinforcement_${dateStr}`,
        `end_of_day_${dateStr}`
      ];

      const results: any = {};
      for (const collectionName of collections) {
        try {
          const data = await this.loadScanData(collectionName);
          if (data) {
            results[collectionName] = data;
          }
        } catch (error) {
          console.log(`Collection ${collectionName} not found`);
        }
      }

      return results;
    } catch (error) {
      console.error('Error loading all scans:', error);
      return null;
    }
  }

  // Update existing document
  static async updateScanData(collectionName: string, data: any) {
    try {
      const docRef = doc(db, collectionName, 'data');
      await setDoc(docRef, {
        ...data,
        timestamp: Timestamp.now()
      });
      console.log(`Scan data updated: ${collectionName}`);
    } catch (error) {
      console.error('Error updating scan data:', error);
      throw error;
    }
  }
}
