import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Dimensions,
  FlatList,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroups, Group } from '../../contexts/GroupsContext';
import { ApiService } from '../../services/api';
import UsernameModal from '../../components/UsernameModal';

const { width } = Dimensions.get('window');

export default function GroupsTab() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const { groups, createGroup, loadGroups } = useGroups();
  const insets = useSafeAreaInsets();

  // Check for invite parameter on load
  useEffect(() => {
    const checkForInvite = async () => {
      try {
        if (typeof window !== 'undefined' && window.location) {
          const urlParams = new URLSearchParams(window.location.search);
          const inviteCode = urlParams.get('invite');
          console.log('Checking for invite code:', inviteCode);
          if (inviteCode) {
            console.log('Processing invite code:', inviteCode);
            console.log('API URL will be:', `https://group-event.vercel.app/api/invites/${inviteCode}`);
            
            // Process the invite
            const groupData = await ApiService.processInvite(inviteCode);
            console.log('Group data received:', groupData);
            
            // Join the group
            await ApiService.joinGroup(inviteCode);
            console.log('Successfully joined group');
            
            // Refresh groups
            await loadGroups();
            
            // Clear the invite parameter from URL to prevent re-processing
            if (typeof window !== 'undefined' && window.history && window.location) {
              const url = new URL(window.location.href);
              url.searchParams.delete('invite');
              window.history.replaceState({}, '', url.toString());
            }
            
            // Show username setup modal for new users
            setPendingGroupId(groupData.group_id);
            setShowUsernameModal(true);
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

  const handleCreateGroup = async () => {
    if (groupName.trim()) {
      try {
        await createGroup(groupName.trim());
        setGroupName('');
        setShowCreateModal(false);
      } catch (error) {
        console.error('Failed to create group:', error);
        // You could add error handling UI here
      }
    }
  };

  const handleCancel = () => {
    setGroupName('');
    setShowCreateModal(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadGroups();
    } catch (error) {
      console.error('Failed to refresh groups:', error);
    }
    setRefreshing(false);
  };

  const handleUsernameSetup = async (username: string) => {
    try {
      await ApiService.updateUsername(username);
      setShowUsernameModal(false);
      
      // Navigate to pending group if exists
      if (pendingGroupId) {
        router.push({
          pathname: '/group/[id]',
          params: { id: pendingGroupId }
        });
        setPendingGroupId(null);
      }
    } catch (error) {
      console.error('Failed to update username:', error);
    }
  };

  const handleUsernameSkip = () => {
    setShowUsernameModal(false);
    
    // Navigate to pending group if exists
    if (pendingGroupId) {
      router.push({
        pathname: '/group/[id]',
        params: { id: pendingGroupId }
      });
      setPendingGroupId(null);
    }
  };

  const handleGroupPress = (group: Group) => {
    router.push({
      pathname: '/group/[id]',
      params: { id: group.id }
    });
  };

  const GroupBlock = ({ group }: { group: Group }) => (
    <TouchableOpacity 
      style={styles.groupBlock} 
      activeOpacity={0.8}
      onPress={() => handleGroupPress(group)}
    >
      <View style={styles.groupContent}>
        <View style={styles.groupIconContainer}>
          <Ionicons name="people" size={24} color="#60a5fa" />
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMemberCount}>{group.memberCount} members</Text>
        </View>
        <View style={styles.groupArrow}>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Extended Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Groups</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor="#60a5fa"
            colors={["#60a5fa"]}
          />
        }
      >
        {/* Add Group Block */}
        <TouchableOpacity 
          style={styles.addGroupBlock} 
          activeOpacity={0.8}
          onPress={() => setShowCreateModal(true)}
        >
          <View style={styles.addGroupContent}>
            <View style={styles.addIconContainer}>
              <Ionicons name="add" size={32} color="#60a5fa" />
            </View>
            <View style={styles.addTextContainer}>
              <Text style={styles.addGroupTitle}>Create New Group</Text>
              <Text style={styles.addGroupSubtitle}>Start coordinating with friends</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Existing Groups */}
        {groups.map(group => (
          <GroupBlock key={group.id} group={group} />
        ))}
      </ScrollView>

      {/* Create Group Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCreateModal}
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
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
                onPress={handleCancel}
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

      <UsernameModal
        visible={showUsernameModal}
        onComplete={handleUsernameSetup}
        onSkip={handleUsernameSkip}
      />
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  refreshButton: {
    padding: 6,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  addGroupBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
  },
  addGroupContent: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addIconContainer: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  addTextContainer: {
    flex: 1,
  },
  addGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  addGroupSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  modalOverlay: {
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
  groupBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  groupContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIconContainer: {
    backgroundColor: '#2a2a2a',
    padding: 8,
    borderRadius: 6,
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  groupMemberCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
  groupArrow: {
    marginLeft: 8,
  },
});