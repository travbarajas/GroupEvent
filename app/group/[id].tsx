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
      if (!profileData.has_username) {
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

  const handleProfileSetup = async (username: string, profilePicture: string) => {
    try {
      await ApiService.updateGroupProfile(id as string, { username, profile_picture: profilePicture });
      setShowProfileModal(false);
      
      // Refresh all data to show updated username everywhere
      await handleRefresh();
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleProfileSkip = () => {
    setShowProfileModal(false);
  };

  const handleEditUsername = () => {
    setIsEditingFromMembers(true);
    setShowMembersModal(false);
    setShowProfileModal(true);
  };

  const handleProfileComplete = async (username: string, profilePicture: string) => {
    try {
      await ApiService.updateGroupProfile(id as string, { username, profile_picture: profilePicture });
      setShowProfileModal(false);
      
      // Refresh all data to show updated username everywhere
      await handleRefresh();
      
      // If we came from editing in members modal, reopen it
      if (isEditingFromMembers) {
        setIsEditingFromMembers(false);
        setTimeout(() => {
          setShowMembersModal(true);
        }, 100);
      }
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

  const CalendarSquare = () => {
    // Get next 4 days (today + 3)
    const getNext4Days = () => {
      const days = [];
      const today = new Date();
      
      for (let i = 0; i < 4; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNumber = date.getDate();
        const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Find events for this date
        const dayEvents = groupEvents.filter(event => {
          const eventDate = formatEventDate(event.original_event_data?.date);
          return eventDate === dateString;
        });
        
        days.push({
          dayName,
          dayNumber,
          hasEvents: dayEvents.length > 0,
          eventCount: dayEvents.length
        });
      }
      
      return days;
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
        return null;
      }
    };

    const next4Days = getNext4Days();

    return (
      <TouchableOpacity 
        style={styles.square} 
        activeOpacity={0.6}
        onPress={() => router.push({
          pathname: '/calendar',
          params: { groupId: id }
        })}
      >
        <View style={styles.squareHeader}>
          <Ionicons name="calendar" size={24} color="#60a5fa" />
          <Text style={styles.squareTitle}>Calendar</Text>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </View>
        
        {/* Separator Line */}
        <View style={styles.calendarSeparator} />
        
        {/* Calendar Preview */}
        <View style={styles.calendarPreview}>
          {next4Days.map((day, index) => {
            const date = new Date();
            date.setDate(date.getDate() + index);
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            return (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.previewDayContainer,
                  index === 0 && styles.previewTodayContainer,
                  day.hasEvents && styles.previewDayWithEventsContainer
                ]}
                activeOpacity={0.7}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent parent TouchableOpacity from firing
                  router.push(`/date-events?date=${dateString}&groupId=${id}`);
                }}
              >
                <Text style={styles.previewDayName}>{day.dayName}</Text>
                <Text style={[
                  styles.previewDayText,
                  index === 0 && styles.previewTodayText,
                  day.hasEvents && styles.previewDayWithEventsText
                ]}>
                  {day.dayNumber}
                </Text>
                <View style={styles.previewEventContainer}>
                  {day.hasEvents && (
                    <View style={styles.previewEventDot}>
                      <Text style={styles.previewEventCount}>{day.eventCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };

  const MoneySquare = () => (
    <TouchableOpacity style={styles.square} activeOpacity={0.8} onPress={() => setShowExpenseTracker(true)}>
      <View style={styles.squareHeader}>
        <Ionicons name="card" size={24} color="#4ade80" />
        <Text style={styles.squareTitle}>Money</Text>
      </View>
      <View style={styles.squareContent}>
        <Text style={styles.squareDescription}>Track & split expenses</Text>
      </View>
    </TouchableOpacity>
  );

  const EventBlock = ({ event }: { event: any }) => {
    const originalEvent = event.original_event_data;
    const displayName = event.custom_name || originalEvent?.name || 'Untitled Event';
    
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
      <TouchableOpacity style={styles.eventBlock} activeOpacity={0.8} onPress={handleEventPress}>
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
                {originalEvent?.date || 'No date'} • {originalEvent?.time || 'No time'}
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
        {/* Two Square Boxes */}
        <View style={styles.squareContainer}>
          <CalendarSquare />
          <MoneySquare />
        </View>
        
        {/* Events Section */}
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>Events</Text>
          {groupEvents.map(event => (
            <EventBlock key={event.id} event={event} />
          ))}
          
          {/* Create Event Block */}
          <TouchableOpacity 
            style={styles.createEventBlock} 
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
        onSkip={handleProfileSkip}
        groupName={group.name}
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
  squareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  square: {
    width: squareSize,
    height: squareSize,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  squareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  squareTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  squareContent: {
    flex: 1,
    justifyContent: 'center',
  },
  squareDescription: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
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
    borderColor: '#60a5fa',
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
  
  // Calendar Preview Styles
  calendarSeparator: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginTop: 12,
    marginBottom: 8,
  },
  calendarPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingTop: 8,
  },
  previewDayContainer: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
    minHeight: 65,
    justifyContent: 'space-between',
  },
  previewTodayContainer: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  previewDayWithEventsContainer: {
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
    borderWidth: 1,
    borderColor: '#D4A574',
  },
  previewDayName: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 4,
  },
  previewDayText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  previewTodayText: {
    color: '#ffffff',
  },
  previewDayWithEventsText: {
    color: '#D4A574',
  },
  previewEventContainer: {
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewEventDot: {
    width: 18,
    height: 14,
    backgroundColor: '#D4A574',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEventCount: {
    fontSize: 8,
    color: '#2A1F14',
    fontWeight: '700',
  },
});