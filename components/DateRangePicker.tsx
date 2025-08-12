import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date | null;
  onDateChange: (startDate: Date, endDate: Date | null) => void;
  minimumDate?: Date;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isStartDate: boolean;
  isEndDate: boolean;
}

export default function DateRangePicker({ 
  startDate, 
  endDate, 
  onDateChange, 
  minimumDate 
}: DateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(startDate));
  const [firstPick, setFirstPick] = useState<Date | null>(null);
  const [secondPick, setSecondPick] = useState<Date | null>(null);
  
  // Initialize with today's date on first render
  useEffect(() => {
    const today = new Date();
    if (!firstPick && !secondPick && isSameDay(startDate, today) && !endDate) {
      // Set today as both start and end date initially
      setFirstPick(today);
      setSecondPick(today);
      onDateChange(today, today);
    }
  }, []);

  const getDaysInMonth = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Get first day of month and how many days in month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get day of week for first day (0 = Sunday)
    const startDayOfWeek = firstDay.getDay();
    
    const days: CalendarDay[] = [];
    
    // Add empty days for previous month
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonth.getDate() - i);
      const isStartSelected = isSameDay(prevDate, startDate);
      const isEndSelected = endDate && isSameDay(prevDate, endDate);
      const isInRange = endDate && prevDate > startDate && prevDate < endDate;
      
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: isStartSelected || isEndSelected,
        isInRange: isInRange,
        isStartDate: isStartSelected,
        isEndDate: isEndSelected,
      });
    }
    
    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const isToday = isSameDay(currentDate, new Date());
      const isStartSelected = isSameDay(currentDate, startDate);
      const isEndSelected = endDate && isSameDay(currentDate, endDate);
      const isInRange = endDate && currentDate > startDate && currentDate < endDate;
      
      days.push({
        date: currentDate,
        isCurrentMonth: true,
        isToday,
        isSelected: isStartSelected || isEndSelected,
        isInRange: isInRange,
        isStartDate: isStartSelected,
        isEndDate: isEndSelected,
      });
    }
    
    // Add days for next month to fill the grid
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextMonthDay = 1;
    for (let i = days.length; i < totalCells; i++) {
      const nextDate = new Date(year, month + 1, nextMonthDay);
      const isStartSelected = isSameDay(nextDate, startDate);
      const isEndSelected = endDate && isSameDay(nextDate, endDate);
      const isInRange = endDate && nextDate > startDate && nextDate < endDate;
      
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday: false,
        isSelected: isStartSelected || isEndSelected,
        isInRange: isInRange,
        isStartDate: isStartSelected,
        isEndDate: isEndSelected,
      });
      nextMonthDay++;
    }
    
    return days;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isDateDisabled = (date: Date): boolean => {
    if (!minimumDate) return false;
    return date < minimumDate;
  };

  const handleDatePress = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (!firstPick) {
      // First date selection
      setFirstPick(date);
      onDateChange(date, null);
    } else if (!secondPick) {
      // Second date selection
      if (isSameDay(date, firstPick)) {
        // Don't allow same date - just ignore the click
        return;
      }
      
      setSecondPick(date);
      
      // Sort dates to ensure start <= end regardless of pick order
      const sortedDates = [firstPick, date].sort((a, b) => a.getTime() - b.getTime());
      onDateChange(sortedDates[0], sortedDates[1]);
    } else {
      // Already have both dates, start over
      // Special case: if both picks are the same (like today), clicking that same date should start fresh
      if (isSameDay(firstPick, secondPick) && isSameDay(date, firstPick)) {
        // Clicking on today when today is selected as both start/end - start fresh
        setFirstPick(date);
        setSecondPick(null);
        onDateChange(date, null);
      } else {
        // Normal start over
        setFirstPick(date);
        setSecondPick(null);
        onDateChange(date, null);
      }
    }
  };

  const clearDateRange = () => {
    setFirstPick(null);
    setSecondPick(null);
    onDateChange(startDate, null);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatDateRange = (): string => {
    if (!endDate) {
      return startDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  const days = getDaysInMonth(currentMonth);
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Helper function to determine if a day should connect to the next day
  const shouldConnectRight = (index: number): boolean => {
    if (index % 7 === 6) return false; // Last day of week, don't connect
    const currentDay = days[index];
    const nextDay = days[index + 1];
    if (!nextDay) return false;
    
    return (currentDay.isInRange || currentDay.isStartDate || currentDay.isEndDate) &&
           (nextDay.isInRange || nextDay.isStartDate || nextDay.isEndDate);
  };

  // Helper function to determine if a day should connect to the previous day
  const shouldConnectLeft = (index: number): boolean => {
    if (index % 7 === 0) return false; // First day of week, don't connect
    const currentDay = days[index];
    const prevDay = days[index - 1];
    if (!prevDay) return false;
    
    return (currentDay.isInRange || currentDay.isStartDate || currentDay.isEndDate) &&
           (prevDay.isInRange || prevDay.isStartDate || prevDay.isEndDate);
  };

  return (
    <View style={styles.container}>
      {/* Date Range Display */}
      <View style={styles.selectedDateContainer}>
        <View style={styles.dateRangePill}>
          <Ionicons name="calendar" size={16} color="#60a5fa" />
          <Text style={styles.dateRangeText}>{formatDateRange()}</Text>
          {endDate && (
            <TouchableOpacity onPress={clearDateRange} style={styles.clearButton}>
              <Ionicons name="close" size={14} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={20} color="#60a5fa" />
        </TouchableOpacity>
        
        <Text style={styles.monthYearText}>{formatMonthYear(currentMonth)}</Text>
        
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={20} color="#60a5fa" />
        </TouchableOpacity>
      </View>

      {/* Day Names */}
      <View style={styles.dayNamesRow}>
        {dayNames.map((day, index) => (
          <Text key={index} style={styles.dayNameText}>{day}</Text>
        ))}
      </View>

      {/* Calendar Days */}
      <View style={styles.calendarGrid}>
        {days.map((day, index) => {
          const isDisabled = isDateDisabled(day.date);
          const connectLeft = shouldConnectLeft(index);
          const connectRight = shouldConnectRight(index);
          
          return (
            <View key={index} style={styles.dayContainer}>
              {/* Background connection layers */}
              {connectLeft && (
                <View style={[
                  styles.connectionLeft,
                  styles.connectionInRange, // Always use the dimmed color for connections
                ]} />
              )}
              {connectRight && (
                <View style={[
                  styles.connectionRight,
                  styles.connectionInRange, // Always use the dimmed color for connections
                ]} />
              )}
              
              {/* Day cell */}
              <TouchableOpacity
                style={[
                  styles.dayCell,
                  day.isToday && !day.isSelected && !day.isInRange && styles.dayToday,
                  day.isInRange && styles.dayInRange, // Bring back the individual range boxes
                  day.isStartDate && styles.dayStartDate,
                  day.isEndDate && styles.dayEndDate,
                  day.isSelected && !day.isInRange && styles.daySelected,
                  isDisabled && styles.dayDisabled,
                ]}
                onPress={() => handleDatePress(day.date)}
                disabled={isDisabled}
              >
                <Text style={[
                  styles.dayText,
                  !day.isCurrentMonth && styles.dayTextFaded,
                  day.isToday && !day.isSelected && !day.isInRange && styles.dayTextTodayUnselected,
                  day.isToday && styles.dayTextToday,
                  (day.isSelected || day.isInRange) && styles.dayTextSelected,
                  isDisabled && styles.dayTextDisabled,
                ]}>
                  {day.date.getDate()}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Help Text */}
      <Text style={styles.helpText}>
        Tap to pick starting and end dates
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  selectedDateContainer: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  dateRangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  dateRangeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    marginLeft: 4,
    padding: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthYearText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayNameText: {
    flex: 1,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 4,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayContainer: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    position: 'relative',
  },
  dayCell: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    zIndex: 2, // Higher z-index so borders appear above connectors
  },
  connectionLeft: {
    position: 'absolute',
    left: -1, // Slight overlap to prevent gaps
    top: 0,
    width: '51%', // Slightly wider to ensure connection
    height: '100%',
    zIndex: 1, // Lower z-index so they appear behind day cells
  },
  connectionRight: {
    position: 'absolute',
    right: -1, // Slight overlap to prevent gaps
    top: 0,
    width: '51%', // Slightly wider to ensure connection
    height: '100%',
    zIndex: 1, // Lower z-index so they appear behind day cells
  },
  connectionInRange: {
    backgroundColor: '#4f8cd9', // Back to blue, no greyness
  },
  dayToday: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)', // Dimmed red background
  },
  dayInRange: {
    backgroundColor: '#4f8cd9', // Back to blue, no greyness
  },
  dayStartDate: {
    backgroundColor: '#60a5fa',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  dayEndDate: {
    backgroundColor: '#60a5fa',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  daySelected: {
    backgroundColor: '#60a5fa',
  },
  dayDisabled: {
    opacity: 0.3,
  },
  dayText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  dayTextFaded: {
    color: '#6b7280',
  },
  dayTextToday: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  dayTextTodayUnselected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#4b5563',
  },
  helpText: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});