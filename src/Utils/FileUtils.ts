/**
 * Utility functions for file operations
 */

export class FileUtils {
    /**
     * Download data as JSON file
     */
    static downloadAsJson(data: any, filename: string): void {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log(`✅ Downloaded ${filename}`);
        } catch (error) {
            console.error(`❌ Error downloading ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Save data to local file (for development/testing)
     * Note: This only works in Node.js environment, not in browser
     */
    static async saveToLocalFile(data: any, filePath: string): Promise<void> {
        try {
            // This is a placeholder - in a real browser environment,
            // we would need to use a different approach
            console.log(`📁 Would save data to: ${filePath}`);
            console.log(`📊 Data size: ${JSON.stringify(data).length} characters`);
            
            // For now, we'll just log the data structure
            console.log('📋 Data structure:', Object.keys(data));
            
            // In a real implementation, you might want to:
            // 1. Use a file picker API
            // 2. Send data to a backend server
            // 3. Use IndexedDB for local storage
            // 4. Use a file system API if available
            
        } catch (error) {
            console.error(`❌ Error saving to local file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Format data for display
     */
    static formatDataForDisplay(data: any): string {
        try {
            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('❌ Error formatting data:', error);
            return 'Error formatting data';
        }
    }

    /**
     * Get file size in human readable format
     */
    static getFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
