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
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService, Event, LegacyEvent } from '@/services/api';
import CarSeatIndicator from '@/components/CarSeatIndicator';
import ExpenseTracker from '@/components/ExpenseTracker';
import ChecklistBlock from '@/components/ChecklistBlock';
import ExpenseBlock from '@/components/ExpenseBlock';

type EventData = Event | LegacyEvent;

interface AttendanceData {
  going: string[];
  maybe: string[];
  not_going: string[];
}

interface ExpenseItem {
  id: string;
  description: string;
  totalAmount: number;
  paidBy: string[];
  splitBetween: string[];
  individualAmount: number;
  paymentStatus: { [memberId: string]: 'pending' | 'sent' | 'completed' };
  createdAt: string;
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
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [headerAnimation] = useState(new Animated.Value(0));
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [gptInput, setGptInput] = useState<string>('');
  const [members, setMembers] = useState<any[]>([]);
  const [groupProfile, setGroupProfile] = useState<any>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expensesExpanded, setExpensesExpanded] = useState(false);

  useEffect(() => {
    if (id && groupId) {
      fetchEventData();
      fetchAttendance();
      fetchExpenses();
      getCurrentDeviceId();
      fetchMembers();
      fetchGroupProfile();
    }
  }, [id, groupId]);

  // Background polling for expense updates every 10 seconds
  useEffect(() => {
    if (!groupId) return;
    
    // Poll every 10 seconds for expense updates when component is mounted
    const backgroundPoll = setInterval(() => {
      fetchExpenses();
    }, 10000);
    
    return () => clearInterval(backgroundPoll);
  }, [groupId]);

  // Fast polling when expense modal is open
  useEffect(() => {
    if ((!showExpenseModal && !showAddExpenseModal) || !groupId) return;
    
    // Poll every 2 seconds when actively viewing expense modal
    const activePoll = setInterval(() => {
      fetchExpenses();
    }, 2000);
    
    return () => clearInterval(activePoll);
  }, [showExpenseModal, showAddExpenseModal, groupId]);

  const getCurrentDeviceId = async () => {
    try {
      const { DeviceIdManager } = await import('@/utils/deviceId');
      const deviceId = await DeviceIdManager.getDeviceId();
      setCurrentDeviceId(deviceId);
    } catch (error) {
      // Failed to get device ID
    }
  };

  const fetchEventData = async () => {
    try {
      // Fetch all group events and find the specific one
      const { events } = await ApiService.getGroupEvents(groupId as string);
      const eventData = events.find(e => e.id === id);
      
      if (eventData) {
        setEvent(eventData);
      }
    } catch (error) {
      // Failed to fetch event data
    }
  };

  const fetchAttendance = async () => {
    try {
      if (!groupId || !id) return;
      const attendanceData = await ApiService.getEventAttendance(groupId as string, id as string);
      setAttendance(attendanceData);
    } catch (error) {
      // Failed to fetch attendance, keep empty state
      setAttendance({
        going: [],
        maybe: [],
        not_going: []
      });
    }
  };

  const fetchExpenses = async () => {
    try {
      const { expenses: apiExpenses } = await ApiService.getGroupExpenses(groupId as string);
      
      // Transform API data to match our ExpenseItem interface
      const transformedExpenses: ExpenseItem[] = apiExpenses.map(expense => ({
        id: expense.id,
        description: expense.description,
        totalAmount: parseFloat(expense.total_amount),
        paidBy: expense.payers || [],
        splitBetween: expense.owers || [],
        individualAmount: expense.individual_amount || 0,
        paymentStatus: expense.payment_status || {},
        createdAt: expense.created_at
      }));
      
      setExpenses(transformedExpenses);
    } catch (error) {
      setExpenses([]);
    }
  };

  const handleExpensesChange = (updatedExpenses: ExpenseItem[]) => {
    setExpenses(updatedExpenses);
  };

  // Helper function to check if expense is fully settled
  const isExpenseFullyPaid = (expense: ExpenseItem) => {
    // Check if all owers have marked themselves as paid ("I've paid")
    const allOwersHavePaid = expense.splitBetween.every(deviceId => 
      expense.paymentStatus[deviceId] === 'completed'
    );
    
    // Check if all payers have marked themselves as been paid ("I've been paid")
    const allPayersHaveBeenPaid = expense.paidBy.every(deviceId => 
      expense.paymentStatus[deviceId] === 'completed'
    );
    
    // Expense is complete when EITHER all owers have paid OR all payers have been paid
    return allOwersHavePaid || allPayersHaveBeenPaid;
  };

  const fetchMembers = async () => {
    try {
      const membersData = await ApiService.getGroupMembers(groupId as string);
      setMembers(membersData);
    } catch (error) {
      // Failed to fetch members
    }
  };

  const fetchGroupProfile = async () => {
    try {
      const profileData = await ApiService.getGroupProfile(groupId as string);
      setGroupProfile(profileData);
    } catch (error) {
      // Failed to fetch group profile
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

  const handleDeleteEvent = async () => {
    try {
      await ApiService.deleteEventFromGroup(groupId as string, id as string);
      setShowDeleteModal(false);
      router.back(); // Go back to group page
    } catch (error) {
      Alert.alert('Error', 'Failed to delete event. Please try again.');
    }
  };

  const isEventCreator = () => {
    if (!event || !currentDeviceId) return false;
    
    // Check multiple possible creator field names for backwards compatibility
    const eventAny = event as any;
    const possibleCreatorIds = [
      eventAny.created_by_device_id,
      eventAny.added_by_device_id,
      eventAny.createdByDeviceId,
      eventAny.addedByDeviceId
    ].filter(Boolean); // Remove null/undefined values
    
    // If no creator ID found, allow deletion (for very old events)
    if (possibleCreatorIds.length === 0) {
      // No creator ID found for event, allowing deletion for cleanup
      return true;
    }
    
    return possibleCreatorIds.some(creatorId => creatorId === currentDeviceId);
  };

  const headerHeight = headerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [120 + insets.top, 220 + insets.top],
  });

  const handleAttendanceChange = async (status: 'going' | 'maybe' | 'not_going') => {
    if (!groupId || !id || !currentDeviceId) return;
    
    try {
      // Optimistic update - remove user from all attendance lists first
      const updatedAttendance = {
        going: attendance.going.filter(deviceId => deviceId !== currentDeviceId),
        maybe: attendance.maybe.filter(deviceId => deviceId !== currentDeviceId),
        not_going: attendance.not_going.filter(deviceId => deviceId !== currentDeviceId)
      };
      
      // Add user to the selected status (toggle behavior - if already in that status, remove them)
      const isAlreadyInStatus = attendance[status].includes(currentDeviceId);
      if (!isAlreadyInStatus) {
        updatedAttendance[status].push(currentDeviceId);
      }
      
      // Update UI immediately
      setAttendance(updatedAttendance);
      
      // Send to API (only if not removing - if removing, send empty/null status)
      if (!isAlreadyInStatus) {
        await ApiService.updateEventAttendance(groupId as string, id as string, status);
      } else {
        // If removing attendance, we might need a different API call or just not send anything
        // For now, let's refetch to get the correct state
        await fetchAttendance();
      }
    } catch (error) {
      // Revert optimistic update on error
      await fetchAttendance();
      Alert.alert('Error', 'Failed to update attendance. Please try again.');
    }
  };
  
  const getUserDisplayName = (deviceId: string) => {
    const member = members.find(m => m.device_id === deviceId);
    return member?.username || 'Unknown User';
  };
  
  const isUserInAttendance = (status: 'going' | 'maybe' | 'not_going') => {
    return attendance[status].includes(currentDeviceId);
  };

  const AttendanceBox = ({ 
    title, 
    users, 
    color, 
    status 
  }: { 
    title: string; 
    users: string[]; 
    color: string;
    status: 'going' | 'maybe' | 'not_going';
  }) => {
    const isSelected = isUserInAttendance(status);
    
    return (
      <TouchableOpacity 
        style={[
          styles.attendanceBox,
          isSelected && styles.attendanceBoxSelected
        ]}
        onPress={() => handleAttendanceChange(status)}
        activeOpacity={0.7}
      >
        <View style={[styles.attendanceBoxHeader, { backgroundColor: color }]}>
          <Text style={styles.attendanceBoxTitle}>
            {title}
          </Text>
          <Text style={styles.attendanceBoxCount}>
            {users.length}
          </Text>
        </View>
        <View style={styles.attendanceBoxContent}>
          {users.slice(0, 3).map((deviceId, index) => (
            <View key={deviceId} style={styles.attendanceUserRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {getUserDisplayName(deviceId)[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.attendanceBoxUser}>
                {getUserDisplayName(deviceId)}
              </Text>
              {deviceId === currentDeviceId && (
                <View style={styles.currentUserIndicator}>
                  <Text style={styles.currentUserText}>You</Text>
                </View>
              )}
            </View>
          ))}
          {users.length > 3 && (
            <Text style={styles.attendanceBoxMore}>
              +{users.length - 3} more
            </Text>
          )}
          {users.length === 0 && (
            <Text style={styles.attendanceBoxEmpty}>Tap to join</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };


  // Calculate totals only for non-completed expenses
  const activeExpenses = expenses.filter(expense => !isExpenseFullyPaid(expense));
  const totalExpenses = activeExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0);

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
                <View style={styles.headerRightButtons}>
                  {isEventCreator() && (
                    <TouchableOpacity 
                      onPress={() => setShowDeleteModal(true)} 
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={toggleHeader}>
                    <Ionicons 
                      name={isHeaderExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#9ca3af" 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              {isHeaderExpanded && (
                <Animated.View style={{ opacity: headerAnimation }}>
                  <Text style={styles.eventLongDescription}>
                    {displayEvent.description}
                  </Text>
                </Animated.View>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
        
        {/* GPT Input Field */}
        <View style={styles.gptInputContainer}>
          <View style={styles.gptInputBox}>
            <Ionicons name="search-outline" size={20} color="#6b7280" style={styles.gptInputIcon} />
            <TextInput
              style={styles.gptInput}
              placeholder="Ask questions about this event..."
              placeholderTextColor="#6b7280"
              value={gptInput}
              onChangeText={setGptInput}
              returnKeyType="search"
            />
            {gptInput.length > 0 && (
              <TouchableOpacity onPress={() => setGptInput('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Event Key Info */}
        <View style={styles.eventInfoContainer}>
          <View style={styles.eventInfoGrid}>
            <View style={styles.eventInfoItem}>
              <Ionicons name="calendar-outline" size={20} color="#60a5fa" />
              <Text style={styles.eventInfoLabel}>Date & Time</Text>
              <Text style={styles.eventInfoValue}>
                {displayEvent.date}
                {displayEvent.time && ` • ${displayEvent.time}`}
              </Text>
            </View>
            
            {!displayEvent.is_free && displayEvent.price && (
              <View style={styles.eventInfoItem}>
                <Ionicons name="cash-outline" size={20} color="#10b981" />
                <Text style={styles.eventInfoLabel}>Price</Text>
                <Text style={styles.eventInfoValue}>
                  ${displayEvent.price} {displayEvent.currency}
                </Text>
              </View>
            )}
            
            {displayEvent.location && (
              <View style={styles.eventInfoItem}>
                <Ionicons name="location-outline" size={20} color="#f59e0b" />
                <Text style={styles.eventInfoLabel}>Location</Text>
                <Text style={styles.eventInfoValue}>
                  {displayEvent.location}
                </Text>
              </View>
            )}
            
            <View style={styles.eventInfoItem}>
              <Ionicons name="person-outline" size={20} color="#8b5cf6" />
              <Text style={styles.eventInfoLabel}>Created by</Text>
              <Text style={styles.eventInfoValue}>
                {displayEvent.created_by_username}
              </Text>
            </View>
          </View>
        </View>

        {/* Attendance Sections */}
        <View style={styles.attendanceContainer}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          
          <View style={styles.attendanceBoxRow}>
            <AttendanceBox 
              title="Going" 
              users={attendance.going} 
              color="#10b981" 
              status="going"
            />
            
            <AttendanceBox 
              title="Maybe" 
              users={attendance.maybe} 
              color="#f59e0b" 
              status="maybe"
            />
            
            <AttendanceBox 
              title="Not Going" 
              users={attendance.not_going} 
              color="#ef4444" 
              status="not_going"
            />
          </View>
        </View>

        {/* Car Seats Block - Full Width */}
        <View style={styles.fullWidthContainer}>
          <CarSeatIndicator 
            groupId={groupId as string}
            eventId={id as string}
            currentUserId={currentDeviceId}
            userColor={groupProfile?.color}
            members={members}
          />
        </View>
        
        {/* Expenses Block - Full Width */}
        <ExpenseBlock 
          groupId={groupId as string}
          members={members}
          currentDeviceId={currentDeviceId}
        />
        
        {/* Checklist Block - Full Width */}
        <ChecklistBlock 
          eventId={id as string}
          groupId={groupId as string}
          members={members}
          currentDeviceId={currentDeviceId}
          eventName={displayEvent.displayName}
        />

        
        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="warning" size={24} color="#ef4444" />
              <Text style={styles.deleteModalTitle}>Delete Event</Text>
            </View>
            
            <View style={styles.deleteModalBody}>
              <Text style={styles.deleteModalText}>
                Are you sure you want to delete "{displayEvent.displayName}"?
              </Text>
              <Text style={styles.deleteModalSubtext}>
                This action cannot be undone.
              </Text>
            </View>
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteConfirmButton} 
                onPress={handleDeleteEvent}
              >
                <Text style={styles.deleteConfirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expense Tracker Modal - List View */}
      <ExpenseTracker
        visible={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        groupId={groupId as string}
        groupName={displayEvent.displayName}
        members={members}
        currentDeviceId={currentDeviceId}
        onExpensesChange={handleExpensesChange}
        initialStep="list"
      />

      {/* Expense Tracker Modal - Create View */}
      <ExpenseTracker
        visible={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        groupId={groupId as string}
        groupName={displayEvent.displayName}
        members={members}
        currentDeviceId={currentDeviceId}
        onExpensesChange={handleExpensesChange}
        initialStep="create"
      />

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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 0,
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
  attendanceBoxSelected: {
    borderColor: '#10b981',
    borderWidth: 2,
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
    minHeight: 80,
  },
  attendanceBoxUser: {
    fontSize: 12,
    color: '#e5e7eb',
    flex: 1,
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
  attendanceUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  userAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  currentUserIndicator: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  currentUserText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  fullWidthContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  expenseBlockFullWidth: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  expenseFullWidthContent: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  expenseLeftColumn: {
    flex: 0.25,
    alignItems: 'flex-start',
  },
  expenseMiddleColumn: {
    flex: 0.5,
  },
  expenseRightColumn: {
    flex: 0.25,
    alignItems: 'flex-end',
    gap: 8,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 2,
  },
  expenseCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expenseList: {
    gap: 6,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  expenseItemName: {
    fontSize: 12,
    color: '#e5e7eb',
    flex: 1,
    marginRight: 8,
  },
  expenseItemAmount: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  moreExpenses: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  noExpensesText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  userBalance: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 8,
  },
  userOwedText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
    textAlign: 'center',
  },
  userOwesText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
    textAlign: 'center',
  },
  userEvenText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    padding: 8,
    gap: 4,
  },
  addExpenseButtonText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  costHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  costLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  costAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  addExpenseButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  addExpenseButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 3,
  },
  expensePreviewList: {
    gap: 6,
  },
  expensePreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expensePreviewName: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
  },
  expensePreviewAmount: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  expensePreviewMore: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
  },
  addExpenseButtonSmall: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  addExpenseButtonTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 2,
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
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
  // Delete Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  deleteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  deleteModalBody: {
    padding: 20,
    alignItems: 'center',
  },
  deleteModalText: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteModalSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  cancelButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  gptInputContainer: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    marginTop: 0,
  },
  gptInputBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  gptInputIcon: {
    marginRight: 12,
  },
  gptInput: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
    height: 24,
  },
  clearButton: {
    marginLeft: 12,
    padding: 4,
  },
  eventInfoContainer: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  eventInfoGrid: {
    gap: 20,
  },
  eventInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventInfoLabel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 80,
  },
  eventInfoValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  eventLongDescription: {
    color: '#e5e7eb',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    paddingBottom: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    marginTop: 8,
    gap: 4,
  },
  expandButtonText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  userBalanceCompact: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userOwedTextCompact: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
    textAlign: 'center',
  },
  userOwesTextCompact: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
    textAlign: 'center',
  },
  userEvenTextCompact: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  addExpenseButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  addExpenseButtonTextCompact: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  middleColumnButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBalanceLabelCompact: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  userOwedAmountCompact: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
    textAlign: 'center',
  },
  userOwesAmountCompact: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '700',
    textAlign: 'center',
  },
  integratedExpenseButton: {
    marginBottom: 16,
  },
  expenseButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  integratedExpenseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  expenseButtonArrow: {
    marginLeft: 6,
  },
  expensePreviewSeparator: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 16,
  },
});