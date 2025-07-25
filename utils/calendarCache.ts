interface CalendarMonthData {
  dates: (number | null)[];
  year: number;
  month: number;
  monthDate: Date;
  daysInMonth: number;
  rowsNeeded: number;
}

class CalendarCache {
  private cache: Map<string, CalendarMonthData[]> = new Map();

  private generateMonthData(year: number, month: number): CalendarMonthData {
    // Get first day of month and how many days in month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Create array of dates for the calendar grid
    const dates: (number | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let j = 0; j < startingDayOfWeek; j++) {
      dates.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(day);
    }
    
    // Calculate how many rows this month needs
    const totalCells = dates.length;
    const rowsNeeded = Math.ceil(totalCells / 7);
    
    return {
      dates,
      year,
      month,
      monthDate: new Date(year, month, 1),
      daysInMonth,
      rowsNeeded
    };
  }

  public preloadCalendarData(currentDate: Date, startOffset: number = -2, endOffset: number = 3): void {
    const cacheKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    
    if (this.cache.has(cacheKey)) {
      return; // Already cached
    }

    const months: CalendarMonthData[] = [];
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + startOffset, 1);
    
    // Generate months based on range
    const totalMonths = endOffset - startOffset;
    for (let i = 0; i < totalMonths; i++) {
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthData = this.generateMonthData(monthDate.getFullYear(), monthDate.getMonth());
      months.push(monthData);
    }
    
    this.cache.set(cacheKey, months);
  }

  public getCachedCalendarData(currentDate: Date): CalendarMonthData[] | null {
    const cacheKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    return this.cache.get(cacheKey) || null;
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const calendarCache = new CalendarCache();
export type { CalendarMonthData };