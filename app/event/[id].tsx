import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Animated,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService, Event, LegacyEvent } from '@/services/api';

type EventData = Event | LegacyEvent;

interface AttendanceData {
  going: string[];
  maybe: string[];
  not_going: string[];
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  date: string;
}

export default function EventDetailScreen() {
  const { id, groupId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<EventData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceData>({
    going: [],
    maybe: [],
    not_going: []
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [headerAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    if (id && groupId) {
      fetchEventData();
      fetchAttendance();
      fetchExpenses();
    }
  }, [id, groupId]);

  const fetchEventData = async () => {
    try {
      // Fetch all group events and find the specific one
      const { events } = await ApiService.getGroupEvents(groupId as string);
      const eventData = events.find(e => e.id === id);
      
      if (eventData) {
        setEvent(eventData);
      } else {
        console.error('Event not found in group');
      }
    } catch (error) {
      console.error('Failed to fetch event data:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      // Mock data for now - replace with actual API call
      setAttendance({
        going: ['Alice', 'Bob', 'Charlie', 'Diana'],
        maybe: ['Eve', 'Frank'],
        not_going: ['Grace']
      });
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      // Mock data for now - replace with actual API call
      setExpenses([
        {
          id: '1',
          description: 'Dinner reservation',
          amount: 120.50,
          paid_by: 'Alice',
          date: '2024-01-15'
        },
        {
          id: '2',
          description: 'Uber ride',
          amount: 25.75,
          paid_by: 'Bob',
          date: '2024-01-15'
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    }
  };

  const toggleHeader = () => {
    const toValue = isHeaderExpanded ? 0 : 1;
    
    Animated.timing(headerAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    setIsHeaderExpanded(!isHeaderExpanded);
  };

  const headerHeight = headerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [120 + insets.top, 220 + insets.top],
  });

  const AttendanceBox = ({ title, users, color }: { title: string; users: string[]; color: string }) => (
    <View style={styles.attendanceBox}>
      <View style={[styles.attendanceBoxHeader, { backgroundColor: color }]}>
        <Text style={styles.attendanceBoxTitle}>
          {title}
        </Text>
        <Text style={styles.attendanceBoxCount}>
          {users.length}
        </Text>
      </View>
      <View style={styles.attendanceBoxContent}>
        {users.slice(0, 3).map((user, index) => (
          <Text key={index} style={styles.attendanceBoxUser}>
            {user}
          </Text>
        ))}
        {users.length > 3 && (
          <Text style={styles.attendanceBoxMore}>
            +{users.length - 3} more
          </Text>
        )}
        {users.length === 0 && (
          <Text style={styles.attendanceBoxEmpty}>None</Text>
        )}
      </View>
    </View>
  );

  const ExpenseRow = ({ expense }: { expense: Expense }) => (
    <View style={styles.expenseRow}>
      <Text style={styles.expenseDescription}>{expense.description}</Text>
      <Text style={styles.expenseAmount}>${expense.amount.toFixed(2)}</Text>
      <Text style={styles.expensePaidBy}>{expense.paid_by}</Text>
      <Text style={styles.expenseDate}>{expense.date}</Text>
    </View>
  );

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Normalize event data for display (handles both legacy and new formats)
  const getDisplayEvent = () => {
    if (!event) {
      // Return mock data if no event loaded
      return {
        name: 'Loading...',
        displayName: 'Loading...',
        description: 'Loading event details...',
        date: '',
        time: '',
        location: '',
        created_by_username: '',
        price: null,
        currency: null,
        is_free: true,
        category: null
      };
    }

    // Check if it's a legacy event
    if ('original_event_data' in event && event.original_event_data) {
      const legacyEvent = event as LegacyEvent;
      return {
        name: legacyEvent.original_event_data.name || 'Untitled Event',
        displayName: legacyEvent.custom_name || legacyEvent.original_event_data.name || 'Untitled Event',
        description: legacyEvent.original_event_data.description || 'No description available',
        date: legacyEvent.original_event_data.date || '',
        time: legacyEvent.original_event_data.time || '',
        location: legacyEvent.original_event_data.location || '',
        created_by_username: legacyEvent.created_by_username || 'Unknown',
        price: null,
        currency: null,
        is_free: true,
        category: null
      };
    } else {
      // New event format
      const newEvent = event as Event;
      return {
        name: newEvent.name || 'Untitled Event',
        displayName: newEvent.custom_name || newEvent.name || 'Untitled Event',
        description: newEvent.description || 'No description available',
        date: newEvent.date || '',
        time: newEvent.time || '',
        location: newEvent.location || newEvent.venue_name || '',
        created_by_username: newEvent.created_by_username || 'Unknown',
        price: newEvent.price,
        currency: newEvent.currency || 'USD',
        is_free: newEvent.is_free,
        category: newEvent.category
      };
    }
  };

  const displayEvent = getDisplayEvent();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Expandable Header */}
        <Animated.View style={[styles.eventHeader, { height: headerHeight, paddingTop: insets.top }]}>
          <TouchableOpacity 
            style={styles.headerTouchable}
            onPress={toggleHeader}
            activeOpacity={0.8}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
                  <Ionicons name="chevron-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.eventName}>
                  {displayEvent.displayName}
                </Text>
                <TouchableOpacity onPress={toggleHeader}>
                  <Ionicons 
                    name={isHeaderExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#9ca3af" 
                  />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.eventShortDescription} numberOfLines={isHeaderExpanded ? undefined : 2}>
                {displayEvent.description}
              </Text>
              
              {isHeaderExpanded && (
                <Animated.View style={{ opacity: headerAnimation }}>
                  <View style={styles.eventDetails}>
                    <View style={styles.eventDetailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
                      <Text style={styles.eventDetailText}>
                        {displayEvent.date} • {displayEvent.time}
                      </Text>
                    </View>
                    {displayEvent.location && (
                      <View style={styles.eventDetailRow}>
                        <Ionicons name="location-outline" size={16} color="#9ca3af" />
                        <Text style={styles.eventDetailText}>
                          {displayEvent.location}
                        </Text>
                      </View>
                    )}
                    {!displayEvent.is_free && displayEvent.price && (
                      <View style={styles.eventDetailRow}>
                        <Ionicons name="cash-outline" size={16} color="#9ca3af" />
                        <Text style={styles.eventDetailText}>
                          ${displayEvent.price} {displayEvent.currency}
                        </Text>
                      </View>
                    )}
                    {displayEvent.category && (
                      <View style={styles.eventDetailRow}>
                        <Ionicons name="bookmark-outline" size={16} color="#9ca3af" />
                        <Text style={styles.eventDetailText}>
                          {displayEvent.category}
                        </Text>
                      </View>
                    )}
                    <View style={styles.eventDetailRow}>
                      <Ionicons name="person-outline" size={16} color="#9ca3af" />
                      <Text style={styles.eventDetailText}>
                        Created by {displayEvent.created_by_username}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Attendance Sections */}
        <View style={styles.attendanceContainer}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          
          <View style={styles.attendanceBoxRow}>
            <AttendanceBox 
              title="Going" 
              users={attendance.going} 
              color="#10b981" 
            />
            
            <AttendanceBox 
              title="Maybe" 
              users={attendance.maybe} 
              color="#f59e0b" 
            />
            
            <AttendanceBox 
              title="Not Going" 
              users={attendance.not_going} 
              color="#ef4444" 
            />
          </View>
        </View>

        {/* Expenses Section */}
        <View style={styles.expensesContainer}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          
          <View style={styles.expensesTable}>
            <View style={styles.expenseHeader}>
              <Text style={styles.expenseHeaderText}>Description</Text>
              <Text style={styles.expenseHeaderText}>Amount</Text>
              <Text style={styles.expenseHeaderText}>Paid By</Text>
              <Text style={styles.expenseHeaderText}>Date</Text>
            </View>
            
            {expenses.map(expense => (
              <ExpenseRow key={expense.id} expense={expense} />
            ))}
            
            {expenses.length === 0 && (
              <View style={styles.emptyExpensesContainer}>
                <Text style={styles.emptyExpensesText}>No expenses yet</Text>
              </View>
            )}
            
            <View style={styles.expensesTotal}>
              <Text style={styles.expensesTotalText}>
                Total: ${totalExpenses.toFixed(2)}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.addExpenseButton}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.addExpenseButtonText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
        
        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerBackButton: {
    padding: 4,
    marginRight: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  eventHeader: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTouchable: {
    flex: 1,
  },
  headerContent: {
    padding: 20,
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  eventShortDescription: {
    fontSize: 16,
    color: '#e5e7eb',
    lineHeight: 22,
    marginBottom: 16,
  },
  eventDetails: {
    marginTop: 16,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  attendanceContainer: {
    padding: 20,
  },
  attendanceBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  attendanceBox: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  attendanceBoxHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceBoxTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  attendanceBoxCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  attendanceBoxContent: {
    padding: 12,
    minHeight: 60,
  },
  attendanceBoxUser: {
    fontSize: 12,
    color: '#e5e7eb',
    marginBottom: 4,
  },
  attendanceBoxMore: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  attendanceBoxEmpty: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  expensesContainer: {
    padding: 20,
  },
  expensesTable: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 16,
  },
  expenseHeader: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  expenseHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  expenseRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  expenseDescription: {
    flex: 1,
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseAmount: {
    flex: 1,
    fontSize: 14,
    color: '#e5e7eb',
    textAlign: 'right',
  },
  expensePaidBy: {
    flex: 1,
    fontSize: 14,
    color: '#e5e7eb',
    textAlign: 'center',
  },
  expenseDate: {
    flex: 1,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'right',
  },
  emptyExpensesContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyExpensesText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  expensesTotal: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#3a3a3a',
  },
  expensesTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'right',
  },
  addExpenseButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addExpenseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});