import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroups } from '@/contexts/GroupsContext';
import { ApiService } from '@/services/api';
import InviteModal from '@/components/InviteModal';
import ProfileSetupModal from '@/components/ProfileSetupModal';
import GroupMembersModal from '@/components/GroupMembersModal';
import EventCustomizationModal from '@/components/EventCustomizationModal';
import ExpenseTracker from '@/components/ExpenseTracker';
import GroupChat from '@/components/GroupChat';
import { calendarCache } from '@/utils/calendarCache';

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
  const { getGroup, loadGroups } = useGroups();
  const insets = useSafeAreaInsets();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showExpenseTracker, setShowExpenseTracker] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [permissions, setPermissions] = useState<GroupPermissions | null>(null);
  const [groupProfile, setGroupProfile] = useState<GroupProfile | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [isEditingFromMembers, setIsEditingFromMembers] = useState(false);
  const [pendingEventData, setPendingEventData] = useState<any>(null);
  const [groupEvents, setGroupEvents] = useState<any[]>([]);
  const [showGroupChat, setShowGroupChat] = useState(false);
  
  const group = getGroup(id as string);
  
  useEffect(() => {
    if (id) {
      fetchInviteCode();
      fetchPermissions();
      fetchGroupProfile();
      fetchMembers();
      fetchGroupEvents();
      getCurrentDeviceId();
      
      // Preload calendar data for faster calendar loading
      calendarCache.preloadCalendarData(new Date());
    }
  }, [id]);

  useEffect(() => {
    // Handle pending event from navigation
    if (pendingEvent) {
      try {
        const eventData = JSON.parse(pendingEvent as string);
        setPendingEventData(eventData);
        setShowEventModal(true);
      } catch (error) {
        console.error('Failed to parse pending event:', error);
      }
    }
  }, [pendingEvent]);

  const getCurrentDeviceId = async () => {
    try {
      const { DeviceIdManager } = await import('@/utils/deviceId');
      const deviceId = await DeviceIdManager.getDeviceId();
      setCurrentDeviceId(deviceId);
    } catch (error) {
      console.error('Failed to get device ID:', error);
    }
  };

  const fetchInviteCode = async () => {
    try {
      const groupData = await ApiService.getGroup(id as string);
      if (groupData.invite_code) {
        setInviteCode(groupData.invite_code);
      }
    } catch (error) {
      console.error('Failed to fetch invite code:', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const permissionsData = await ApiService.getPermissions(id as string);
      setPermissions(permissionsData);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
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
      console.error('Failed to fetch group profile:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const membersData = await ApiService.getGroupMembers(id as string);
      setMembers(membersData);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const fetchGroupEvents = async () => {
    try {
      const eventsData = await ApiService.getGroupEvents(id as string);
      console.log('📅 Fetched events data:', eventsData.events?.slice(0, 2)); // Log first 2 events
      setGroupEvents(eventsData.events || []);
    } catch (error) {
      console.error('Failed to fetch group events:', error);
    }
  };


  const handleRefresh = async () => {
    try {
      await loadGroups(); // Refresh the groups list
      await fetchInviteCode(); // Refresh invite code
      await fetchPermissions(); // Refresh permissions
      await fetchGroupProfile(); // Refresh group profile
      await fetchMembers(); // Refresh members
      await fetchGroupEvents(); // Refresh group events
    } catch (error) {
      console.error('Failed to refresh group data:', error);
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
      console.error('Failed to update profile:', error);
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
      console.error('Failed to update profile:', error);
    }
  };

  const handleEventSave = async (customName: string, originalEvent: any) => {
    try {
      console.log('Saving event to group:', { customName, originalEvent, groupId: id });
      
      // Save event to group via API
      await ApiService.saveEventToGroup(id as string, customName, originalEvent);
      
      // Close the modal and clear pending data
      setShowEventModal(false);
      setPendingEventData(null);
      
      // Clear the pendingEvent param from the URL
      router.replace({ pathname: '/group/[id]', params: { id: id as string } });
      
      // Refresh the group to show the new event
      await handleRefresh();
      
      console.log('Event saved successfully to group');
    } catch (error) {
      console.error('Failed to save event to group:', error);
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
      console.error('Failed to leave group:', error);
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

  // Get next 4 days (today + 3)
  const getNext4Days = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 4; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumber = date.getDate();
      
      // Create date string in local time (not UTC)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      // Find events for this date
      const dayEvents = groupEvents.filter(event => {
        const eventDate = formatEventDate(event.original_event_data?.date);
        return eventDate === dateString;
      });
      
      days.push({
        dayName,
        dayNumber,
        hasEvents: dayEvents.length > 0,
        eventCount: dayEvents.length,
        dateString
      });
    }
    
    return days;
  };

  // Get upcoming events (next 7 days)
  const getUpcomingEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate day comparison
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999); // End of the 7th day
    
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
        const dateStringA = formatEventDate(a.original_event_data?.date) || '';
        const dateStringB = formatEventDate(b.original_event_data?.date) || '';
        
        // Parse both dates consistently as local time
        const partsA = dateStringA.split('-');
        const partsB = dateStringB.split('-');
        
        if (partsA.length !== 3 || partsB.length !== 3) return 0;
        
        const dateA = new Date(parseInt(partsA[0]), parseInt(partsA[1]) - 1, parseInt(partsA[2]));
        const dateB = new Date(parseInt(partsB[0]), parseInt(partsB[1]) - 1, parseInt(partsB[2]));
        
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 2); // Show max 2 upcoming events
  };

  const FourDayPreview = () => {
    const next4Days = getNext4Days();
    
    return (
      <TouchableOpacity 
        style={styles.fourDayPreview}
        activeOpacity={0.8}
        onPress={() => router.push({
          pathname: '/calendar',
          params: { groupId: id }
        })}
      >
        {/* Calendar Button integrated into 4-day preview */}
        <TouchableOpacity 
          style={styles.integratedCalendarButton}
          activeOpacity={0.6}
          onPress={() => router.push({
            pathname: '/calendar',
            params: { groupId: id }
          })}
        >
          <View style={styles.calendarButtonContent}>
            <Ionicons name="calendar" size={20} color="#60a5fa" />
            <Text style={styles.integratedCalendarButtonText}>Calendar</Text>
            <Ionicons name="chevron-forward" size={14} color="#9ca3af" style={styles.calendarButtonArrow} />
          </View>
        </TouchableOpacity>
        
        <View style={styles.fourDayPreviewContent}>
          {next4Days.map((day, index) => (
            <TouchableOpacity 
              key={index} 
              style={[
                styles.dayPreviewItem,
                index === 0 && styles.dayPreviewToday,
                day.hasEvents && styles.dayPreviewWithEvents
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
              <Text style={styles.dayPreviewName}>{day.dayName}</Text>
              <Text style={[
                styles.dayPreviewNumber,
                index === 0 && styles.dayPreviewTodayText,
                day.hasEvents && styles.dayPreviewWithEventsText
              ]}>
                {day.dayNumber}
              </Text>
              <View style={styles.dayPreviewEventContainer}>
                {day.hasEvents && (
                  <View style={styles.dayPreviewEventDot}>
                    <Text style={styles.dayPreviewEventCount}>{day.eventCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
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
          const dateInfo = formatUpcomingEventDate(originalEvent?.date, originalEvent?.time);
          const creatorColor = event.created_by_color || '#2a2a2a'; // Default to gray if no color
          
          return (
            <TouchableOpacity 
              key={event.id}
              style={[
                styles.upcomingEventItem,
                { borderLeftWidth: 3, borderLeftColor: creatorColor + '80' },
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
                  <Text style={styles.upcomingEventDayOfWeek}>{dateInfo.dayOfWeek}</Text>
                  {dateInfo.daysText ? (
                    <Text style={styles.upcomingEventDaysText}>{dateInfo.daysText}</Text>
                  ) : null}
                  {dateInfo.timeText ? (
                    <Text style={styles.upcomingEventTime}>{dateInfo.timeText}</Text>
                  ) : null}
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
        style={[styles.eventBlock, { borderColor: creatorColor + '80' }]} 
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
                {formatUserFriendlyDate(originalEvent?.date, originalEvent?.time)}
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
          <View style={styles.headerButtons}>
            {permissions?.permissions?.can_invite && (
              <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
                <Text style={styles.inviteButtonText}>Invite</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.chatButton} onPress={() => setShowGroupChat(true)}>
              <Ionicons name="chatbubbles" size={18} color="#ffffff" />
              <Text style={styles.chatButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.headerMenuButton} onPress={() => setShowMembersModal(true)}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Group Info Block - Full Width */}
      <View style={styles.groupInfoBlock}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupMemberCount}>{group.memberCount} member{group.memberCount === 1 ? '' : 's'}</Text>
        
      </View>
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Side by Side: Upcoming Events and 4-Day Preview with integrated Calendar Button */}
        <View style={styles.sideBySideContainer}>
          <View style={styles.upcomingEventsSection}>
            <UpcomingEventsList />
          </View>
          <FourDayPreview />
        </View>
        
        {/* Events Section */}
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>Events</Text>
          {groupEvents.map(event => (
            <EventBlock key={event.id} event={event} />
          ))}
          
          {/* Create Event Block */}
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

          {/* Add Event Block */}
          <TouchableOpacity style={styles.addEventBlock} activeOpacity={0.8} onPress={() => router.push('/(tabs)/events')}>
            <View style={styles.addEventContent}>
              <View style={styles.addEventIconContainer}>
                <Ionicons name="add" size={20} color="#ffffff" />
              </View>
              <Text style={styles.addEventText}>Add Event from Events Tab</Text>
            </View>
          </TouchableOpacity>
          
          {groupEvents.length === 0 && (
            <View style={styles.noEventsContainer}>
              <Text style={styles.noEventsText}>No events yet</Text>
              <Text style={styles.noEventsSubtext}>Add events from the Events tab!</Text>
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

      <ExpenseTracker
        visible={showExpenseTracker}
        onClose={() => setShowExpenseTracker(false)}
        groupName={group?.name || ''}
        groupId={id as string}
        members={members}
      />

      <Modal
        animationType="slide"
        transparent={false}
        visible={showGroupChat}
        onRequestClose={() => setShowGroupChat(false)}
      >
        <View style={styles.chatContainer}>
          <View style={[styles.chatHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => setShowGroupChat(false)} style={styles.chatBackButton}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.chatTitle}>{group.name} Chat</Text>
            <View style={styles.chatHeaderSpacer} />
          </View>
          <GroupChat 
            groupId={id as string} 
            currentUsername={groupProfile?.username}
          />
        </View>
      </Modal>

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
  // Side by Side Container
  sideBySideContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  // Calendar Button (shared styles)
  calendarButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarButtonArrow: {
    marginLeft: 6,
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
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
    minHeight: 80,
    justifyContent: 'space-between',
  },
  dayPreviewToday: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  dayPreviewWithEvents: {
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
    borderWidth: 1,
    borderColor: '#D4A574',
  },
  dayPreviewName: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 4,
  },
  dayPreviewNumber: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  dayPreviewTodayText: {
    color: '#ffffff',
  },
  dayPreviewWithEventsText: {
    color: '#D4A574',
  },
  dayPreviewEventContainer: {
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayPreviewEventDot: {
    width: 18,
    height: 14,
    backgroundColor: '#D4A574',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPreviewEventCount: {
    fontSize: 8,
    color: '#2A1F14',
    fontWeight: '700',
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
});