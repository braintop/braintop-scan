// Time Utils - פונקציות זמן
export class TimeUtils {
  // Get current Israeli time
  static getCurrentIsraeliTime(): Date {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
  }

  // Check if market is open (Israeli time)
  static isMarketOpen(): boolean {
    const now = this.getCurrentIsraeliTime();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Market hours: 16:30 - 23:00 IL
    const openTime = 16 * 60 + 30; // 16:30
    const closeTime = 23 * 60; // 23:00
    
    return currentTime >= openTime && currentTime < closeTime;
  }

  // Check if it's premarket time (Israeli time)
  static isPremarketTime(): boolean {
    const now = this.getCurrentIsraeliTime();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Premarket hours: 16:00 - 16:30 IL
    const premarketStart = 16 * 60; // 16:00
    const premarketEnd = 16 * 60 + 30; // 16:30
    
    return currentTime >= premarketStart && currentTime < premarketEnd;
  }

  // Check if it's scout time (Israeli time)
  static isScoutTime(): boolean {
    const now = this.getCurrentIsraeliTime();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Scout time: 16:20 - 17:00 IL
    const scoutStart = 16 * 60 + 20; // 16:20
    const scoutEnd = 17 * 60; // 17:00
    
    return currentTime >= scoutStart && currentTime < scoutEnd;
  }

  // Check if it's reinforcement time (Israeli time)
  static isReinforcementTime(): boolean {
    const now = this.getCurrentIsraeliTime();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Reinforcement time: 17:00 - 17:30 IL
    const reinforcementStart = 17 * 60; // 17:00
    const reinforcementEnd = 17 * 60 + 30; // 17:30
    
    return currentTime >= reinforcementStart && currentTime < reinforcementEnd;
  }

  // Get time until next 5-minute candle
  static getTimeToNext5Minute(): { minutes: number; seconds: number; totalSeconds: number } {
    const now = this.getCurrentIsraeliTime();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    // Find next 5-minute mark
    const next5Minute = Math.ceil(currentMinute / 5) * 5;
    const nextTime = new Date(now);
    
    if (next5Minute >= 60) {
      nextTime.setHours(nextTime.getHours() + 1);
      nextTime.setMinutes(0);
    } else {
      nextTime.setMinutes(next5Minute);
    }
    nextTime.setSeconds(0);
    nextTime.setMilliseconds(0);
    
    const diffMs = nextTime.getTime() - now.getTime();
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return { minutes, seconds, totalSeconds };
  }

  // Format date for Firebase collection names
  static formatDateForFirebase(date: Date = new Date()): string {
    return date.toISOString().split('T')[0].replace(/-/g, '_');
  }

  // Format time for display
  static formatTimeForDisplay(date: Date = new Date()): string {
    return date.toLocaleTimeString('he-IL', { 
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // Get current scan type based on time
  static getCurrentScanType(): 'weekly' | 'daily' | 'premarket' | 'scout' | 'reinforcement' | 'end_of_day' {
    const now = this.getCurrentIsraeliTime();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Sunday 09:00 - Weekly scan
    if (dayOfWeek === 0 && hour === 9) {
      return 'weekly';
    }
    
    // Daily 09:00 - Daily scan
    if (hour === 9) {
      return 'daily';
    }
    
    // 16:15 - Premarket scan
    if (currentTime >= 16 * 60 + 15 && currentTime < 16 * 60 + 20) {
      return 'premarket';
    }
    
    // 16:20-17:00 - Scout
    if (currentTime >= 16 * 60 + 20 && currentTime < 17 * 60) {
      return 'scout';
    }
    
    // 17:00-17:30 - Reinforcement
    if (currentTime >= 17 * 60 && currentTime < 17 * 60 + 30) {
      return 'reinforcement';
    }
    
    // 23:00+ - End of day
    if (currentTime >= 23 * 60) {
      return 'end_of_day';
    }
    
    return 'daily';
  }

  // Check if it's time for specific scan
  static isTimeForScan(scanType: string): boolean {
    const currentScanType = this.getCurrentScanType();
    return currentScanType === scanType;
  }

  // Get next scan time
  static getNextScanTime(): { scanType: string; time: Date } {
    const now = this.getCurrentIsraeliTime();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Next scan times
    if (dayOfWeek === 0 && hour < 9) {
      // Next Sunday 09:00
      const nextTime = new Date(now);
      nextTime.setHours(9, 0, 0, 0);
      return { scanType: 'weekly', time: nextTime };
    }
    
    if (hour < 9) {
      // Today 09:00
      const nextTime = new Date(now);
      nextTime.setHours(9, 0, 0, 0);
      return { scanType: 'daily', time: nextTime };
    }
    
    if (hour < 16 || (hour === 16 && minute < 15)) {
      // Today 16:15
      const nextTime = new Date(now);
      nextTime.setHours(16, 15, 0, 0);
      return { scanType: 'premarket', time: nextTime };
    }
    
    // Tomorrow 09:00
    const nextTime = new Date(now);
    nextTime.setDate(nextTime.getDate() + 1);
    nextTime.setHours(9, 0, 0, 0);
    return { scanType: 'daily', time: nextTime };
  }
}
