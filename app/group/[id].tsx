import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  RefreshControl,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroups } from '@/contexts/GroupsContext';
import { ApiService } from '@/services/api';
import InviteModal from '@/components/InviteModal';
import ProfileSetupModal from '@/components/ProfileSetupModal';
import GroupMembersModal from '@/components/GroupMembersModal';
import EventCustomizationModal from '@/components/EventCustomizationModal';
import ExpenseBlock from '@/components/ExpenseBlock';
import { calendarCache } from '@/utils/calendarCache';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { isFeatureEnabled } from '@/config/features';

interface GroupPermissions {
  is_member: boolean;
  is_creator: boolean;
  role: string;
  permissions: {
    can_invite: boolean;
    can_leave: boolean;
    can_delete_group: boolean;
  };
}

interface GroupProfile {
  username: string | null;
  profile_picture: string | null;
  has_username: boolean;
}

interface GroupMember {
  member_id: string;
  device_id: string;
  role: string;
  username?: string;
  profile_picture?: string;
  has_username: boolean;
}

const { width } = Dimensions.get('window');
const squareSize = (width - 48) / 2; // Account for padding and gap

export default function GroupDetailScreen() {
  const { id, pendingEvent } = useLocalSearchParams();
  const { getGroup, loadGroups, updateGroupAccess } = useGroups();
  const insets = useSafeAreaInsets();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [permissions, setPermissions] = useState<GroupPermissions | null>(null);
  const [groupProfile, setGroupProfile] = useState<GroupProfile | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [isEditingFromMembers, setIsEditingFromMembers] = useState(false);
  const [pendingEventData, setPendingEventData] = useState<any>(null);
  const [groupEvents, setGroupEvents] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  
  const group = getGroup(id as string);
  
  // Chat notifications - only track messages for notification badge
  const { messages: chatMessages, isConnected, isLoading, error } = isFeatureEnabled('REALTIME_CHAT') 
    ? useRealtimeChat({
        roomType: 'group',
        roomId: id as string,
        enabled: true,
      })
    : { messages: [], isConnected: false, isLoading: false, error: null };

  const appStateRef = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);
  
  // Initialize lastSeenMessageId when messages first load (mark all as read initially)
  useEffect(() => {
    if (chatMessages.length > 0 && !lastSeenMessageId) {
      const mostRecentMessage = chatMessages[chatMessages.length - 1];
      setLastSeenMessageId(mostRecentMessage.id);
    }
  }, [chatMessages, lastSeenMessageId]);

  // Get latest message for preview
  const latestMessage = useMemo(() => {
    if (chatMessages.length === 0) return null;
    return chatMessages[chatMessages.length - 1];
  }, [chatMessages]);

  // Calculate unread messages count
  const unreadCount = useMemo(() => {
    if (!lastSeenMessageId || chatMessages.length === 0) {
      // If no lastSeen is set, show 0 unread (not all messages as unread)
      return 0;
    }
    
    const lastSeenIndex = chatMessages.findIndex(msg => msg.id === lastSeenMessageId);
    if (lastSeenIndex === -1) {
      // If lastSeen message not found, all current messages are unread
      const count = chatMessages.length;
      return count;
    }
    
    // Count messages after the last seen message
    const count = chatMessages.length - (lastSeenIndex + 1);
    return Math.max(0, count); // Ensure non-negative
  }, [chatMessages, lastSeenMessageId]);
  
  // Handle chat button press - clear notifications
  const handleChatPress = () => {
    // Mark all messages as seen before opening chat
    if (chatMessages.length > 0) {
      const latestMessageId = chatMessages[chatMessages.length - 1].id;
      setLastSeenMessageId(latestMessageId);
    }
    
    router.push({
      pathname: '/group-chat',
      params: { 
        groupId: id as string,
        groupName: group.name,
        currentUsername: groupProfile?.username
      }
    });
  };
  
  useEffect(() => {
    if (id) {
      // Update group access time when opening
      updateGroupAccess(id as string);
      
      fetchInviteCode();
      fetchPermissions();
      fetchGroupProfile();
      fetchMembers();
      fetchGroupEvents();
      getCurrentDeviceId();
      
      // Preload calendar data for faster calendar loading
      calendarCache.preloadCalendarData(new Date());
    }
  }, [id, updateGroupAccess]);

  useEffect(() => {
    // Handle pending event from navigation
    if (pendingEvent) {
      try {
        const eventData = JSON.parse(pendingEvent as string);
        setPendingEventData(eventData);
        setShowEventModal(true);
      } catch (error) {
      }
    }
  }, [pendingEvent]);

  // Clear notifications when returning from chat screen
  // (Removed auto-clear on focus - let user manually clear by opening chat)

  // Handle app state changes - force refresh after long background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is going to background - record the time
        backgroundTimeRef.current = Date.now();
      } else if (nextAppState === 'active' && backgroundTimeRef.current) {
        // App came to foreground - check how long it was in background
        const backgroundDuration = Date.now() - backgroundTimeRef.current;
        const LONG_BACKGROUND_THRESHOLD = 30000; // 30 seconds
        
        
        if (backgroundDuration > LONG_BACKGROUND_THRESHOLD) {
          
          // Force complete refresh of all data (like opening the screen fresh)
          handleRefresh();
        }
        
        backgroundTimeRef.current = null;
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const getCurrentDeviceId = async () => {
    try {
      const { DeviceIdManager } = await import('@/utils/deviceId');
      const deviceId = await DeviceIdManager.getDeviceId();
      setCurrentDeviceId(deviceId);
    } catch (error) {
    }
  };

  const fetchInviteCode = async () => {
    try {
      const groupData = await ApiService.getGroup(id as string);
      if (groupData.invite_code) {
        setInviteCode(groupData.invite_code);
      }
    } catch (error) {
    }
  };

  const fetchPermissions = async () => {
    try {
      const permissionsData = await ApiService.getPermissions(id as string);
      setPermissions(permissionsData);
    } catch (error) {
    }
  };

  const fetchGroupProfile = async () => {
    try {
      const profileData = await ApiService.getGroupProfile(id as string);
      setGroupProfile(profileData);
      
      // Check if user needs to set profile for this group
      // Show modal if no username OR no color
      if (!profileData.has_username || !profileData.has_color) {
        
        // Fetch latest member colors to prevent race conditions
        await fetchMembers();
        
        setShowProfileModal(true);
      }
    } catch (error) {
    }
  };

  const fetchMembers = async () => {
    try {
      const membersData = await ApiService.getGroupMembers(id as string);
      setMembers(membersData);
    } catch (error) {
    }
  };

  const fetchGroupEvents = async () => {
    try {
      const eventsData = await ApiService.getGroupEvents(id as string);
      setGroupEvents(eventsData.events || []);
    } catch (error) {
    }
  };


  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadGroups(); // Refresh the groups list
      await fetchInviteCode(); // Refresh invite code
      await fetchPermissions(); // Refresh permissions
      await fetchGroupProfile(); // Refresh group profile
      await fetchMembers(); // Refresh members
      await fetchGroupEvents(); // Refresh group events
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProfileSetup = async (username: string, profilePicture: string, color?: string) => {
    // Close modal immediately
    setShowProfileModal(false);
    
    try {
      await ApiService.updateGroupProfile(id as string, { username, profile_picture: profilePicture, color });
      
      // Update local state instead of refreshing to prevent modal from reappearing
      setGroupProfile(prev => ({
        ...prev,
        username,
        color,
        has_username: true,
        has_color: true
      }));
      
      // Refresh members to show updated username in members list
      await fetchMembers();
    } catch (error) {
    }
  };


  const handleEditUsername = async () => {
    setIsEditingFromMembers(true);
    setShowMembersModal(false);
    
    // Fetch latest member colors to prevent race conditions
    await fetchMembers();
    
    setShowProfileModal(true);
  };

  const handleProfileComplete = async (username: string, profilePicture: string, color?: string) => {
    // Close modal immediately
    setShowProfileModal(false);
    
    // Also close members modal if we came from there
    if (isEditingFromMembers) {
      setShowMembersModal(false);
      setIsEditingFromMembers(false);
    }
    
    try {
      await ApiService.updateGroupProfile(id as string, { username, profile_picture: profilePicture, color });
      
      // Refresh all data to show updated username everywhere
      await handleRefresh();
    } catch (error) {
    }
  };

  const handleEventSave = async (customName: string, originalEvent: any) => {
    try {
      
      // Save event to group via API
      await ApiService.saveEventToGroup(id as string, customName, originalEvent);
      
      // Close the modal and clear pending data
      setShowEventModal(false);
      setPendingEventData(null);
      
      // Clear the pendingEvent param from the URL
      router.replace({ pathname: '/group/[id]', params: { id: id as string } });
      
      // Refresh the group to show the new event
      await handleRefresh();
      
    } catch (error) {
    }
  };
  
  const generateInviteLink = (groupId: string) => {
    return inviteCode ? `https://group-event.vercel.app/join/${inviteCode}` : '';
  };

  const handleLeaveGroup = () => {
    setShowLeaveModal(true);
  };

  const confirmLeaveGroup = async () => {
    setShowLeaveModal(false);
    try {
      await ApiService.leaveGroup(id as string);
      await loadGroups(); // Refresh groups list
      router.push('/(tabs)'); // Navigate to groups home screen
    } catch (error: any) {
      // Could add error handling here if needed
    }
  };
  
  if (!group) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Group not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const sampleEvents: any[] = [];

  // Helper function to parse date range from event description
  const parseEventDateRange = (event: any): { startDate: string, endDate: string | null, isMultiDay: boolean } => {
    const description = event.original_event_data?.description || '';
    const mainDate = event.original_event_data?.date;
    
    // Check if description contains multi-day event marker
    const multiDayMatch = description.match(/📅 Multi-day event: (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
    
    if (multiDayMatch) {
      return {
        startDate: multiDayMatch[1],
        endDate: multiDayMatch[2],
        isMultiDay: true
      };
    }
    
    return {
      startDate: mainDate,
      endDate: null,
      isMultiDay: false
    };
  };

  // Helper function to format date range for display
  const formatDateRangeDisplay = (startDate: string, endDate: string | null): string => {
    if (!startDate) return '';
    
    const formatDisplayDate = (dateStr: string): string => {
      const date = new Date(dateStr + 'T00:00:00'); // Ensure local time
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      // Reset time for comparison
      today.setHours(0, 0, 0, 0);
      tomorrow.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      
      if (date.getTime() === today.getTime()) {
        return 'Today';
      } else if (date.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
      } else {
        return date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric' 
        });
      }
    };
    
    if (!endDate || endDate === startDate) {
      return formatDisplayDate(startDate);
    }
    
    const startDisplay = formatDisplayDate(startDate);
    const endDisplay = formatDisplayDate(endDate);
    
    return `${startDisplay} - ${endDisplay}`;
  };

  // Helper function to format event dates (same as calendar)
  const formatEventDate = (dateString: string): string | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    
    try {
      let date: Date;
      
      if (dateString.includes('FALLBACK')) {
        const match = dateString.match(/(\w+),?\s+(\w+)\s+(\d+)/);
        if (match) {
          const [, , monthName, day] = match;
          const currentYear = new Date().getFullYear();
          date = new Date(`${monthName} ${day}, ${currentYear}`);
        } else {
          return null;
        }
      } else {
        // Parse date as local time to avoid timezone issues
        if (dateString.includes('T') || dateString.includes('Z')) {
          // If it's an ISO string, convert to local date
          date = new Date(dateString);
        } else {
          // If it's a date string like "2024-07-28", parse as local
          const parts = dateString.split('-');
          if (parts.length === 3) {
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else {
            date = new Date(dateString);
          }
        }
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      return null;
    }
  };

  // Get next 5 days (today + 4) with multi-day event detection
  const getNext5Days = () => {
    const days = [];
    const today = new Date();
    
    // First, collect all multi-day events that span across our 5-day window
    const multiDayEventRanges = groupEvents
      .map(event => {
        const range = parseEventDateRange(event);
        if (range.isMultiDay && range.endDate) {
          return {
            ...event,
            ...range,
            title: event.custom_name || event.original_event_data?.name || 'Event',
            color: event.created_by_color || '#4f8cd9'
          };
        }
        return null;
      })
      .filter(Boolean);
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumber = date.getDate();
      
      // Create date string in local time (not UTC)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      // Find single-day events for this date
      const dayEvents = groupEvents.filter(event => {
        const eventDate = formatEventDate(event.original_event_data?.date);
        const range = parseEventDateRange(event);
        return eventDate === dateString && !range.isMultiDay;
      });
      
      // Find multi-day events that include this date
      const multiDayEvents = multiDayEventRanges.filter(event => {
        if (!event) return false;
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        const currentDate = new Date(dateString);
        return currentDate >= startDate && currentDate <= endDate;
      });
      
      // Check if this day should connect to adjacent days for multi-day events
      const connectLeft = i > 0 && multiDayEvents.some(event => {
        if (!event) return false;
        const prevDate = new Date(today);
        prevDate.setDate(today.getDate() + i - 1);
        const prevDateString = prevDate.toISOString().split('T')[0];
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        const prevDateTime = new Date(prevDateString);
        return prevDateTime >= startDate && prevDateTime <= endDate;
      });
      
      const connectRight = i < 4 && multiDayEvents.some(event => {
        if (!event) return false;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + i + 1);
        const nextDateString = nextDate.toISOString().split('T')[0];
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        const nextDateTime = new Date(nextDateString);
        return nextDateTime >= startDate && nextDateTime <= endDate;
      });
      
      // Create abbreviations for all events and sort them (multi-day first)
      const allEvents = [...dayEvents, ...multiDayEvents];
      const eventsWithAbbreviations = allEvents
        .map(event => {
          const title = event.custom_name || event.original_event_data?.name || event.title || 'Event';
          const abbreviation = title.substring(0, 20);
          
          return {
            ...event,
            abbreviation,
            color: event.created_by_color || event.color || '#60a5fa',
            isMultiDay: parseEventDateRange(event).isMultiDay
          };
        })
        .sort((a, b) => {
          // Multi-day events first, then single-day events
          if (a.isMultiDay && !b.isMultiDay) return -1;
          if (!a.isMultiDay && b.isMultiDay) return 1;
          return 0; // Keep original order within same type
        });
      
      // Get the color of the first multi-day event for connections
      const firstMultiDayEvent = eventsWithAbbreviations.find(e => e.isMultiDay);
      const connectionColor = firstMultiDayEvent?.color || '#4f8cd9';
      
      days.push({
        dayName,
        dayNumber,
        hasEvents: allEvents.length > 0,
        eventCount: allEvents.length,
        dateString,
        events: eventsWithAbbreviations,
        connectLeft,
        connectRight,
        multiDayEvents: multiDayEvents.length,
        connectionColor
      });
    }
    
    return days;
  };

  // Get upcoming events (next 5 days)
  const getUpcomingEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate day comparison
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 5);
    nextWeek.setHours(23, 59, 59, 999); // End of the 5th day
    
    return groupEvents
      .filter(event => {
        const eventDateString = formatEventDate(event.original_event_data?.date);
        if (!eventDateString) return false;
        
        // Parse the event date as local time to match our date formatting
        const parts = eventDateString.split('-');
        if (parts.length !== 3) return false;
        
        const eventDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        eventDate.setHours(0, 0, 0, 0);
        
        return eventDate >= today && eventDate <= nextWeek;
      })
      .sort((a, b) => {
        // Parse date ranges for both events
        const rangeA = parseEventDateRange(a);
        const rangeB = parseEventDateRange(b);
        
        // Calculate duration for each event (multi-day vs single day)
        const getDuration = (range: { startDate: string, endDate: string | null, isMultiDay: boolean }) => {
          if (!range.isMultiDay || !range.endDate) return 1;
          const start = new Date(range.startDate);
          const end = new Date(range.endDate);
          return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        };
        
        const durationA = getDuration(rangeA);
        const durationB = getDuration(rangeB);
        
        // Sort by duration first (longer events first), then by start date
        if (durationA !== durationB) {
          return durationB - durationA; // Higher duration first
        }
        
        // Same duration, sort by start date
        const dateA = new Date(rangeA.startDate);
        const dateB = new Date(rangeB.startDate);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 2); // Show max 2 upcoming events
  };

  const FiveDayPreview = () => {
    const next5Days = getNext5Days();
    
    
    return (
      <View style={styles.sevenDayPreview}>
        {/* Header with Calendar Button */}
        <TouchableOpacity 
          style={styles.calendarHeader}
          activeOpacity={0.8}
          onPress={() => router.push({
            pathname: '/calendar',
            params: { groupId: id }
          })}
        >
          <Ionicons name="calendar" size={20} color="#60a5fa" />
          <Text style={styles.calendarHeaderText}>Calendar</Text>
          <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
        </TouchableOpacity>
        
        <View style={styles.sevenDayPreviewContent}>
          {/* Day headers and single-day events */}
          {next5Days.map((day, index) => (
            <TouchableOpacity 
              key={index}
              style={[
                styles.dayPreviewItem,
                index === 0 && styles.dayPreviewToday
              ]}
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                
                // If only one event, go directly to event screen; otherwise go to date list
                if (day.eventCount === 1) {
                  // Find the single event for this day
                  const dayEvents = groupEvents.filter(event => {
                    const eventDate = formatEventDate(event.original_event_data?.date);
                    return eventDate === day.dateString;
                  });
                  
                  if (dayEvents.length === 1) {
                    const event = dayEvents[0];
                    router.push({
                      pathname: '/event-detail',
                      params: {
                        event: JSON.stringify({
                          id: event.id,
                          name: event.custom_name || event.original_event_data?.name || 'Untitled Event',
                          date: event.original_event_data?.date || '',
                          time: event.original_event_data?.time || '',
                          description: event.original_event_data?.description || '',
                          distance: event.original_event_data?.venue?.name || event.original_event_data?.location || '',
                          price: event.original_event_data?.price || 'Free',
                          images: event.original_event_data?.images || []
                        })
                      }
                    });
                    return;
                  }
                }
                
                // Multiple events or fallback - go to date list
                router.push(`/date-events?date=${day.dateString}&groupId=${id}`);
              }}
            >
              <View style={[
                styles.dayPreviewHeader,
                index === 0 && styles.dayPreviewHeaderToday
              ]}>
                <Text style={[styles.dayPreviewName, index === 0 && styles.dayPreviewTodayText]}>{day.dayName}</Text>
                <Text style={[
                  styles.dayPreviewNumber,
                  index === 0 && styles.dayPreviewTodayText
                ]}>
                  {day.dayNumber}
                </Text>
              </View>
              <View style={styles.dayPreviewEventContainer}>
                {/* Render all events with proper spacing */}
                {(() => {
                  if (!day.events) return null;
                  
                  // Sort events by duration (longest multi-day first, then single-day)
                  const sortedEvents = [...day.events].sort((a, b) => {
                    // First separate multi-day from single-day
                    if (a.isMultiDay && !b.isMultiDay) return -1;
                    if (!a.isMultiDay && b.isMultiDay) return 1;
                    
                    // For multi-day events, sort by duration (longest first)
                    if (a.isMultiDay && b.isMultiDay) {
                      const rangeA = parseEventDateRange(a);
                      const rangeB = parseEventDateRange(b);
                      
                      const getDuration = (range) => {
                        if (!range.isMultiDay || !range.endDate) return 1;
                        const start = new Date(range.startDate);
                        const end = new Date(range.endDate);
                        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      };
                      
                      const durationA = getDuration(rangeA);
                      const durationB = getDuration(rangeB);
                      
                      return durationB - durationA; // Longer duration first
                    }
                    
                    return 0; // Keep original order for single-day events
                  });
                  
                  const eventsToShow = sortedEvents.slice(0, 3);
                  const hiddenEventCount = Math.max(0, day.events.length - 3);
                  
                  return (
                    <>
                      {eventsToShow.map((event, eventIndex) => {
                        // For multi-day events, show more text; for single-day, show abbreviation
                        const displayText = event.isMultiDay 
                          ? (event.custom_name || event.original_event_data?.name || event.title || 'Event').substring(0, 15)
                          : event.abbreviation;
                        
                        return (
                          <View 
                            key={eventIndex} 
                            style={[
                              styles.eventAbbreviation,
                              { backgroundColor: event.color }
                            ]}
                          >
                            <Text style={styles.eventAbbreviationText} numberOfLines={1}>
                              {displayText}
                            </Text>
                          </View>
                        );
                      })}
                      {hiddenEventCount > 0 && (
                        <View 
                          style={[
                            styles.eventAbbreviation,
                            { backgroundColor: '#666' }
                          ]}
                        >
                          <Text style={styles.eventAbbreviationText}>
                            +{hiddenEventCount}
                          </Text>
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const UpcomingEventsList = () => {
    const upcomingEvents = getUpcomingEvents();
    
    return (
      <View style={styles.upcomingEventsContainer}>
        <Text style={styles.upcomingEventsTitle}>Upcoming</Text>
        {upcomingEvents.length === 0 ? (
          <View style={styles.upcomingEventsEmpty}>
            <Text style={styles.upcomingEventsEmptyText}>No upcoming events</Text>
          </View>
        ) : (
          <View style={styles.upcomingEventsList}>
            {upcomingEvents.map((event, index) => {
          const originalEvent = event.original_event_data;
          const displayName = event.custom_name || originalEvent?.name || 'Untitled Event';
          const isLast = index === upcomingEvents.length - 1;
          
          // Use new date range logic
          const { startDate, endDate, isMultiDay } = parseEventDateRange(event);
          const dateRangeDisplay = formatDateRangeDisplay(startDate, endDate);
          
          // Format time
          let timeText = '';
          const timeString = originalEvent?.time;
          if (timeString && timeString !== 'No time') {
            let cleanTime = timeString.replace(/\.000Z?$/, '').replace(/:\d{2}\..*$/, '');
            if (!cleanTime.includes('AM') && !cleanTime.includes('PM')) {
              try {
                const timeDate = new Date(`1970-01-01T${cleanTime}`);
                if (!isNaN(timeDate.getTime())) {
                  cleanTime = timeDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                }
              } catch (e) {}
            }
            timeText = cleanTime;
          }
          
          const creatorColor = event.created_by_color || '#2a2a2a'; // Default to gray if no color
          
          return (
            <TouchableOpacity 
              key={event.id}
              style={[
                styles.upcomingEventItem,
                { borderLeftWidth: 3, borderLeftColor: creatorColor },
                isLast && { borderBottomWidth: 0 }
              ]}
              activeOpacity={0.7}
              onPress={() => {
                router.push({
                  pathname: '/event/[id]',
                  params: { 
                    id: event.id,
                    groupId: id as string
                  }
                });
              }}
            >
              <View style={styles.upcomingEventContent}>
                <View style={styles.upcomingEventHeader}>
                  <View style={styles.upcomingEventIcon}>
                    <Ionicons name="calendar-outline" size={16} color="#60a5fa" />
                  </View>
                  <Text style={styles.upcomingEventName}>{displayName}</Text>
                </View>
                <View style={styles.upcomingEventDateStack}>
                  <Text style={styles.upcomingEventDayOfWeek}>{dateRangeDisplay}</Text>
                  {isMultiDay && (
                    <Text style={styles.upcomingEventDaysText}>Multi-day event</Text>
                  )}
                  {timeText && (
                    <Text style={styles.upcomingEventTime}>{timeText}</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
            </TouchableOpacity>
          );
        })}
          </View>
        )}
      </View>
    );
  };

  const formatUserFriendlyDate = (dateString: string, timeString?: string): string => {
    if (!dateString || dateString === 'No date') return 'No date';
    
    try {
      // Parse date as local time to avoid timezone issues
      let eventDate: Date;
      if (dateString.includes('T') || dateString.includes('Z')) {
        // If it's an ISO string, convert to local date
        eventDate = new Date(dateString);
      } else {
        // If it's a date string like "2024-07-28", parse as local
        const parts = dateString.split('-');
        if (parts.length === 3) {
          eventDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          eventDate = new Date(dateString);
        }
      }
      
      if (isNaN(eventDate.getTime())) return dateString; // Return original if invalid
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time for accurate day comparison
      const eventDateOnly = new Date(eventDate);
      eventDateOnly.setHours(0, 0, 0, 0);
      
      // Calculate days difference
      const timeDiff = eventDateOnly.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      // Get day of week and readable date
      const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
      const readableDate = eventDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric'
      });
      
      let relativeText = '';
      if (daysDiff === 0) {
        relativeText = 'Today';
      } else if (daysDiff === 1) {
        relativeText = 'Tomorrow';
      } else if (daysDiff === -1) {
        relativeText = 'Yesterday';
      } else if (daysDiff > 1) {
        relativeText = `In ${daysDiff} days`;
      } else {
        relativeText = `${Math.abs(daysDiff)} days ago`;
      }
      
      // Format time, removing unnecessary zeros
      let timeText = '';
      if (timeString && timeString !== 'No time') {
        // Clean up time format - remove .000Z and unnecessary parts
        let cleanTime = timeString.replace(/\.000Z?$/, ''); // Remove .000Z
        cleanTime = cleanTime.replace(/:\d{2}\..*$/, ''); // Remove seconds and beyond
        
        // If it's already in 12-hour format, keep it; otherwise convert
        if (!cleanTime.includes('AM') && !cleanTime.includes('PM')) {
          try {
            const timeDate = new Date(`1970-01-01T${cleanTime}`);
            if (!isNaN(timeDate.getTime())) {
              cleanTime = timeDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
            }
          } catch (e) {
            // Keep original if conversion fails
          }
        }
        timeText = ` at ${cleanTime}`;
      }
      
      return `${relativeText} - ${dayOfWeek}, ${readableDate}${timeText}`;
    } catch (error) {
      return dateString; // Return original if any error
    }
  };

  const formatUpcomingEventDate = (dateString: string, timeString?: string): { dayOfWeek: string, daysText: string, timeText: string } => {
    if (!dateString || dateString === 'No date') return { dayOfWeek: 'No', daysText: 'date', timeText: '' };
    
    try {
      // Parse date as local time to avoid timezone issues
      let eventDate: Date;
      if (dateString.includes('T') || dateString.includes('Z')) {
        // If it's an ISO string, convert to local date
        eventDate = new Date(dateString);
      } else {
        // If it's a date string like "2024-07-28", parse as local
        const parts = dateString.split('-');
        if (parts.length === 3) {
          eventDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          eventDate = new Date(dateString);
        }
      }
      
      if (isNaN(eventDate.getTime())) return { dayOfWeek: dateString, daysText: '', timeText: '' };
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time for accurate day comparison
      const eventDateOnly = new Date(eventDate);
      eventDateOnly.setHours(0, 0, 0, 0);
      
      // Calculate days difference
      const timeDiff = eventDateOnly.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      // Get day of week
      const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      let dayText = '';
      let daysText = '';
      
      if (daysDiff === 0) {
        dayText = 'Today';
        daysText = '';
      } else if (daysDiff === 1) {
        dayText = 'Tomorrow';
        daysText = '';
      } else if (daysDiff === -1) {
        dayText = 'Yesterday';
        daysText = '';
      } else if (daysDiff > 1) {
        dayText = dayOfWeek;
        daysText = `${daysDiff} days`;
      } else {
        dayText = dayOfWeek;
        daysText = `${Math.abs(daysDiff)} days ago`;
      }
      
      // Format time, removing unnecessary zeros
      let timeText = '';
      if (timeString && timeString !== 'No time') {
        // Clean up time format - remove .000Z and unnecessary parts
        let cleanTime = timeString.replace(/\.000Z?$/, ''); // Remove .000Z
        cleanTime = cleanTime.replace(/:\d{2}\..*$/, ''); // Remove seconds and beyond
        
        // If it's already in 12-hour format, keep it; otherwise convert
        if (!cleanTime.includes('AM') && !cleanTime.includes('PM')) {
          try {
            const timeDate = new Date(`1970-01-01T${cleanTime}`);
            if (!isNaN(timeDate.getTime())) {
              cleanTime = timeDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
            }
          } catch (e) {
            // Keep original if conversion fails
          }
        }
        timeText = cleanTime;
      }
      
      return { dayOfWeek: dayText, daysText, timeText };
    } catch (error) {
      return { dayOfWeek: dateString, daysText: '', timeText: '' };
    }
  };

  const EventBlock = ({ event }: { event: any }) => {
    const originalEvent = event.original_event_data;
    const displayName = event.custom_name || originalEvent?.name || 'Untitled Event';
    const creatorColor = event.created_by_color || '#2a2a2a'; // Default to gray if no color
    
    const handleEventPress = () => {
      router.push({
        pathname: '/event/[id]',
        params: { 
          id: event.id,
          groupId: id as string
        }
      });
    };
    
    return (
      <TouchableOpacity 
        style={[styles.eventBlock, { borderColor: creatorColor }]} 
        activeOpacity={0.8} 
        onPress={handleEventPress}
      >
        <View style={styles.eventContent}>
          <View style={styles.eventLeft}>
            <View style={styles.eventIconContainer}>
              <Ionicons 
                name="calendar-outline" 
                size={20} 
                color="#60a5fa" 
              />
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventName}>{displayName}</Text>
              {event.custom_name && event.custom_name.trim() && (
                <Text style={styles.originalEventName}>{originalEvent?.name}</Text>
              )}
              <Text style={styles.eventDate}>
                {(() => {
                  // Use the date range logic for multi-day events
                  const { startDate, endDate, isMultiDay } = parseEventDateRange(event);
                  if (isMultiDay && endDate) {
                    const dateRangeDisplay = formatDateRangeDisplay(startDate, endDate);
                    return `${dateRangeDisplay}${originalEvent?.time && originalEvent.time !== 'No time' ? ` at ${originalEvent.time}` : ''}`;
                  } else {
                    return formatUserFriendlyDate(originalEvent?.date, originalEvent?.time);
                  }
                })()}
              </Text>
              <Text style={styles.eventParticipants}>
                Added by {event.created_by_username || 'Unknown'}
              </Text>
            </View>
          </View>
          <View style={styles.eventArrow}>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!group) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <View style={styles.leftButtons}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontSize: 16 }}>Loading group...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Extended Header with Back, Invite, and Leave */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.leftButtons}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <Ionicons name="refresh" size={20} color="#60a5fa" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerGroupInfo}>
            <Text style={styles.headerGroupName}>{group.name}</Text>
          </View>
          <View style={styles.headerButtons}>
            {permissions?.permissions?.can_invite && (
              <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
                <Text style={styles.inviteButtonText}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.headerMenuButton} onPress={() => setShowMembersModal(true)}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Secondary Header Bar - Chat Feature */}
      {isFeatureEnabled('REALTIME_CHAT') && (
        <View style={styles.secondaryHeaderContainer}>
          <View style={styles.secondaryHeader}>
            <View style={styles.messagePreviewSection}>
              {latestMessage ? (
                <View style={styles.recentMessageContainer} key={latestMessage.id}>
                  <Text style={styles.recentMessageSender}>
                    {latestMessage.username}:
                  </Text>
                  <Text style={styles.recentMessageText} numberOfLines={1}>
                    {latestMessage.message}
                  </Text>
                </View>
              ) : (
                <Text style={styles.noMessagesText}>No messages yet</Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.chatButton} 
              onPress={handleChatPress}
            >
              <View style={[styles.chatButtonContent, unreadCount === 0 && styles.chatButtonContentCentered]}>
                {unreadCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>
                      {unreadCount > 99 ? '99+' : unreadCount.toString()}
                    </Text>
                  </View>
                ) : (
                  <Ionicons name="chatbubbles" size={16} color="#ffffff" />
                )}
                <Text style={styles.chatButtonText}>Chat</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#60a5fa"
            colors={["#60a5fa"]}
          />
        }
      >
        
        {/* Upcoming Events - Full Width */}
        <View style={styles.fullWidthContainer}>
          <UpcomingEventsList />
        </View>
        
        {/* 5-Day Calendar Preview - Full Width */}
        <View style={styles.fullWidthContainer}>
          <FiveDayPreview />
        </View>
        
        {/* Group Expenses Block - Full Width */}
        <View style={styles.fullWidthContainer}>
          <ExpenseBlock 
            groupId={id as string}
            members={members}
            currentDeviceId={currentDeviceId}
          />
        </View>
        
        {/* Events Section */}
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>Events</Text>
          
          {/* Create Event Block - Always at top */}
          <TouchableOpacity 
            style={[
              styles.createEventBlock,
              { borderColor: groupProfile?.color || '#60a5fa' }
            ]} 
            activeOpacity={0.8} 
            onPress={() => router.push({
              pathname: '/create-event',
              params: { groupId: id }
            })}
          >
            <View style={styles.addEventContent}>
              <View style={styles.createEventIconContainer}>
                <Ionicons name="create" size={20} color="#ffffff" />
              </View>
              <Text style={styles.createEventText}>Create Custom Event</Text>
            </View>
          </TouchableOpacity>

          {groupEvents.map(event => (
            <EventBlock key={event.id} event={event} />
          ))}
          
          {groupEvents.length === 0 && (
            <View style={styles.noEventsContainer}>
              <Text style={styles.noEventsText}>No events yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      <InviteModal 
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        groupName={group.name}
        inviteLink={generateInviteLink(group.id)}
      />

      <ProfileSetupModal
        visible={showProfileModal}
        onComplete={isEditingFromMembers ? handleProfileComplete : handleProfileSetup}
        groupName={group.name}
        initialUsername={groupProfile?.username || ''}
        initialColor={groupProfile?.color || '#60a5fa'}
        usedColors={members.map(m => m.color).filter(Boolean)}
      />

      <GroupMembersModal
        visible={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        members={members}
        groupName={group.name}
        onLeaveGroup={confirmLeaveGroup}
        currentUserRole={permissions?.role}
        currentUserDeviceId={currentDeviceId}
        onEditUsername={handleEditUsername}
      />

      {pendingEventData && (
        <EventCustomizationModal
          visible={showEventModal}
          onClose={() => {
            setShowEventModal(false);
            setPendingEventData(null);
            router.replace({ pathname: '/group/[id]', params: { id: id as string } });
          }}
          event={pendingEventData}
          onSave={handleEventSave}
        />
      )}

      {/* Leave Group Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLeaveModal}
        onRequestClose={() => setShowLeaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.leaveModalContent}>
            <View style={styles.leaveModalHeader}>
              <Ionicons name="warning" size={24} color="#ef4444" />
              <Text style={styles.leaveModalTitle}>Leave Group</Text>
            </View>
            
            <View style={styles.leaveModalBody}>
              <Text style={styles.leaveModalText}>
                Are you sure you want to leave "{group.name}"?
              </Text>
              <Text style={styles.leaveModalSubtext}>
                This action cannot be undone.
              </Text>
            </View>
            
            <View style={styles.leaveModalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowLeaveModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.leaveButton} 
                onPress={confirmLeaveGroup}
              >
                <Text style={styles.leaveButtonText}>Leave Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerContainer: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 6,
    marginLeft: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
    gap: 8,
  },
  inviteButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerMenuButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGroupInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerGroupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  headerMemberCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 2,
  },
  groupInfoBlock: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 16,
    color: '#e5e7eb',
    marginBottom: 8,
  },
  groupMemberCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  spacer: {
    flex: 1,
  },
  // Side by Side Container
  sideBySideContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  // Full Width Container
  fullWidthContainer: {
    marginBottom: 24,
  },
  // Calendar Button (shared styles)
  calendarButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarButtonArrow: {
    marginLeft: 6,
  },
  calendarPreviewSeparator: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  // 4-Day Preview
  fourDayPreview: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    flex: 1.2,
  },
  sevenDayPreview: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  calendarHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
    flex: 1,
  },
  sevenDayPreviewContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    position: 'relative',
  },
  integratedCalendarButton: {
    marginBottom: 16,
  },
  integratedCalendarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
  },
  fourDayPreviewContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingTop: 8,
  },
  dayPreviewItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 8,
    backgroundColor: 'transparent',
    minHeight: 120,
    justifyContent: 'flex-start',
  },
  dayPreviewToday: {
    // Removed background highlighting - now using line indicator instead
  },
  dayPreviewHeader: {
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 6,
    minHeight: 35,
    justifyContent: 'center',
  },
  dayPreviewHeaderToday: {
    borderBottomColor: '#60a5fa',
  },
  dayPreviewName: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 2,
  },
  dayPreviewNumber: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  dayPreviewTodayText: {
    color: '#ffffff',
  },
  dayPreviewEventContainer: {
    minHeight: 80,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'column',
    gap: 4,
    paddingTop: 4,
  },
  eventConnectionContainer: {
    position: 'absolute',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    justifyContent: 'flex-start',
    zIndex: 0,
  },
  connectionDayHeader: {
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 6,
    minHeight: 35,
    justifyContent: 'center',
  },
  connectionEventContainer: {
    minHeight: 16,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'column',
    gap: 2,
  },
  eventAbbreviation: {
    minWidth: 20,
    minHeight: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '95%',
    width: 'auto',
  },
  eventAbbreviationText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    flexWrap: 'wrap',
    lineHeight: 12,
  },
  // Upcoming Events
  upcomingEventsSection: {
    flex: 1,
  },
  upcomingEventsContainer: {
    flex: 1,
  },
  upcomingEventsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  upcomingEventsList: {
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  upcomingEventsEmpty: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  upcomingEventsEmptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  upcomingEventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
  },
  upcomingEventContent: {
    flex: 1,
  },
  upcomingEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  upcomingEventIcon: {
    marginRight: 8,
  },
  upcomingEventName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  upcomingEventDateStack: {
    flexDirection: 'column',
  },
  upcomingEventDayOfWeek: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  upcomingEventDaysText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 1,
  },
  upcomingEventTime: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 1,
  },
  // Events section
  eventsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 12,
  },
  noEventsText: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 4,
  },
  noEventsSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  eventBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  eventContent: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  eventIconContainer: {
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  originalEventName: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 1,
  },
  eventParticipants: {
    fontSize: 11,
    color: '#6b7280',
  },
  eventArrow: {
    marginLeft: 8,
  },
  createEventBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  addEventBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
  },
  addEventContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addEventIconContainer: {
    marginRight: 8,
  },
  createEventIconContainer: {
    marginRight: 8,
  },
  createEventText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '600',
  },
  addEventText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  // Leave Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  leaveModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  leaveModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  leaveModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  leaveModalBody: {
    padding: 20,
    alignItems: 'center',
  },
  leaveModalText: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 8,
  },
  leaveModalSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  leaveModalButtons: {
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
  leaveButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Chat Modal styles
  chatContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  chatHeader: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatBackButton: {
    padding: 4,
  },
  chatTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  chatHeaderSpacer: {
    width: 32, // Same width as back button to center title
  },
  halfBlock: {
    flex: 1,
  },
  placeholderBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  // Secondary Header styles
  secondaryHeaderContainer: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  secondaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messagePreviewSection: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 12,
  },
  recentMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentMessageSender: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
    flexShrink: 0,
  },
  recentMessageText: {
    fontSize: 13,
    color: '#e5e7eb',
    flex: 1,
  },
  noMessagesText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  // Chat button styles
  chatButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatButtonContentCentered: {
    justifyContent: 'center',
  },
  notificationBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  notificationText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  // Expense Modal styles
  expenseModalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  expenseModalHeader: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expenseModalBackButton: {
    padding: 4,
  },
  expenseModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  expenseModalSpacer: {
    width: 32, // Same width as back button to center title
  },
});