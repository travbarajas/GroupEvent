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
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroups, Group } from '../../contexts/GroupsContext';
import { ApiService } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import InviteModal from '../../components/InviteModal';
import ProfileSetupModal from '../../components/ProfileSetupModal';
import GroupMembersModal from '../../components/GroupMembersModal';
import EventCustomizationModal from '../../components/EventCustomizationModal';
import ExpenseBlock from '../../components/ExpenseBlock';
import CarSeatIndicator from '../../components/CarSeatIndicator';
import { calendarCache } from '../../utils/calendarCache';
import { useRealtimeChat } from '../../hooks/useRealtimeChat';
import { isFeatureEnabled } from '../../config/features';
import { PlatformDetector } from '../../utils/platform';

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
  has_color?: boolean;
  color?: string;
}

interface GroupMember {
  member_id: string;
  device_id: string;
  role: string;
  username?: string;
  profile_picture?: string;
  has_username: boolean;
  color?: string;
}

const { width } = Dimensions.get('window');
const LAST_GROUP_KEY = '@last_accessed_group';

export default function GroupsTab() {
  const { groups, createGroup, loadGroups, getGroup, updateGroupAccess } = useGroups();
  const insets = useSafeAreaInsets();
  
  // Current group state
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  
  // Group detail states (copied from group detail screen)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
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
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingGroupName, setPendingGroupName] = useState<string>('');
  const [eventAttendance, setEventAttendance] = useState<{[eventId: string]: {going: string[], maybe: string[], not_going: string[]}}>({});
  
  const group = currentGroupId ? getGroup(currentGroupId) : null;
  
  // Chat notifications - only track messages for notification badge
  const { messages: chatMessages, isConnected, isLoading, error } = isFeatureEnabled('REALTIME_CHAT') 
    ? useRealtimeChat({
        roomType: 'group',
        roomId: currentGroupId || '',
        enabled: !!currentGroupId,
      })
    : { messages: [], isConnected: false, isLoading: false, error: null };

  const appStateRef = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);
  
  // Load last accessed group on startup
  useEffect(() => {
    const loadLastGroup = async () => {
      try {
        const lastGroupId = await AsyncStorage.getItem(LAST_GROUP_KEY);
        if (lastGroupId && groups.find(g => g.id === lastGroupId)) {
          setCurrentGroupId(lastGroupId);
        } else if (groups.length > 0) {
          // If no last group or it doesn't exist, use most recent
          const mostRecent = groups.reduce((most, current) => 
            current.createdAt > most.createdAt ? current : most
          );
          setCurrentGroupId(mostRecent.id);
          await AsyncStorage.setItem(LAST_GROUP_KEY, mostRecent.id);
        }
      } catch (error) {
        console.error('Failed to load last group:', error);
        if (groups.length > 0) {
          setCurrentGroupId(groups[0].id);
        }
      }
    };

    if (groups.length > 0) {
      loadLastGroup();
    }
  }, [groups]);

  // Save current group as last accessed
  const saveLastGroup = async (groupId: string) => {
    try {
      await AsyncStorage.setItem(LAST_GROUP_KEY, groupId);
      updateGroupAccess(groupId);
    } catch (error) {
      console.error('Failed to save last group:', error);
    }
  };

  // Load group data when current group changes
  useEffect(() => {
    if (currentGroupId) {
      fetchInviteCode();
      fetchPermissions();
      fetchGroupProfile();
      fetchMembers();
      fetchGroupEvents();
      getCurrentDeviceId();
      saveLastGroup(currentGroupId);
      
      // Preload calendar data for faster calendar loading
      calendarCache.preloadCalendarData(new Date());
    }
  }, [currentGroupId]);

  // Check for invite parameter and user info on load
  useEffect(() => {
    const checkForInvite = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const urlObj = Linking.parse(url);
          const inviteCode = urlObj.queryParams?.invite as string;
          if (inviteCode) {
            // Process the invite
            const groupData = await ApiService.processInvite(inviteCode);
            
            // Join the group
            await ApiService.joinGroup(inviteCode);
            
            // Refresh groups
            await loadGroups();
            
            // Clear the invite parameter from URL to prevent re-processing
            if (typeof window !== 'undefined' && window.history && window.location) {
              const url = new URL(window.location.href);
              url.searchParams.delete('invite');
              window.history.replaceState({}, '', url.toString());
            }
            
            // Show profile setup modal for this group
            setPendingGroupId(groupData.group_id);
            setPendingGroupName(groupData.name || 'the group');
            setShowProfileModal(true);
          }
        }
      } catch (error: any) {
        console.error('Error with invite:', error);
        alert(`Failed to join group: ${error.message}`);
      }
    };

    // Delay the check to ensure component is mounted
    const timer = setTimeout(checkForInvite, 100);
    return () => clearTimeout(timer);
  }, []);

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
      return 0;
    }
    
    const lastSeenIndex = chatMessages.findIndex(msg => msg.id === lastSeenMessageId);
    if (lastSeenIndex === -1) {
      const count = chatMessages.length;
      return count;
    }
    
    const count = chatMessages.length - (lastSeenIndex + 1);
    return Math.max(0, count);
  }, [chatMessages, lastSeenMessageId]);
  
  // Handle chat button press - clear notifications
  const handleChatPress = () => {
    if (chatMessages.length > 0) {
      const latestMessageId = chatMessages[chatMessages.length - 1].id;
      setLastSeenMessageId(latestMessageId);
    }
    
    router.push({
      pathname: '/group-chat',
      params: { 
        groupId: currentGroupId as string,
        groupName: group?.name,
        currentUsername: groupProfile?.username
      }
    });
  };

  // Background polling for attendance updates every 15 seconds
  useEffect(() => {
    if (!currentGroupId || groupEvents.length === 0) return;
    
    const attendancePoll = setInterval(() => {
      fetchAllEventAttendance(groupEvents);
    }, 15000);
    
    return () => clearInterval(attendancePoll);
  }, [currentGroupId, groupEvents.length]);

  // Handle app state changes - force refresh after long background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundTimeRef.current = Date.now();
      } else if (nextAppState === 'active' && backgroundTimeRef.current) {
        const backgroundDuration = Date.now() - backgroundTimeRef.current;
        const LONG_BACKGROUND_THRESHOLD = 30000; // 30 seconds
        
        if (backgroundDuration > LONG_BACKGROUND_THRESHOLD) {
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

  // API functions (copied from group detail screen)
  const getCurrentDeviceId = async () => {
    try {
      const { DeviceIdManager } = await import('../../utils/deviceId');
      const deviceId = await DeviceIdManager.getDeviceId();
      setCurrentDeviceId(deviceId);
    } catch (error) {
      console.error('Failed to get device ID:', error);
    }
  };

  const fetchInviteCode = async () => {
    if (!currentGroupId) return;
    try {
      const groupData = await ApiService.getGroup(currentGroupId);
      if (groupData.invite_code) {
        setInviteCode(groupData.invite_code);
      }
    } catch (error) {
      console.error('Failed to fetch invite code:', error);
    }
  };

  const fetchPermissions = async () => {
    if (!currentGroupId) return;
    try {
      const permissionsData = await ApiService.getPermissions(currentGroupId);
      setPermissions(permissionsData);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchGroupProfile = async () => {
    if (!currentGroupId) return;
    try {
      const profileData = await ApiService.getGroupProfile(currentGroupId);
      setGroupProfile(profileData);
      
      if (!profileData.has_username || !profileData.has_color) {
        await fetchMembers();
        setShowProfileModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch group profile:', error);
    }
  };

  const fetchMembers = async () => {
    if (!currentGroupId) return;
    try {
      const membersData = await ApiService.getGroupMembers(currentGroupId);
      setMembers(membersData);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const fetchGroupEvents = async () => {
    if (!currentGroupId) return;
    try {
      const eventsData = await ApiService.getGroupEvents(currentGroupId);
      setGroupEvents(eventsData.events || []);
      
      // Fetch attendance for all events
      if (eventsData.events && eventsData.events.length > 0) {
        await fetchAllEventAttendance(eventsData.events);
      }
    } catch (error) {
      console.error('Failed to fetch group events:', error);
    }
  };

  const fetchAllEventAttendance = async (events: any[]) => {
    if (!currentGroupId) return;
    
    const attendancePromises = events.map(async (event) => {
      try {
        const attendanceData = await ApiService.getEventAttendance(currentGroupId, event.id);
        return { eventId: event.id, attendance: attendanceData };
      } catch (error) {
        return { 
          eventId: event.id, 
          attendance: { going: [], maybe: [], not_going: [] } 
        };
      }
    });

    try {
      const results = await Promise.all(attendancePromises);
      const attendanceMap: {[eventId: string]: {going: string[], maybe: string[], not_going: string[]}} = {};
      
      results.forEach(result => {
        attendanceMap[result.eventId] = result.attendance;
      });
      
      setEventAttendance(attendanceMap);
    } catch (error) {
      console.error('Failed to fetch event attendance:', error);
    }
  };

  const handleEventAttendanceChange = async (eventId: string, status: 'going' | 'maybe' | 'not_going') => {
    if (!currentGroupId || !currentDeviceId) return;
    
    try {
      // Get current attendance for this event
      const currentAttendance = eventAttendance[eventId] || { going: [], maybe: [], not_going: [] };
      
      // Optimistic update - remove user from all attendance lists first
      const updatedAttendance = {
        going: currentAttendance.going.filter(deviceId => deviceId !== currentDeviceId),
        maybe: currentAttendance.maybe.filter(deviceId => deviceId !== currentDeviceId),
        not_going: currentAttendance.not_going.filter(deviceId => deviceId !== currentDeviceId)
      };
      
      // Add user to the selected status (toggle behavior)
      const isAlreadyInStatus = currentAttendance[status].includes(currentDeviceId);
      if (!isAlreadyInStatus) {
        updatedAttendance[status].push(currentDeviceId);
      }
      
      // Update UI immediately
      setEventAttendance(prev => ({
        ...prev,
        [eventId]: updatedAttendance
      }));
      
      // Send to API
      if (!isAlreadyInStatus) {
        await ApiService.updateEventAttendance(currentGroupId, eventId, status);
      }
    } catch (error) {
      // Revert optimistic update on error by refetching
      if (currentGroupId && groupEvents.length > 0) {
        await fetchAllEventAttendance(groupEvents);
      }
      console.error('Failed to update event attendance:', error);
    }
  };

  const getUserDisplayName = (deviceId: string) => {
    const member = members.find(m => m.device_id === deviceId);
    return member?.username || 'Unknown User';
  };

  const isUserInEventAttendance = (eventId: string, status: 'going' | 'maybe' | 'not_going') => {
    const attendance = eventAttendance[eventId];
    return attendance ? attendance[status].includes(currentDeviceId) : false;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadGroups();
      await fetchInviteCode();
      await fetchPermissions();
      await fetchGroupProfile();
      await fetchMembers();
      await fetchGroupEvents();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Group selection handlers
  const handleGroupSelect = (selectedGroup: Group) => {
    setCurrentGroupId(selectedGroup.id);
    setShowGroupsModal(false);
  };

  const handleCreateGroup = async () => {
    if (groupName.trim()) {
      try {
        const newGroup = await createGroup(groupName.trim());
        setGroupName('');
        setShowCreateModal(false);
        setShowGroupsModal(false);
        
        setCurrentGroupId(newGroup.id);
      } catch (error) {
        console.error('Failed to create group:', error);
      }
    }
  };

  const handleProfileSetup = async (username: string, profilePicture: string, color?: string) => {
    setShowProfileModal(false);
    
    try {
      if (pendingGroupId) {
        await ApiService.updateGroupProfile(pendingGroupId, { username, profile_picture: profilePicture, color });
        setCurrentGroupId(pendingGroupId);
        setPendingGroupId(null);
        setPendingGroupName('');
      } else if (currentGroupId) {
        await ApiService.updateGroupProfile(currentGroupId, { username, profile_picture: profilePicture, color });
        
        setGroupProfile(prev => ({
          ...prev,
          username,
          color,
          has_username: true,
          has_color: true
        }));
        
        await fetchMembers();
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleEditUsername = async () => {
    setIsEditingFromMembers(true);
    setShowMembersModal(false);
    
    await fetchMembers();
    setShowProfileModal(true);
  };

  const handleProfileComplete = async (username: string, profilePicture: string, color?: string) => {
    setShowProfileModal(false);
    
    if (isEditingFromMembers) {
      setShowMembersModal(false);
      setIsEditingFromMembers(false);
    }
    
    try {
      if (currentGroupId) {
        await ApiService.updateGroupProfile(currentGroupId, { username, profile_picture: profilePicture, color });
        await handleRefresh();
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleEventSave = async (customName: string, originalEvent: any) => {
    try {
      if (currentGroupId) {
        await ApiService.saveEventToGroup(currentGroupId, customName, originalEvent);
        setShowEventModal(false);
        setPendingEventData(null);
        await handleRefresh();
      }
    } catch (error) {
      console.error('Failed to save event:', error);
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
      if (currentGroupId) {
        await ApiService.leaveGroup(currentGroupId);
        await loadGroups();
        
        // Find another group to show or clear current
        const remainingGroups = groups.filter(g => g.id !== currentGroupId);
        if (remainingGroups.length > 0) {
          setCurrentGroupId(remainingGroups[0].id);
        } else {
          setCurrentGroupId(null);
        }
      }
    } catch (error) {
      console.error('Failed to leave group:', error);
    }
  };

  // Helper functions from group detail screen
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

  const formatUserFriendlyDate = (dateString: string, timeString?: string): string => {
    if (!dateString || dateString === 'No date') return 'No date';
    
    try {
      // Parse date as local time to avoid timezone issues
      let eventDate: Date;
      if (dateString.includes('T') || dateString.includes('Z')) {
        eventDate = new Date(dateString);
      } else {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          eventDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          eventDate = new Date(dateString);
        }
      }
      
      if (isNaN(eventDate.getTime())) return dateString;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDateOnly = new Date(eventDate);
      eventDateOnly.setHours(0, 0, 0, 0);
      
      const timeDiff = eventDateOnly.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
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
      
      let timeText = '';
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
      
      return `${relativeText} - ${dayOfWeek}, ${readableDate}${timeText ? ` at ${timeText}` : ''}`;
    } catch (error) {
      return dateString;
    }
  };

  // Get next 5 days with events
  const getNext5Days = () => {
    const days = [];
    const today = new Date();
    
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
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      const dayEvents = groupEvents.filter(event => {
        const eventDate = formatEventDate(event.original_event_data?.date);
        const range = parseEventDateRange(event);
        return eventDate === dateString && !range.isMultiDay;
      });
      
      const multiDayEvents = multiDayEventRanges.filter(event => {
        if (!event) return false;
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        const currentDate = new Date(dateString);
        return currentDate >= startDate && currentDate <= endDate;
      });
      
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
          if (a.isMultiDay && !b.isMultiDay) return -1;
          if (!a.isMultiDay && b.isMultiDay) return 1;
          return 0;
        });
      
      days.push({
        dayName,
        dayNumber,
        hasEvents: allEvents.length > 0,
        eventCount: allEvents.length,
        dateString,
        events: eventsWithAbbreviations,
      });
    }
    
    return days;
  };

  // Get upcoming events (next 5 days)
  const getUpcomingEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 5);
    nextWeek.setHours(23, 59, 59, 999);
    
    return groupEvents
      .filter(event => {
        const eventDateString = formatEventDate(event.original_event_data?.date);
        if (!eventDateString) return false;
        
        const parts = eventDateString.split('-');
        if (parts.length !== 3) return false;
        
        const eventDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        eventDate.setHours(0, 0, 0, 0);
        
        return eventDate >= today && eventDate <= nextWeek;
      })
      .sort((a, b) => {
        const rangeA = parseEventDateRange(a);
        const rangeB = parseEventDateRange(b);
        
        const dateA = new Date(rangeA.startDate || a.original_event_data?.date);
        const dateB = new Date(rangeB.startDate || b.original_event_data?.date);
        
        return dateA.getTime() - dateB.getTime();
      });
  };

  const FiveDayPreview = () => {
    const next5Days = getNext5Days();
    
    return (
      <View style={styles.sevenDayPreview}>
        <TouchableOpacity 
          style={styles.calendarHeader}
          activeOpacity={0.8}
          onPress={() => router.push({
            pathname: '/calendar',
            params: { groupId: currentGroupId }
          })}
        >
          <Ionicons name="calendar" size={20} color="#60a5fa" />
          <Text style={styles.calendarHeaderText}>Calendar</Text>
          <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
        </TouchableOpacity>
        
        <View style={styles.sevenDayPreviewContent}>
          {next5Days.map((day, index) => (
            <TouchableOpacity 
              key={index}
              style={[
                styles.dayPreviewItem,
                index === 0 && styles.dayPreviewToday
              ]}
              activeOpacity={0.7}
              onPress={() => {
                if (day.eventCount === 1) {
                  const dayEvents = groupEvents.filter(event => {
                    const eventDate = formatEventDate(event.original_event_data?.date);
                    return eventDate === day.dateString;
                  });
                  
                  if (dayEvents.length === 1) {
                    const event = dayEvents[0];
                    router.push({
                      pathname: '/event/[id]',
                      params: { 
                        id: event.id,
                        groupId: currentGroupId as string
                      }
                    });
                    return;
                  }
                }
                
                router.push(`/date-events?date=${day.dateString}&groupId=${currentGroupId}`);
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
                {day.events && day.events.slice(0, 3).map((event, eventIndex) => {
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
                {day.events && day.events.length > 3 && (
                  <View 
                    style={[
                      styles.eventAbbreviation,
                      { backgroundColor: '#666' }
                    ]}
                  >
                    <Text style={styles.eventAbbreviationText}>
                      +{day.events.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const CompactAttendanceBox = ({ 
    title, 
    users, 
    color, 
    status,
    eventId 
  }: { 
    title: string; 
    users: string[]; 
    color: string;
    status: 'going' | 'maybe' | 'not_going';
    eventId: string;
  }) => {
    const isSelected = isUserInEventAttendance(eventId, status);
    
    return (
      <TouchableOpacity 
        style={[
          styles.compactAttendanceBoxContainer,
          { borderColor: color },
          isSelected && styles.compactAttendanceBoxSelected
        ]}
        onPress={() => handleEventAttendanceChange(eventId, status)}
        activeOpacity={0.7}
      >
        <View style={styles.compactAttendanceHeader}>
          <View style={[styles.compactAttendanceColorBar, { backgroundColor: color }]} />
          <Text style={styles.compactAttendanceTitle}>{title}</Text>
          <Text style={styles.compactAttendanceCount}>({users.length})</Text>
        </View>
        
        <View style={styles.compactAttendanceUsers}>
          {users.slice(0, 3).map((deviceId, index) => {
            const displayName = getUserDisplayName(deviceId);
            const truncatedName = displayName.length > 10 ? displayName.substring(0, 10) + '...' : displayName;
            
            return (
              <View key={deviceId} style={styles.compactUserRow}>
                <View style={styles.compactUserAvatar}>
                  <Text style={styles.compactUserAvatarText}>
                    {displayName[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text style={styles.compactUserName}>{truncatedName}</Text>
              </View>
            );
          })}
          {users.length > 3 && (
            <Text style={styles.compactAttendanceMore}>+{users.length - 3} more</Text>
          )}
          {users.length === 0 && (
            <Text style={styles.compactAttendanceEmpty}>Tap to join</Text>
          )}
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
              
              const { startDate, endDate, isMultiDay } = parseEventDateRange(event);
              const dateRangeDisplay = formatDateRangeDisplay(startDate, endDate);
              
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
              
              const creatorColor = event.created_by_color || '#2a2a2a';
              const attendance = eventAttendance[event.id] || { going: [], maybe: [], not_going: [] };
              
              return (
                <View 
                  key={event.id}
                  style={[
                    styles.upcomingEventItem,
                    { borderLeftWidth: 3, borderLeftColor: creatorColor },
                    isLast && { borderBottomWidth: 0 }
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.upcomingEventMainContent}
                    activeOpacity={0.7}
                    onPress={() => {
                      router.push({
                        pathname: '/event/[id]',
                        params: { 
                          id: event.id,
                          groupId: currentGroupId as string
                        }
                      });
                    }}
                  >
                    <View style={styles.upcomingEventHeader}>
                      <View style={styles.upcomingEventIcon}>
                        <Ionicons name="calendar-outline" size={16} color="#60a5fa" />
                      </View>
                      <Text style={styles.upcomingEventName}>{displayName}</Text>
                      <Ionicons name="chevron-forward" size={12} color="#9ca3af" />
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
                  </TouchableOpacity>
                  
                  {/* Attendance Section */}
                  <View style={styles.upcomingEventInteractions}>
                    <View style={styles.compactAttendanceColumn}>
                      <CompactAttendanceBox 
                        title="Going" 
                        users={attendance.going} 
                        color="#10b981" 
                        status="going"
                        eventId={event.id}
                      />
                      <CompactAttendanceBox 
                        title="Maybe" 
                        users={attendance.maybe} 
                        color="#f59e0b" 
                        status="maybe"
                        eventId={event.id}
                      />
                      <CompactAttendanceBox 
                        title="Not Going" 
                        users={attendance.not_going} 
                        color="#ef4444" 
                        status="not_going"
                        eventId={event.id}
                      />
                    </View>
                    
                    <View style={styles.compactCarSeatsContainer}>
                      <CarSeatIndicator 
                        groupId={currentGroupId as string}
                        eventId={event.id}
                        currentUserId={currentDeviceId}
                        userColor={groupProfile?.color}
                        members={members}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const EventBlock = ({ event }: { event: any }) => {
    const originalEvent = event.original_event_data;
    const displayName = event.custom_name || originalEvent?.name || 'Untitled Event';
    const creatorColor = event.created_by_color || '#2a2a2a';
    
    const handleEventPress = () => {
      router.push({
        pathname: '/event/[id]',
        params: { 
          id: event.id,
          groupId: currentGroupId as string
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

  // Show loading state if no groups or no current group
  if (groups.length === 0 || !currentGroupId || !group) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.groupSelector} onPress={() => setShowGroupsModal(true)}>
              <Text style={styles.headerTitle}>
                {groups.length === 0 ? 'No Groups' : 'Loading...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#ffffff" style={styles.dropdownIcon} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          {groups.length === 0 ? (
            <View style={styles.noGroupsContainer}>
              <Ionicons name="people" size={64} color="#60a5fa" />
              <Text style={styles.noGroupsTitle}>No Groups Yet</Text>
              <Text style={styles.noGroupsSubtitle}>Create your first group to get started</Text>
              <TouchableOpacity 
                style={styles.createFirstGroupButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={20} color="#ffffff" />
                <Text style={styles.createFirstGroupButtonText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.loadingText}>Loading group...</Text>
          )}
        </View>
        
        {/* Groups Selection Modal */}
        <Modal
          visible={showGroupsModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowGroupsModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowGroupsModal(false)}
          >
            <View style={styles.groupsModalContent}>
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.groupsModalHeader}>
                  <Text style={styles.groupsModalTitle}>Select Group</Text>
                </View>
                
                <ScrollView style={styles.groupsModalList} showsVerticalScrollIndicator={false}>
                  {groups.map(group => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupsModalItem,
                        currentGroupId === group.id && styles.groupsModalItemSelected
                      ]}
                      onPress={() => handleGroupSelect(group)}
                    >
                      <View style={styles.groupsModalItemContent}>
                        <Ionicons name="people" size={20} color="#60a5fa" />
                        <Text style={styles.groupsModalItemName}>{group.name}</Text>
                        <Text style={styles.groupsModalItemMembers}>{group.memberCount} members</Text>
                      </View>
                      {currentGroupId === group.id && (
                        <Ionicons name="checkmark" size={20} color="#60a5fa" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                <View style={styles.groupsModalFooter}>
                  <TouchableOpacity
                    style={styles.createGroupButton}
                    onPress={() => setShowCreateModal(true)}
                  >
                    <Ionicons name="add" size={20} color="#ffffff" />
                    <Text style={styles.createGroupButtonText}>Create New Group</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Create Group Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showCreateModal}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.createModalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Group</Text>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Group Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Enter group name..."
                  placeholderTextColor="#6b7280"
                  autoFocus={true}
                  maxLength={50}
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => {
                    setGroupName('');
                    setShowCreateModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.createButton, 
                    !groupName.trim() && styles.createButtonDisabled
                  ]} 
                  onPress={handleCreateGroup}
                  disabled={!groupName.trim()}
                >
                  <Text style={[
                    styles.createButtonText,
                    !groupName.trim() && styles.createButtonTextDisabled
                  ]}>Create Group</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ProfileSetupModal
          visible={showProfileModal}
          onComplete={pendingGroupId ? handleProfileSetup : handleProfileComplete}
          groupName={pendingGroupName || group?.name || ''}
          initialUsername={groupProfile?.username || ''}
          initialColor={groupProfile?.color || '#60a5fa'}
          usedColors={members.map(m => m.color).filter(Boolean)}
        />
      </View>
    );
  }

  // Import the main group content components here (we'll add this next)
  // For now, let's include the basic structure from the group detail screen
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header with Group Selector (no back button) */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.groupSelector} onPress={() => setShowGroupsModal(true)}>
            <Text style={styles.headerTitle}>{group.name}</Text>
            <Ionicons name="chevron-down" size={20} color="#ffffff" style={styles.dropdownIcon} />
          </TouchableOpacity>
          <View style={styles.headerRightButtons}>
            {permissions?.permissions?.can_invite && (
              <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
                <Text style={styles.inviteButtonText}>Invite</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.headerMenuButton} onPress={() => setShowMembersModal(true)}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
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
            groupId={currentGroupId}
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
              params: { groupId: currentGroupId }
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
      
      {/* All Modals */}
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
          }}
          event={pendingEventData}
          onSave={handleEventSave}
        />
      )}

      {/* Groups Selection Modal */}
      <Modal
        visible={showGroupsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGroupsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowGroupsModal(false)}
        >
          <View style={styles.groupsModalContent}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.groupsModalHeader}>
                <Text style={styles.groupsModalTitle}>Select Group</Text>
              </View>
              
              <ScrollView style={styles.groupsModalList} showsVerticalScrollIndicator={false}>
                {groups.map(group => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupsModalItem,
                      currentGroupId === group.id && styles.groupsModalItemSelected
                    ]}
                    onPress={() => handleGroupSelect(group)}
                  >
                    <View style={styles.groupsModalItemContent}>
                      <Ionicons name="people" size={20} color="#60a5fa" />
                      <Text style={styles.groupsModalItemName}>{group.name}</Text>
                      <Text style={styles.groupsModalItemMembers}>{group.memberCount} members</Text>
                    </View>
                    {currentGroupId === group.id && (
                      <Ionicons name="checkmark" size={20} color="#60a5fa" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <View style={styles.groupsModalFooter}>
                <TouchableOpacity
                  style={styles.createGroupButton}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Ionicons name="add" size={20} color="#ffffff" />
                  <Text style={styles.createGroupButtonText}>Create New Group</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCreateModal}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.createModalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Group</Text>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Group Name</Text>
              <TextInput
                style={styles.textInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Enter group name..."
                placeholderTextColor="#6b7280"
                autoFocus={true}
                maxLength={50}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => {
                  setGroupName('');
                  setShowCreateModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.createButton, 
                  !groupName.trim() && styles.createButtonDisabled
                ]} 
                onPress={handleCreateGroup}
                disabled={!groupName.trim()}
              >
                <Text style={[
                  styles.createButtonText,
                  !groupName.trim() && styles.createButtonTextDisabled
                ]}>Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  groupSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  dropdownIcon: {
    marginLeft: 4,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerMenuButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  noGroupsContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  noGroupsTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noGroupsSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  createFirstGroupButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createFirstGroupButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  // Two-column layout
  columnsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1.2,
  },
  fullWidthContainer: {
    marginBottom: 24,
  },
  // Calendar styles
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
    // Today indicator via header underline
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
  // Upcoming Events styles
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
    flexDirection: 'column',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
  },
  upcomingEventMainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  // Compact attendance and car seats styles
  upcomingEventInteractions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  compactAttendanceColumn: {
    flex: 2,
    gap: 8,
  },
  compactAttendanceBoxContainer: {
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    opacity: 0.7,
  },
  compactAttendanceBoxSelected: {
    opacity: 1,
    backgroundColor: '#1a1a1a',
  },
  compactAttendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  compactAttendanceColorBar: {
    width: 3,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  compactAttendanceTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  compactAttendanceCount: {
    fontSize: 10,
    color: '#9ca3af',
  },
  compactAttendanceUsers: {
    gap: 4,
  },
  compactUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactUserAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4f4f4f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactUserAvatarText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  compactUserName: {
    fontSize: 10,
    color: '#e5e7eb',
    flex: 1,
  },
  compactAttendanceMore: {
    fontSize: 9,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 2,
  },
  compactAttendanceEmpty: {
    fontSize: 9,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  compactCarSeatsContainer: {
    flex: 1,
    minHeight: 100,
  },
  // Events section styles
  eventsSection: {
    marginTop: 8,
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
  groupContentContainer: {
    flex: 1,
  },
  placeholderSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  placeholderBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  createEventBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  addEventContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createEventIconContainer: {
    marginRight: 8,
  },
  createEventText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '600',
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
  // Groups Selection Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  groupsModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: width - 40,
    maxWidth: 400,
    marginTop: 80,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    maxHeight: '70%',
  },
  groupsModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    alignItems: 'center',
  },
  groupsModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  groupsModalList: {
    maxHeight: 300,
  },
  groupsModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  groupsModalItemSelected: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
  },
  groupsModalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupsModalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 12,
    flex: 1,
  },
  groupsModalItemMembers: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 8,
  },
  groupsModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  createGroupButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  // Create Group Modal Styles
  createModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 120,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: width - 40,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  modalButtons: {
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
  createButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: '#6b7280',
  },
  // Leave Modal styles
  leaveModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 120,
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
});