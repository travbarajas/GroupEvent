import React from 'react';
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
import { useGroups, Group, Event } from '@/contexts/GroupsContext';

const { width } = Dimensions.get('window');

interface GroupSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  event: Event;
  onGroupSelected: (group: Group, event: Event) => void;
}

export default function GroupSelectionModal({ 
  visible, 
  onClose, 
  event, 
  onGroupSelected 
}: GroupSelectionModalProps) {
  const { groups } = useGroups();

  const handleGroupSelect = (group: Group) => {
    onGroupSelected(group, event);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.modalTitle}>Add to Group</Text>
              <Text style={styles.modalSubtitle}>Choose a group for "{event?.name || 'this event'}"</Text>
            </View>
            <View style={styles.headerRight} />
          </View>
          
          <ScrollView style={styles.groupsList} showsVerticalScrollIndicator={false}>
            {groups.filter(group => group != null).map((group) => (
              <TouchableOpacity 
                key={group.id} 
                style={styles.groupItem}
                onPress={() => handleGroupSelect(group)}
                activeOpacity={0.7}
              >
                <View style={styles.groupIcon}>
                  <Ionicons name="people" size={20} color="#60a5fa" />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group?.name || 'Unnamed Group'}</Text>
                  <Text style={styles.groupMemberCount}>
                    {group?.memberCount || 0} member{(group?.memberCount || 0) === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.groupArrow}>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            ))}
            
            {groups.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#4b5563" />
                <Text style={styles.emptyTitle}>No Groups</Text>
                <Text style={styles.emptySubtitle}>
                  Create a group first to add events to it
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    minHeight: '50%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  groupsList: {
    flex: 1,
    padding: 20,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  groupMemberCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
  groupArrow: {
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});