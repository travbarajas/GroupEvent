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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface WeeklyCalendarProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  groupId: string;
}

interface AvailabilityBlock {
  id: string;
  startHour: number; // 0-23 (24 hour format)
  endHour: number;
  dayIndex: number; // 0-6 (Sunday-Saturday)
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  visible,
  onClose,
  groupName,
  groupId,
}) => {
  const insets = useSafeAreaInsets();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    return sunday;
  });
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);

  // Generate the 7 days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  // Generate hours (12 AM to 11 PM)
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour < 12 ? 'AM' : 'PM';
    return {
      hour24: hour,
      display: `${displayHour} ${period}`,
    };
  });

  const today = new Date();
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  };

  const getDateNumber = (date: Date) => {
    return date.getDate();
  };

  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => {
      const newStart = new Date(prev);
      newStart.setDate(prev.getDate() - 7);
      return newStart;
    });
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(prev => {
      const newStart = new Date(prev);
      newStart.setDate(prev.getDate() + 7);
      return newStart;
    });
  };

  const goToToday = () => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    setCurrentWeekStart(sunday);
  };

  // Handle clicking on a time slot to create availability
  const handleTimeSlotPress = (dayIndex: number, hour: number) => {
    const newBlock: AvailabilityBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startHour: hour,
      endHour: hour + 1,
      dayIndex,
    };
    
    setAvailabilityBlocks(prev => [...prev, newBlock]);
  };

  // Remove availability block
  const removeBlock = (blockId: string) => {
    setAvailabilityBlocks(prev => prev.filter(block => block.id !== blockId));
  };

  const HOUR_HEIGHT = 60;
  const DAY_COLUMN_WIDTH = (screenWidth - 60) / 7; // Subtract time column width

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#5f6368" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Calendar</Text>
            <Text style={styles.headerSubtitle}>{groupName}</Text>
          </View>
          <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation */}
        <View style={styles.navigationHeader}>
          <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
            <Ionicons name="chevron-back" size={20} color="#5f6368" />
          </TouchableOpacity>
          <View style={styles.weekInfo}>
            <Text style={styles.weekText}>
              {currentWeekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={20} color="#5f6368" />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <ScrollView style={styles.calendarScrollView} showsVerticalScrollIndicator={false}>
          {/* Day Headers */}
          <View style={styles.dayHeadersContainer}>
            {/* Empty space for time column */}
            <View style={styles.timeColumnHeader} />
            
            {/* Day headers */}
            {weekDays.map((date, index) => (
              <View key={index} style={[styles.dayHeader, { width: DAY_COLUMN_WIDTH }]}>
                <Text style={styles.dayName}>{getDayName(date)}</Text>
                <View style={[
                  styles.dateContainer,
                  isToday(date) && styles.todayDateContainer
                ]}>
                  <Text style={[
                    styles.dateNumber,
                    isToday(date) && styles.todayDateNumber
                  ]}>
                    {getDateNumber(date)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Time Grid */}
          <View style={styles.timeGrid}>
            {hours.map((hour, hourIndex) => (
              <View key={hourIndex} style={styles.hourRow}>
                {/* Time label */}
                <View style={styles.timeLabel}>
                  <Text style={styles.timeLabelText}>{hour.display}</Text>
                </View>

                {/* Day columns */}
                <View style={styles.dayColumnsRow}>
                  {weekDays.map((date, dayIndex) => (
                    <TouchableOpacity
                      key={dayIndex}
                      style={[styles.dayColumn, { width: DAY_COLUMN_WIDTH }]}
                      onPress={() => handleTimeSlotPress(dayIndex, hour.hour24)}
                      activeOpacity={0.1}
                    >
                      {/* Availability blocks for this time slot */}
                      {availabilityBlocks
                        .filter(block => 
                          block.dayIndex === dayIndex &&
                          block.startHour <= hour.hour24 &&
                          block.endHour > hour.hour24
                        )
                        .map(block => {
                          const isFirstHour = block.startHour === hour.hour24;
                          const isLastHour = block.endHour - 1 === hour.hour24;
                          const blockHeight = (block.endHour - block.startHour) * HOUR_HEIGHT;
                          
                          return isFirstHour ? (
                            <TouchableOpacity
                              key={block.id}
                              style={[
                                styles.availabilityBlock,
                                {
                                  height: blockHeight,
                                  top: 0,
                                }
                              ]}
                              onPress={() => removeBlock(block.id)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.blockText}>Available</Text>
                            </TouchableOpacity>
                          ) : null;
                        })}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Tap time slots to add availability • Tap blocks to remove
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '500',
    color: '#3c4043',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#5f6368',
    marginTop: 2,
  },
  todayButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  todayButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekInfo: {
    flex: 1,
    alignItems: 'center',
  },
  weekText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#3c4043',
  },
  calendarScrollView: {
    flex: 1,
  },
  dayHeadersContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    paddingBottom: 8,
  },
  timeColumnHeader: {
    width: 60,
  },
  dayHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5f6368',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  dateContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDateContainer: {
    backgroundColor: '#1a73e8',
  },
  dateNumber: {
    fontSize: 14,
    fontWeight: '400',
    color: '#3c4043',
  },
  todayDateNumber: {
    color: '#ffffff',
    fontWeight: '500',
  },
  timeGrid: {
    backgroundColor: '#ffffff',
  },
  hourRow: {
    flexDirection: 'row',
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  timeLabel: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingTop: 8,
  },
  timeLabelText: {
    fontSize: 12,
    color: '#70757a',
    fontWeight: '400',
  },
  dayColumnsRow: {
    flexDirection: 'row',
    flex: 1,
  },
  dayColumn: {
    borderRightWidth: 1,
    borderRightColor: '#e8eaed',
    position: 'relative',
    minHeight: 60,
  },
  availabilityBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: '#34a853',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 1,
  },
  blockText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  instructionsContainer: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  instructionsText: {
    fontSize: 14,
    color: '#5f6368',
    textAlign: 'center',
  },
});

export default WeeklyCalendar;