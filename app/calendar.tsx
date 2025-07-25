import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiService } from '../services/api';
import { calendarCache, CalendarMonthData } from '../utils/calendarCache';

const { width } = Dimensions.get('window');
const DAY_WIDTH = (width - 32) / 7; // Account for padding

// Days of the week
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Month names
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Memoized DateCell component to improve rendering performance
const DateCell = memo(({ 
  date, 
  row, 
  col, 
  month, 
  year, 
  isSelected, 
  hasEvents,
  eventCount,
  onPress 
}: {
  date: number | null;
  row: number;
  col: number;
  month: number;
  year: number;
  isSelected: boolean;
  hasEvents: boolean;
  eventCount: number;
  onPress?: () => void;
}) => {
  if (!date) {
    return <View key={`empty-${row}-${col}`} />;
  }

  const cellContent = (
    <View style={styles.dateCellContent}>
      <Text style={[
        styles.dateText,
        isSelected && styles.selectedDateText,
        hasEvents && styles.dateTextWithEvents
      ]}>
        {date}
      </Text>
      {hasEvents && (
        <View style={styles.eventPill}>
          <Text style={styles.eventPillText}>
            {eventCount} event{eventCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );

  if (hasEvents && onPress) {
    return (
      <TouchableOpacity
        style={[
          styles.dateCell,
          {
            top: row * 70,
            left: col * DAY_WIDTH,
          },
          isSelected && styles.selectedDateCell,
          styles.dateCellWithEvents
        ]}
        onPress={onPress}
      >
        {cellContent}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.dateCell,
        {
          top: row * 70,
          left: col * DAY_WIDTH,
        },
        isSelected && styles.selectedDateCell
      ]}
    >
      {cellContent}
    </View>
  );
});

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  color: string;
  icon?: string;
  participants?: number;
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<{day: number, month: number, year: number} | null>(null);
  const [monthsRange, setMonthsRange] = useState({ start: -2, end: 3 }); // Start with 5 months (2 before, 3 after)
  const scrollViewRef = useRef<ScrollView>(null);
  const isLoadingRef = useRef(false);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    if (groupId) {
      fetchGroupEvents();
    }
  }, [groupId]);

  // Scroll to current month on initial load and set current date
  useEffect(() => {
    const today = new Date();
    setSelectedDate({
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear()
    });
    
    // Use requestAnimationFrame for optimal scroll timing
    requestAnimationFrame(() => {
      if (scrollViewRef.current) {
        // Scroll to the current month (with start=-2, current month is at index 2, so 2 * ~570px)
        const currentMonthOffset = 2 * 570;
        scrollViewRef.current?.scrollTo({
          y: currentMonthOffset,
          animated: false,
        });
      }
    });
  }, []);

  // Handle scroll position when new months are added to the top
  useEffect(() => {
    if (scrollPositionRef.current > 0 && scrollViewRef.current) {
      // Use average month height since months now have variable heights
      const averageMonthHeight = 570; // Approximate average with new row height
      const addedHeight = 3 * averageMonthHeight; // 3 new months
      
      // Restore the exact scroll position after new months are added
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: scrollPositionRef.current + addedHeight,
          animated: false,
        });
        scrollPositionRef.current = 0; // Reset
      }, 10);
    }
  }, [monthsRange.start]);


  const fetchGroupEvents = async () => {
    try {
      const eventsData = await ApiService.getGroupEvents(groupId as string);
      
      // Convert group events to calendar events format
      const calendarEvents: CalendarEvent[] = (eventsData.events || []).map((event: any) => {
        const title = event.custom_name || event.original_event_data?.name || 'Untitled Event';
        const startDate = formatEventDate(event.original_event_data?.date) || '';
        
        return {
          id: String(event.id || ''),
          title: String(title),
          startDate: String(startDate),
          color: '#D4A574',
          icon: 'calendar',
          participants: 0
        };
      }).filter((event: CalendarEvent) => event.startDate); // Only include events with valid dates
      
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Failed to fetch group events:', error);
      setEvents([]); // Empty array if no events
    }
  };

  // Convert event date to YYYY-MM-DD format
  const formatEventDate = (dateString: string): string | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    
    try {
      let date: Date;
      
      if (dateString.includes('FALLBACK')) {
        // Handle fallback dates like "FALLBACK - Sat, July 19"
        const match = dateString.match(/(\w+),?\s+(\w+)\s+(\d+)/);
        if (match) {
          const [, , monthName, day] = match;
          const currentYear = new Date().getFullYear();
          date = new Date(`${monthName} ${day}, ${currentYear}`);
        } else {
          return null;
        }
      } else {
        // Try to parse the date directly
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return null;
    }
  };

  // Get calendar data for multiple months with dynamic range (memoized for performance)
  const getMultipleMonthsData = useMemo(() => {
    // Try to get cached data first
    const cachedData = calendarCache.getCachedCalendarData(currentDate);
    if (cachedData && monthsRange.start === -2 && monthsRange.end === 3) {
      return cachedData;
    }
    
    // Fallback to generating data if not cached or different range
    const months = [];
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthsRange.start, 1);
    
    // Generate months based on current range
    const totalMonths = monthsRange.end - monthsRange.start;
    for (let i = 0; i < totalMonths; i++) {
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      
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
      
      months.push({ dates, year, month, monthDate, daysInMonth, rowsNeeded });
    }
    
    return months;
  }, [currentDate, monthsRange]);

  // Handle scroll events for infinite scrolling
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const scrollY = contentOffset.y;
    const scrollViewHeight = layoutMeasurement.height;
    const contentHeight = contentSize.height;
    
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) return;
    
    // Load more months when near top (within 1000px) - only after scrolling past the preloaded months
    if (scrollY < 1000 && monthsRange.start > -50) { // Limit to prevent infinite loading
      isLoadingRef.current = true;
      const newStart = monthsRange.start - 3; // Add 3 months before
      
      // Store current scroll position before adding new months
      scrollPositionRef.current = scrollY;
      
      // Log new months being loaded
      for (let i = 0; i < 3; i++) {
        const monthOffset = newStart + i;
        const newMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthOffset, 1);
        const monthStr = String(newMonthDate.getMonth() + 1).padStart(2, '0');
        const yearStr = newMonthDate.getFullYear().toString();
        console.log(`Loading month: ${monthStr}/${yearStr}`);
      }
      
      setMonthsRange(prev => ({ ...prev, start: newStart }));
      
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 100);
    }
    
    // Load more months when near bottom (within 1000px) - only after scrolling past the preloaded months  
    if (scrollY + scrollViewHeight > contentHeight - 1000 && monthsRange.end < 50) { // Limit to prevent infinite loading
      isLoadingRef.current = true;
      const newEnd = monthsRange.end + 3; // Add 3 months after
      
      // Log new months being loaded
      for (let i = 0; i < 3; i++) {
        const monthOffset = monthsRange.end + i;
        const newMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthOffset, 1);
        const monthStr = String(newMonthDate.getMonth() + 1).padStart(2, '0');
        const yearStr = newMonthDate.getFullYear().toString();
        console.log(`Loading month: ${monthStr}/${yearStr}`);
      }
      
      setMonthsRange(prev => ({ ...prev, end: newEnd }));
      
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 100);
    }
  };

  const getDateString = (day: number, year: number, month: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getEventsForDate = (date: number, year: number, month: number): CalendarEvent[] => {
    const dateString = getDateString(date, year, month);
    return events.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
      const currentDateObj = new Date(dateString);
      
      return currentDateObj >= eventStart && currentDateObj <= eventEnd;
    });
  };


  const renderMonth = (monthData: any) => {
    const { dates, year, month, rowsNeeded } = monthData;
    const monthEvents = events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.getMonth() === month && eventDate.getFullYear() === year;
    });

    // Create a map of date to events for quick lookup
    const eventsPerDate = new Map<number, CalendarEvent[]>();
    monthEvents.forEach(event => {
      const eventDate = new Date(event.startDate);
      const day = eventDate.getDate();
      if (!eventsPerDate.has(day)) {
        eventsPerDate.set(day, []);
      }
      eventsPerDate.get(day)!.push(event);
    });

    return (
      <View key={`${year}-${month}`} style={styles.monthContainer}>
        {/* Month Header */}
        <Text style={styles.monthHeader}>
          {`${MONTHS[month]}${year !== new Date().getFullYear() ? ` ${year}` : ''}`}
        </Text>
        
        {/* Day Headers */}
        <View style={styles.dayHeadersContainer}>
          {DAYS.map((day, index) => (
            <View key={index} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendarGrid, { height: rowsNeeded * 70 + 5 }]}>
          {/* Date Numbers */}
          {dates.map((date, index) => {
            const row = Math.floor(index / 7);
            const col = index % 7;
            const isSelected = selectedDate?.day === date && selectedDate?.month === month && selectedDate?.year === year;
            const dateEvents = date ? eventsPerDate.get(date) || [] : [];
            const hasEvents = dateEvents.length > 0;
            
            return (
              <DateCell
                key={`${year}-${month}-${index}`}
                date={date}
                row={row}
                col={col}
                month={month}
                year={year}
                isSelected={isSelected}
                hasEvents={hasEvents}
                eventCount={dateEvents.length}
                onPress={hasEvents ? () => {
                  if (date) {
                    setSelectedDate({day: date, month, year});
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    router.push(`/date-events?date=${dateString}&groupId=${groupId}`);
                  }
                } : undefined}
              />
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Calendar</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        {getMultipleMonthsData.map(monthData => renderMonth(monthData))}
        
        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Match app's standard black
  },
  headerContainer: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  calendarContainer: {
    padding: 16,
  },
  monthContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
  },
  monthHeader: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 2,
    marginBottom: 8,
  },
  dayHeadersContainer: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  dayHeaderCell: {
    width: DAY_WIDTH,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  calendarGrid: {
    position: 'relative',
    // Height is now dynamically calculated per month
  },
  dateCell: {
    position: 'absolute',
    width: DAY_WIDTH,
    height: 70, // Increased height for event pills
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  dateCellContent: {
    alignItems: 'center',
    width: '100%',
  },
  dateCellWithEvents: {
    backgroundColor: 'rgba(212, 165, 116, 0.1)', // Subtle background for clickable dates
    borderRadius: 8,
  },
  selectedDateCell: {
    backgroundColor: '#ef4444',
    borderRadius: 20,
  },
  dateText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 4,
  },
  dateTextWithEvents: {
    color: '#D4A574', // Golden color for dates with events
    fontWeight: '600',
  },
  selectedDateText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  eventPill: {
    backgroundColor: '#D4A574',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 40,
    alignItems: 'center',
  },
  eventPillText: {
    fontSize: 10,
    color: '#2A1F14',
    fontWeight: '600',
  },
  eventsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  eventBar: {
    position: 'absolute',
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  eventIcon: {
    marginRight: 4,
  },
  eventText: {
    fontSize: 12,
    color: '#2A1F14',
    fontWeight: '600',
    flex: 1,
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
    marginRight: 4,
  },
  participantCount: {
    fontSize: 10,
    color: '#2A1F14',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
});