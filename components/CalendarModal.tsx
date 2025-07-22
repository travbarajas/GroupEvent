import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  GestureHandlerRootView, 
  PanGestureHandler,
  State 
} from 'react-native-gesture-handler';
import { ApiService } from '@/services/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  groupId: string;
  memberCount: number;
}

interface AvailabilitySlot {
  day: string;
  startHour: number;
  endHour: number;
  memberId: string;
}

interface TimeSlot {
  hour: number;
  displayTime: string;
}

const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  groupName,
  groupId,
  memberCount,
}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [availabilityData, setAvailabilityData] = useState<AvailabilitySlot[]>([]);
  const [currentUserAvailability, setCurrentUserAvailability] = useState<AvailabilitySlot[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{day: string, hour: number} | null>(null);
  const [dragEnd, setDragEnd] = useState<{day: string, hour: number} | null>(null);

  // Generate next 7 days
  const generateDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        key: date.toISOString().split('T')[0],
      });
    }
    return days;
  };

  // Generate time slots (6 AM to 11 PM)
  const generateTimeSlots = (): TimeSlot[] => {
    const slots = [];
    for (let hour = 6; hour <= 23; hour++) {
      const displayTime = hour === 0 ? '12 AM' 
        : hour === 12 ? '12 PM'
        : hour < 12 ? `${hour} AM`
        : `${hour - 12} PM`;
      slots.push({ hour, displayTime });
    }
    return slots;
  };

  const days = generateDays();
  const timeSlots = generateTimeSlots();
  const memberOpacity = memberCount > 0 ? 1 / memberCount : 1;

  useEffect(() => {
    if (visible && scrollViewRef.current) {
      // Scroll to 12 PM (index 6 since we start at 6 AM)
      const noonIndex = 6;
      const timeSlotHeight = 60;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: noonIndex * timeSlotHeight,
          animated: true,
        });
      }, 100);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      fetchAvailabilityData();
    }
  }, [visible, groupId]);

  const fetchAvailabilityData = async () => {
    try {
      const startDate = days[0].key;
      const endDate = days[days.length - 1].key;
      const data = await ApiService.getGroupAvailability(groupId, startDate, endDate);
      
      // Get current device ID once
      const currentDeviceId = await getCurrentDeviceId();
      
      // Transform data into the format we need
      const allSlots: AvailabilitySlot[] = [];
      const currentUserSlots: AvailabilitySlot[] = [];
      
      data.availability.forEach((memberAvailability: any) => {
        memberAvailability.slots.forEach((slot: any) => {
          const availabilitySlot: AvailabilitySlot = {
            day: slot.date,
            startHour: slot.startHour,
            endHour: slot.endHour,
            memberId: memberAvailability.memberId,
          };
          
          allSlots.push(availabilitySlot);
          
          // Check if this is the current user's availability
          if (memberAvailability.deviceId === currentDeviceId) {
            currentUserSlots.push(availabilitySlot);
          }
        });
      });
      
      setAvailabilityData(allSlots);
      setCurrentUserAvailability(currentUserSlots);
    } catch (error) {
      console.error('Failed to fetch availability data:', error);
    }
  };

  const getCurrentDeviceId = async () => {
    try {
      const { DeviceIdManager } = await import('@/utils/deviceId');
      return await DeviceIdManager.getDeviceId();
    } catch (error) {
      console.error('Failed to get device ID:', error);
      return '';
    }
  };

  const saveAvailabilityChanges = async () => {
    try {
      const slots = currentUserAvailability.map(slot => ({
        date: slot.day,
        startHour: slot.startHour,
        endHour: slot.endHour,
      }));
      
      await ApiService.saveUserAvailability(groupId, slots);
      console.log('Availability saved successfully');
    } catch (error) {
      console.error('Failed to save availability:', error);
    }
  };

  const getAvailabilityOpacity = (day: string, hour: number): number => {
    const slotsForTimeSlot = availabilityData.filter(slot => 
      slot.day === day && hour >= slot.startHour && hour < slot.endHour
    );
    return slotsForTimeSlot.length * memberOpacity;
  };

  const isCurrentUserAvailable = (day: string, hour: number): boolean => {
    return currentUserAvailability.some(slot => 
      slot.day === day && hour >= slot.startHour && hour < slot.endHour
    );
  };

  const handlePanGestureEvent = (event: any, day: string, hour: number) => {
    const { state } = event.nativeEvent;
    
    switch (state) {
      case State.BEGAN:
        setIsDragging(true);
        setDragStart({ day, hour });
        setDragEnd({ day, hour });
        break;
      case State.ACTIVE:
        setDragEnd({ day, hour });
        break;
      case State.END:
      case State.CANCELLED:
        if (dragStart && dragEnd && dragStart.day === dragEnd.day) {
          const startHour = Math.min(dragStart.hour, dragEnd.hour);
          const endHour = Math.max(dragStart.hour, dragEnd.hour) + 1;
          
          // Toggle availability for this time range
          const existingSlotIndex = currentUserAvailability.findIndex(slot => 
            slot.day === dragStart.day && 
            slot.startHour === startHour && 
            slot.endHour === endHour
          );
          
          if (existingSlotIndex !== -1) {
            // Remove existing slot
            setCurrentUserAvailability(prev => 
              prev.filter((_, index) => index !== existingSlotIndex)
            );
          } else {
            // Add new slot
            setCurrentUserAvailability(prev => [
              ...prev,
              {
                day: dragStart.day,
                startHour,
                endHour,
                memberId: 'current-user', // This would be actual user ID
              }
            ]);
          }
          
          // Auto-save changes
          setTimeout(saveAvailabilityChanges, 500); // Debounce saves
        }
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        break;
    }
  };

  const isDraggedSlot = (day: string, hour: number): boolean => {
    if (!isDragging || !dragStart || !dragEnd || dragStart.day !== day) return false;
    const minHour = Math.min(dragStart.hour, dragEnd.hour);
    const maxHour = Math.max(dragStart.hour, dragEnd.hour);
    return hour >= minHour && hour <= maxHour;
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity 
            onPress={async () => {
              await saveAvailabilityChanges();
              onClose();
            }} 
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Group Calendar</Text>
            <Text style={styles.headerSubtitle}>{groupName}</Text>
          </View>
          <TouchableOpacity onPress={saveAvailabilityChanges} style={styles.saveButton}>
            <Ionicons name="checkmark" size={20} color="#22c55e" />
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calendarContainer}>
          {/* Days Header */}
          <View style={styles.daysHeader}>
            <View style={styles.timeColumnHeader} />
            {days.map((day) => (
              <View key={day.key} style={styles.dayHeader}>
                <Text style={styles.dayName}>{day.dayName}</Text>
                <Text style={styles.dayNumber}>{day.dayNumber}</Text>
                <Text style={styles.monthName}>{day.monthName}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.gridScrollView}
            showsVerticalScrollIndicator={false}
          >
            {timeSlots.map((timeSlot, timeIndex) => (
              <View key={timeSlot.hour} style={styles.timeRow}>
                {/* Time Label */}
                <View style={styles.timeLabel}>
                  <Text style={styles.timeText}>{timeSlot.displayTime}</Text>
                </View>

                {/* Day Columns */}
                {days.map((day) => {
                  const opacity = getAvailabilityOpacity(day.key, timeSlot.hour);
                  const isUserAvailable = isCurrentUserAvailable(day.key, timeSlot.hour);
                  const isDragged = isDraggedSlot(day.key, timeSlot.hour);
                  
                  return (
                    <PanGestureHandler
                      key={`${day.key}-${timeSlot.hour}`}
                      onHandlerStateChange={(event) => handlePanGestureEvent(event, day.key, timeSlot.hour)}
                    >
                      <View
                        style={[
                          styles.timeSlot,
                          opacity > 0 && styles.availableSlot,
                          isUserAvailable && styles.userAvailableSlot,
                          isDragged && styles.draggedSlot,
                          { backgroundColor: `rgba(34, 197, 94, ${opacity})` },
                        ]}
                      />
                    </PanGestureHandler>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Drag to select your availability • Green areas show group overlap
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
    marginLeft: 4,
  },
  calendarContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  daysHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    paddingVertical: 12,
  },
  timeColumnHeader: {
    width: 60,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dayName: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 2,
  },
  monthName: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 1,
  },
  gridScrollView: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  timeLabel: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRightWidth: 1,
    borderRightColor: '#2a2a2a',
  },
  timeText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  timeSlot: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#2a2a2a',
    backgroundColor: 'transparent',
  },
  availableSlot: {
    backgroundColor: '#22c55e',
  },
  userAvailableSlot: {
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  draggedSlot: {
    backgroundColor: '#22c55e',
    opacity: 0.7,
  },
  instructionsContainer: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  instructionsText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

export default CalendarModal;