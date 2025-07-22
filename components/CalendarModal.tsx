import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService, GroupService } from '@/services/api';
import { DeviceIdManager } from '@/utils/deviceId';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  groupId: string;
  memberCount: number;
}

interface AvailabilityBlock {
  id: string;
  startTime: number; // in half-hour increments (0 = 6:00 AM, 1 = 6:30 AM, etc.)
  endTime: number;
  memberId: string;
  type: 'availability';
  serverId?: string; // Server-side ID for synced blocks
}

interface EventBlock {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  type: 'event';
}

interface DayColumn {
  date: Date;
  key: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  availabilityBlocks: AvailabilityBlock[];
  eventBlocks: EventBlock[];
}

const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  groupName,
  groupId,
  memberCount,
}) => {
  const insets = useSafeAreaInsets();
  const horizontalScrollRef = useRef<ScrollView>(null);
  
  // Calendar data
  const [dayColumns, setDayColumns] = useState<DayColumn[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragColumn, setDragColumn] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    columnKey: string;
    startTime: number;
    endTime: number;
  } | null>(null);
  
  // Delete prompt state (inline, not modal)
  const [showDeletePrompt, setShowDeletePrompt] = useState<{
    columnKey: string;
    blockId: string;
  } | null>(null);
  
  // Brush mode state
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  const dragOpacity = useRef(new Animated.Value(0)).current;
  
  // Constants
  const dayColumnWidth = 160;
  const timeSlotHeight = 40;
  const timeColumnWidth = 80;
  const totalHours = 18; // 6 AM to 12 AM (midnight)
  const slotsPerHour = 2; // 30-minute slots
  const totalSlots = totalHours * slotsPerHour;

  // Generate day columns
  const generateDayColumns = (startDate: Date): DayColumn[] => {
    const columns: DayColumn[] = [];
    for (let i = 0; i < 14; i++) { // 2 weeks
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      columns.push({
        date,
        key: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === new Date().toDateString(),
        availabilityBlocks: [],
        eventBlocks: [],
      });
    }
    return columns;
  };

  // Generate time slots
  const generateTimeSlots = () => {
    const slots = [];
    for (let i = 0; i < totalSlots; i++) {
      const hour = Math.floor(i / 2) + 6;
      const minute = (i % 2) * 30;
      const displayTime = hour === 0 ? `12:${minute.toString().padStart(2, '0')} AM`
        : hour === 12 ? `12:${minute.toString().padStart(2, '0')} PM`
        : hour > 12 ? `${hour - 12}:${minute.toString().padStart(2, '0')} PM`
        : `${hour}:${minute.toString().padStart(2, '0')} AM`;
      
      slots.push({
        index: i,
        hour,
        minute,
        displayTime: minute === 0 ? displayTime : '', // Only show full hours
        isFullHour: minute === 0,
      });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Initialize day columns
  useEffect(() => {
    setDayColumns(generateDayColumns(currentWeekStart));
  }, [currentWeekStart]);

  // Load availability data when modal opens or week changes
  useEffect(() => {
    if (visible) {
      loadAvailabilityData();
    }
  }, [visible, groupId, currentWeekStart]);

  // Convert time slot index to hour (6 AM = 0, 6:30 AM = 1, etc.)
  const timeSlotToHour = (timeSlotIndex: number): number => {
    return 6 + (timeSlotIndex * 0.5);
  };

  // Convert hour to time slot index
  const hourToTimeSlot = (hour: number): number => {
    return (hour - 6) * 2;
  };

  // Load availability data from server
  const loadAvailabilityData = async () => {
    try {
      const startDate = currentWeekStart.toISOString().split('T')[0];
      const endDate = new Date(currentWeekStart.getTime() + 13 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { availability } = await GroupService.getGroupAvailability(groupId, startDate, endDate);
      
      // Convert server data to client format
      const deviceId = await DeviceIdManager.getDeviceId();
      
      setDayColumns(prev => prev.map(column => {
        const dayAvailability = availability.filter(member => 
          member.slots.some((slot: any) => slot.date === column.key)
        );
        
        const availabilityBlocks: AvailabilityBlock[] = [];
        
        dayAvailability.forEach(member => {
          member.slots.forEach((slot: any) => {
            if (slot.date === column.key) {
              const startTime = hourToTimeSlot(slot.startHour);
              const endTime = hourToTimeSlot(slot.endHour);
              
              availabilityBlocks.push({
                id: `server_${slot.id}`,
                serverId: slot.id,
                startTime,
                endTime,
                memberId: member.deviceId === deviceId ? 'current-user' : member.memberId,
                type: 'availability'
              });
            }
          });
        });
        
        return {
          ...column,
          availabilityBlocks: combineBlocks(availabilityBlocks)
        };
      }));
    } catch (error) {
      console.error('Failed to load availability data:', error);
    }
  };

  // Save current user's availability for a specific day to server
  const saveAvailabilityToServer = async (columnKey: string) => {
    try {
      const column = dayColumns.find(col => col.key === columnKey);
      if (!column) return;

      // Get current user's blocks for this day
      const userBlocks = column.availabilityBlocks.filter(block => block.memberId === 'current-user');
      
      // Convert to server format
      const slots = userBlocks.map(block => ({
        date: columnKey,
        startHour: timeSlotToHour(block.startTime),
        endHour: timeSlotToHour(block.endTime)
      }));

      await GroupService.saveUserAvailability(groupId, slots);
    } catch (error) {
      console.error('Failed to save availability to server:', error);
      throw error;
    }
  };

  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => {
      const newStart = new Date(prev);
      newStart.setDate(prev.getDate() - 7);
      return newStart;
    });
    // Data will reload due to useEffect dependency on currentWeekStart
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(prev => {
      const newStart = new Date(prev);
      newStart.setDate(prev.getDate() + 7);
      return newStart;
    });
    // Data will reload due to useEffect dependency on currentWeekStart
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentWeekStart(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    // Data will reload due to useEffect dependency on currentWeekStart
  };

  // Combine touching blocks
  const combineBlocks = (blocks: AvailabilityBlock[]): AvailabilityBlock[] => {
    if (blocks.length === 0) return blocks;
    
    // Sort blocks by start time
    const sorted = [...blocks].sort((a, b) => a.startTime - b.startTime);
    const combined: AvailabilityBlock[] = [];
    let current = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      
      // Check if blocks touch or overlap (same member)
      if (current.memberId === next.memberId && current.endTime >= next.startTime) {
        // Combine blocks
        current = {
          ...current,
          endTime: Math.max(current.endTime, next.endTime),
        };
      } else {
        combined.push(current);
        current = next;
      }
    }
    
    combined.push(current);
    return combined;
  };

  // Create availability block in a column
  const createAvailabilityBlock = async (columnKey: string, startTime: number, endTime: number) => {
    const newBlock: AvailabilityBlock = {
      id: `avail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime,
      endTime,
      memberId: 'current-user',
      type: 'availability',
    };

    // Update UI immediately
    setDayColumns(prev => prev.map(column => {
      if (column.key === columnKey) {
        // Remove overlapping blocks from current user
        const filteredBlocks = column.availabilityBlocks.filter(block => 
          !(block.memberId === 'current-user' &&
            ((block.startTime >= startTime && block.startTime < endTime) ||
             (block.endTime > startTime && block.endTime <= endTime) ||
             (block.startTime <= startTime && block.endTime >= endTime)))
        );
        
        // Add new block and combine touching blocks
        const allBlocks = [...filteredBlocks, newBlock];
        const userBlocks = allBlocks.filter(block => block.memberId === 'current-user');
        const otherBlocks = allBlocks.filter(block => block.memberId !== 'current-user');
        const combinedUserBlocks = combineBlocks(userBlocks);
        
        return {
          ...column,
          availabilityBlocks: [...otherBlocks, ...combinedUserBlocks]
        };
      }
      return column;
    }));

    // Sync with server
    try {
      await saveAvailabilityToServer(columnKey);
    } catch (error) {
      console.error('Failed to save availability to server:', error);
      // Could add error handling/retry logic here
    }
  };

  // Delete availability block
  const deleteAvailabilityBlock = async (columnKey: string, blockId: string) => {
    // Update UI immediately
    setDayColumns(prev => prev.map(column => {
      if (column.key === columnKey) {
        return {
          ...column,
          availabilityBlocks: column.availabilityBlocks.filter(block => block.id !== blockId)
        };
      }
      return column;
    }));

    // Sync with server
    try {
      await saveAvailabilityToServer(columnKey);
    } catch (error) {
      console.error('Failed to delete availability on server:', error);
      // Could add error handling/retry logic here
    }
  };

  // Handle block tap
  const handleBlockTap = (columnKey: string, blockId: string) => {
    setShowDeletePrompt({ columnKey, blockId });
  };

  // Confirm delete
  const confirmDelete = () => {
    if (showDeletePrompt) {
      deleteAvailabilityBlock(showDeletePrompt.columnKey, showDeletePrompt.blockId);
    }
    setShowDeletePrompt(null);
  };

  // Cancel delete or dismiss prompt
  const dismissDeletePrompt = () => {
    setShowDeletePrompt(null);
  };

  // Store column refs for measuring
  const columnRefs = useRef<{[key: string]: View | null}>({});

  // Handle touch events for drag functionality
  const handleTouchStart = (columnKey: string, evt: any) => {
    if (!isBrushMode && !isDeleteMode) return;
    
    const touch = evt.nativeEvent.touches[0];
    const { pageY } = touch;
    const columnRef = columnRefs.current[columnKey];
    
    if (!columnRef) return;
    
    columnRef.measure((x, y, width, height, pageX, pageYOffset) => {
      const relativeY = pageY - pageYOffset;
      const startTimeIndex = Math.floor(relativeY / timeSlotHeight);
      
      if (startTimeIndex >= 0 && startTimeIndex < totalSlots) {
        setShowDeletePrompt(null);
        
        if (isDeleteMode) {
          // Delete mode: check if there's a block at this position and delete it
          const column = dayColumns.find(col => col.key === columnKey);
          if (column) {
            const blockToDelete = column.availabilityBlocks.find(block => 
              block.memberId === 'current-user' && 
              startTimeIndex >= block.startTime && 
              startTimeIndex < block.endTime
            );
            
            if (blockToDelete) {
              deleteAvailabilityBlock(columnKey, blockToDelete.id);
            }
          }
        } else {
          // Brush mode: start dragging to create blocks
          setIsDragging(true);
          setDragColumn(columnKey);
          setDragPreview({
            columnKey,
            startTime: startTimeIndex,
            endTime: startTimeIndex + 1,
          });
          
          Animated.timing(dragOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      }
    });
  };

  const handleTouchMove = (columnKey: string, evt: any) => {
    if (!isDragging || !dragPreview || dragColumn !== columnKey) return;
    
    const touch = evt.nativeEvent.touches[0];
    const { pageY } = touch;
    const columnRef = columnRefs.current[columnKey];
    
    if (!columnRef) return;
    
    columnRef.measure((x, y, width, height, pageX, pageYOffset) => {
      const relativeY = pageY - pageYOffset;
      const currentTimeIndex = Math.floor(relativeY / timeSlotHeight);
      
      if (currentTimeIndex >= 0 && currentTimeIndex < totalSlots) {
        const originalStartTime = dragPreview.startTime;
        const finalStartTime = Math.min(originalStartTime, currentTimeIndex);
        const finalEndTime = Math.max(originalStartTime + 1, currentTimeIndex + 1);
        
        setDragPreview(prev => prev ? {
          ...prev,
          startTime: finalStartTime,
          endTime: finalEndTime,
        } : null);
      }
    });
  };

  const handleTouchEnd = async (columnKey: string) => {
    if (dragPreview && dragColumn === columnKey) {
      await createAvailabilityBlock(columnKey, dragPreview.startTime, dragPreview.endTime);
    }
    
    setIsDragging(false);
    setDragColumn(null);
    setDragPreview(null);
    
    Animated.timing(dragOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  // Render a single day column
  const renderDayColumn = (column: DayColumn, index: number) => {
    const isCurrentDragColumn = dragColumn === column.key;
    
    return (
      <View key={column.key} style={[
        styles.dayColumn, 
        column.isToday && styles.todayColumn,
        isBrushMode && styles.dayColumnBrushMode
      ]}>
        {/* Day Header */}
        <View style={[
          styles.dayHeader,
          isBrushMode && styles.dayHeaderBrushMode
        ]}>
          <Text style={[styles.dayName, column.isToday && styles.todayText]}>{column.dayName}</Text>
          <Text style={[styles.dayNumber, column.isToday && styles.todayText]}>{column.dayNumber}</Text>
          <Text style={[styles.monthName, column.isToday && styles.todayText]}>{column.monthName}</Text>
          {isBrushMode && (
            <View style={styles.brushIndicator}>
              <Ionicons name="brush" size={12} color="#22c55e" />
            </View>
          )}
        </View>
        
        {/* Column Content - Time Slots */}
        <View 
          ref={(ref) => { columnRefs.current[column.key] = ref; }}
          style={styles.columnContent}
          onStartShouldSetResponder={() => isBrushMode || isDeleteMode}
          onResponderGrant={(evt) => handleTouchStart(column.key, evt)}
          onResponderMove={(evt) => handleTouchMove(column.key, evt)}
          onResponderRelease={() => handleTouchEnd(column.key)}
        >
          {/* Invisible overlay for dismissing delete prompts */}
          {showDeletePrompt && (
            <TouchableOpacity
              style={styles.dismissOverlay}
              onPress={dismissDeletePrompt}
              activeOpacity={1}
            />
          )}
          {/* Background Time Slots */}
          {timeSlots.map((timeSlot) => (
            <View
              key={timeSlot.index}
              style={[
                styles.timeSlotBackground,
                timeSlot.isFullHour && styles.hourBorder,
              ]}
            />
          ))}
          
          {/* Availability Blocks */}
          {column.availabilityBlocks.map((block) => {
            const isShowingDeletePrompt = showDeletePrompt?.columnKey === column.key && showDeletePrompt?.blockId === block.id;
            
            return (
              <TouchableOpacity
                key={block.id}
                style={[
                  styles.availabilityBlock,
                  {
                    top: block.startTime * timeSlotHeight,
                    height: (block.endTime - block.startTime) * timeSlotHeight,
                  },
                  isShowingDeletePrompt && styles.availabilityBlockWithPrompt,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleBlockTap(column.key, block.id);
                }}
                activeOpacity={0.8}
              >
                {isShowingDeletePrompt ? (
                  <View style={styles.deletePromptContainer}>
                    <TouchableOpacity
                      style={styles.deletePromptButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmDelete();
                      }}
                    >
                      <Ionicons name="trash" size={14} color="#ffffff" />
                      <Text style={styles.deletePromptText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.blockText}>Available</Text>
                )}
              </TouchableOpacity>
            );
          })}
          
          {/* Event Blocks */}
          {column.eventBlocks.map((block) => (
            <View
              key={block.id}
              style={[
                styles.eventBlock,
                {
                  top: block.startTime * timeSlotHeight,
                  height: (block.endTime - block.startTime) * timeSlotHeight,
                }
              ]}
            >
              <Text style={styles.blockText}>{block.title}</Text>
            </View>
          ))}
          
          {/* Drag Preview */}
          {isCurrentDragColumn && dragPreview && (
            <Animated.View
              style={[
                styles.dragPreviewBlock,
                {
                  opacity: dragOpacity,
                  top: dragPreview.startTime * timeSlotHeight,
                  height: (dragPreview.endTime - dragPreview.startTime) * timeSlotHeight,
                }
              ]}
            >
            </Animated.View>
          )}
        </View>
      </View>
    );
  };

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
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Calendar</Text>
            <Text style={styles.headerSubtitle}>{groupName}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Navigation */}
        <View style={styles.navigationHeader}>
          <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.brushButtonContainer}>
            <TouchableOpacity 
              onPress={() => {
                setIsBrushMode(!isBrushMode);
                setIsDeleteMode(false);
              }} 
              style={[styles.brushButton, isBrushMode && styles.brushButtonActive]}
            >
              <Ionicons 
                name={isBrushMode ? "brush" : "brush-outline"} 
                size={16} 
                color={isBrushMode ? "#ffffff" : "#9ca3af"} 
              />
              <Text style={[styles.brushButtonText, isBrushMode && styles.brushButtonTextActive]}>
                Add
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => {
                setIsDeleteMode(!isDeleteMode);
                setIsBrushMode(false);
              }} 
              style={[styles.brushButton, styles.deleteButton, isDeleteMode && styles.deleteButtonActive]}
            >
              <Ionicons 
                name={isDeleteMode ? "trash" : "trash-outline"} 
                size={16} 
                color={isDeleteMode ? "#ffffff" : "#9ca3af"} 
              />
              <Text style={[styles.brushButtonText, isDeleteMode && styles.deleteButtonTextActive]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Calendar Container */}
        <View style={styles.calendarContainer}>
          {/* Time Labels Column */}
          <View style={styles.timeLabelsColumn}>
            {timeSlots.map((timeSlot) => (
              <View key={timeSlot.index} style={styles.timeSlotLabel}>
                {timeSlot.isFullHour && (
                  <Text style={styles.timeText}>{timeSlot.displayTime}</Text>
                )}
              </View>
            ))}
          </View>

          {/* Horizontally Scrollable Day Columns */}
          <ScrollView
            ref={horizontalScrollRef}
            style={styles.columnsScrollView}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.columnsContainer}
            scrollEnabled={!isDragging}
          >
            {dayColumns.map((column, index) => renderDayColumn(column, index))}
          </ScrollView>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            {isBrushMode 
              ? "Add mode: Drag in columns to add availability"
              : isDeleteMode
              ? "Delete mode: Tap blocks to delete them"
              : "Select Add or Delete mode to edit availability"
            }
          </Text>
        </View>
      </View>
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
  headerRight: {
    width: 40,
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brushButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brushButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  brushButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  deleteButton: {
    backgroundColor: '#2a2a2a',
  },
  deleteButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
  },
  brushButtonText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    marginLeft: 4,
  },
  brushButtonTextActive: {
    color: '#ffffff',
  },
  deleteButtonTextActive: {
    color: '#ffffff',
  },
  calendarContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  timeLabelsColumn: {
    width: 80,
    backgroundColor: '#1a1a1a',
    borderRightWidth: 1,
    borderRightColor: '#2a2a2a',
    paddingTop: 60, // Space for day headers
  },
  timeSlotLabel: {
    height: 40,
    justifyContent: 'center',
    paddingRight: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'right',
  },
  columnsScrollView: {
    flex: 1,
  },
  columnsContainer: {
    flexDirection: 'row',
  },
  dayColumn: {
    width: 160,
    backgroundColor: '#1a1a1a',
    borderRightWidth: 1,
    borderRightColor: '#2a2a2a',
  },
  dayColumnBrushMode: {
    borderRightColor: '#22c55e',
    borderRightWidth: 2,
  },
  todayColumn: {
    backgroundColor: '#1e293b',
    borderRightColor: '#2563eb',
  },
  dayHeader: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 2,
    borderBottomColor: '#3a3a3a',
    position: 'relative',
  },
  dayHeaderBrushMode: {
    borderBottomColor: '#22c55e',
  },
  brushIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  dayName: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 2,
  },
  monthName: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 1,
  },
  todayText: {
    color: '#ffffff',
  },
  columnContent: {
    flex: 1,
    position: 'relative',
  },
  dismissOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  timeSlotBackground: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    backgroundColor: 'transparent',
  },
  hourBorder: {
    borderBottomColor: '#3a3a3a',
    borderBottomWidth: 2,
  },
  availabilityBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 2,
  },
  availabilityBlockWithPrompt: {
    backgroundColor: '#dc2626',
    borderColor: '#b91c1c',
    shadowColor: '#dc2626',
  },
  deletePromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletePromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  deletePromptText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 4,
  },
  eventBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dragPreviewBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#16a34a',
    borderStyle: 'dashed',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  blockText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
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
  debugText: {
    fontSize: 10,
    color: '#ffffff',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 2,
    borderRadius: 4,
  },
});

export default CalendarModal;