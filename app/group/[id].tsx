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

const { width } = Dimensions.get('window');
const squareSize = (width - 48) / 2; // Account for padding and gap

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams();
  const { getGroup, loadGroups } = useGroups();
  const insets = useSafeAreaInsets();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [permissions, setPermissions] = useState<any>(null);
  
  const group = getGroup(id as string);
  
  useEffect(() => {
    if (id) {
      fetchInviteCode();
      fetchPermissions();
    }
  }, [id]);

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

  const handleRefresh = async () => {
    try {
      await loadGroups(); // Refresh the groups list
      await fetchInviteCode(); // Refresh invite code
      await fetchPermissions(); // Refresh permissions
    } catch (error) {
      console.error('Failed to refresh group data:', error);
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

  const CalendarSquare = () => (
    <TouchableOpacity style={styles.square} activeOpacity={0.8}>
      <View style={styles.squareHeader}>
        <Ionicons name="calendar" size={24} color="#60a5fa" />
        <Text style={styles.squareTitle}>Calendar</Text>
      </View>
      <View style={styles.squareContent}>
        <Text style={styles.squareDescription}>Schedule & availability</Text>
      </View>
    </TouchableOpacity>
  );

  const MoneySquare = () => (
    <TouchableOpacity style={styles.square} activeOpacity={0.8}>
      <View style={styles.squareHeader}>
        <Ionicons name="card" size={24} color="#4ade80" />
        <Text style={styles.squareTitle}>Money</Text>
      </View>
      <View style={styles.squareContent}>
        <Text style={styles.squareDescription}>Budget & expenses</Text>
      </View>
    </TouchableOpacity>
  );

  const EventBlock = ({ event }: { event: any }) => (
    <TouchableOpacity style={styles.eventBlock} activeOpacity={0.8}>
      <View style={styles.eventContent}>
        <View style={styles.eventLeft}>
          <View style={styles.eventIconContainer}>
            <Ionicons 
              name={event.status === 'confirmed' ? 'checkmark-circle' : 'time'} 
              size={20} 
              color={event.status === 'confirmed' ? '#4ade80' : '#fb923c'} 
            />
          </View>
          <View style={styles.eventInfo}>
            <Text style={styles.eventName}>{event.name}</Text>
            <Text style={styles.eventDate}>{event.date}</Text>
            <Text style={styles.eventParticipants}>{event.participantCount} people</Text>
          </View>
        </View>
        <View style={styles.eventArrow}>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </View>
      </View>
    </TouchableOpacity>
  );

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
            <TouchableOpacity style={styles.headerLeaveButton} onPress={handleLeaveGroup}>
              <Ionicons name="close" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Group Info Block - Full Width */}
      <View style={styles.groupInfoBlock}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupDescription}>Ready to plan some events together!</Text>
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
          {sampleEvents.map(event => (
            <EventBlock key={event.id} event={event} />
          ))}
          
          {/* Add Event Block */}
          <TouchableOpacity style={styles.addEventBlock} activeOpacity={0.8}>
            <View style={styles.addEventContent}>
              <View style={styles.addEventIconContainer}>
                <Ionicons name="add" size={20} color="#ffffff" />
              </View>
              <Text style={styles.addEventText}>Create New Event</Text>
            </View>
          </TouchableOpacity>
          
          {sampleEvents.length === 0 && (
            <View style={styles.noEventsContainer}>
              <Text style={styles.noEventsText}>No events yet</Text>
              <Text style={styles.noEventsSubtext}>Create your first event to get started!</Text>
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
  },
  inviteButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginRight: 12,
  },
  inviteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerLeaveButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#ef4444',
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
});