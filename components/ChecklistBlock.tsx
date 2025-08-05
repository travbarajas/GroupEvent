import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiService } from '@/services/api';

interface ChecklistItem {
  id: string;
  itemName: string;
  addedBy: string;
  completed: boolean;
  assignedMembers: string[]; // device_ids of assigned members
  createdAt: string;
}

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
  profile_picture?: string;
}

interface ChecklistBlockProps {
  eventId: string;
  groupId: string;
  members: GroupMember[];
  currentDeviceId: string;
  eventName?: string;
}

// Sample data based on event type
const sampleChecklists = {
  beach: [
    { itemName: 'Sunscreen' },
    { itemName: 'Cooler with ice' },
    { itemName: 'Beach chairs' },
    { itemName: 'Snacks and drinks' },
    { itemName: 'Beach volleyball' },
    { itemName: 'Towels' },
    { itemName: 'Bluetooth speaker' },
  ],
  dinner: [
    { itemName: 'Appetizers' },
    { itemName: 'Main course' },
    { itemName: 'Dessert' },
    { itemName: 'Drinks/wine' },
    { itemName: 'Decorations' },
    { itemName: 'Plates and utensils' },
  ],
  default: [
    { itemName: 'Plan logistics' },
    { itemName: 'Send invitations' },
    { itemName: 'Coordinate timing' },
    { itemName: 'Prepare materials' },
    { itemName: 'Set up venue' },
  ],
};

export default function ChecklistBlock({
  eventId,
  groupId,
  members,
  currentDeviceId,
  eventName = '',
}: ChecklistBlockProps) {
  const insets = useSafeAreaInsets();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPeopleNeeded, setNewItemPeopleNeeded] = useState('1');

  const validMembers = members.filter(member => member.has_username && member.username);

  // Load checklist from API on component mount
  useEffect(() => {
    loadChecklist();
  }, [eventId, groupId]);

  const loadChecklist = async () => {
    try {
      const { checklistItems: apiItems } = await ApiService.getEventChecklist(groupId, eventId);
      
      // Transform API data to match our interface
      const transformedItems: ChecklistItem[] = apiItems.map((item: any) => ({
        id: item.id,
        itemName: item.item_name,
        addedBy: item.added_by,
        completed: item.completed,
        assignedMembers: item.assigned_members?.map((assignment: any) => assignment.device_id) || [],
        createdAt: item.created_at,
      }));
      
      setChecklistItems(transformedItems);
    } catch (error) {
      // If API fails, continue with empty state - user can generate or add items
      setChecklistItems([]);
    }
  };

  // Determine checklist type based on event name
  const getChecklistType = (eventName: string): keyof typeof sampleChecklists => {
    const lowerName = eventName.toLowerCase();
    if (lowerName.includes('beach') || lowerName.includes('pool') || lowerName.includes('swim')) {
      return 'beach';
    }
    if (lowerName.includes('dinner') || lowerName.includes('party') || lowerName.includes('meal')) {
      return 'dinner';
    }
    return 'default';
  };

  const generateChecklist = async () => {
    const checklistType = getChecklistType(eventName);
    const sampleItems = sampleChecklists[checklistType];
    
    try {
      // Create optimistic items immediately for UI responsiveness
      const optimisticItems: ChecklistItem[] = sampleItems.map((item, index) => ({
        id: `optimistic-${Date.now()}-${index}`,
        itemName: item.itemName,
        addedBy: currentDeviceId,
        completed: false,
        assignedMembers: [],
        createdAt: new Date().toISOString(),
      }));

      setChecklistItems(optimisticItems);

      // Create items via API in the background
      const createPromises = sampleItems.map(item => 
        ApiService.createChecklistItem(groupId, eventId, {
          item_name: item.itemName,
          people_needed: 1
        })
      );

      await Promise.all(createPromises);

      // Reload from API to get real IDs and ensure consistency
      await loadChecklist();
      
    } catch (error) {
      Alert.alert('Error', 'Failed to generate checklist. Please try again.');
      // Revert optimistic update on error
      setChecklistItems([]);
    }
  };

  const toggleItemCompletion = async (itemId: string) => {
    try {
      // Optimistic update
      setChecklistItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ));

      // Update via API
      await ApiService.updateChecklistItem(groupId, eventId, itemId, 'toggle_completion');
    } catch (error) {
      // Revert optimistic update on error
      setChecklistItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ));
      Alert.alert('Error', 'Failed to update item. Please try again.');
    }
  };

  const deleteItem = async (itemId: string) => {
    const item = checklistItems.find(i => i.id === itemId);
    if (item && item.addedBy !== currentDeviceId) {
      Alert.alert('Error', 'You can only delete items you created.');
      return;
    }
    
    try {
      // Optimistic update
      const previousItems = checklistItems;
      setChecklistItems(prev => prev.filter(item => item.id !== itemId));

      // Delete via API
      await ApiService.deleteChecklistItem(groupId, eventId, itemId);
    } catch (error) {
      // Revert optimistic update on error
      setChecklistItems(checklistItems);
      Alert.alert('Error', 'Failed to delete item. Please try again.');
    }
  };


  const toggleMyAssignment = async (itemId: string) => {
    try {
      const item = checklistItems.find(i => i.id === itemId);
      if (!item) return;

      const isCurrentlyAssigned = item.assignedMembers.includes(currentDeviceId);
      const newAssignedMembers = isCurrentlyAssigned
        ? item.assignedMembers.filter(id => id !== currentDeviceId)
        : [...item.assignedMembers, currentDeviceId];

      // Optimistic update
      setChecklistItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, assignedMembers: newAssignedMembers } : i
      ));

      // Update via API
      await ApiService.updateChecklistItem(groupId, eventId, itemId, 'update_assignments', {
        assigned_members: newAssignedMembers
      });
    } catch (error) {
      // Revert optimistic update on error
      setChecklistItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, assignedMembers: item.assignedMembers } : item
      ));
      Alert.alert('Error', 'Failed to update assignment. Please try again.');
    }
  };

  const addCustomItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    const peopleCount = parseInt(newItemPeopleNeeded) || 1;
    
    try {
      // Create optimistic item
      const optimisticItem: ChecklistItem = {
        id: `optimistic-${Date.now()}`,
        itemName: newItemName.trim(),
        addedBy: currentDeviceId,
        completed: false,
        assignedMembers: [],
        createdAt: new Date().toISOString(),
      };

      setChecklistItems(prev => [...prev, optimisticItem]);
      setNewItemName('');
      setNewItemPeopleNeeded('1');
      setShowAddItemModal(false);

      // Create via API
      await ApiService.createChecklistItem(groupId, eventId, {
        item_name: newItemName.trim(),
        people_needed: peopleCount
      });

      // Reload to get real ID and ensure consistency
      await loadChecklist();
    } catch (error) {
      // Revert optimistic update on error
      setChecklistItems(prev => prev.filter(item => !item.id.startsWith('optimistic-')));
      setShowAddItemModal(true);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  };

  const renderMemberAvatars = (assignedMembers: string[]) => {
    if (assignedMembers.length === 0) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person-add-outline" size={14} color="#6b7280" />
        </View>
      );
    }

    return (
      <View style={styles.avatarContainer}>
        {assignedMembers.slice(0, 4).map((deviceId, index) => {
          const member = validMembers.find(m => m.device_id === deviceId);
          return (
            <View 
              key={deviceId} 
              style={[
                styles.avatar, 
                { marginLeft: index > 0 ? -6 : 0 }
              ]}
            >
              <Text style={styles.avatarText}>
                {member?.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          );
        })}
        {assignedMembers.length > 4 && (
          <View style={[styles.avatar, styles.avatarMore, { marginLeft: -6 }]}>
            <Text style={styles.avatarText}>+{assignedMembers.length - 4}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderChecklistItem = (item: ChecklistItem) => {
    const addedByMember = validMembers.find(m => m.device_id === item.addedBy);
    const canDelete = item.addedBy === currentDeviceId;

    return (
      <View 
        key={item.id} 
        style={styles.checklistItem}
      >
        {/* Combined Assigned Members & Completion Status */}
        <TouchableOpacity 
          style={styles.assignedSection}
          onPress={() => toggleMyAssignment(item.id)}
          activeOpacity={0.8}
        >
          {renderMemberAvatars(item.assignedMembers)}
        </TouchableOpacity>

        {/* Item Name */}
        <TouchableOpacity 
          style={styles.itemNameSection}
          onPress={() => toggleMyAssignment(item.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.itemName}>
            {item.itemName}
          </Text>
        </TouchableOpacity>

        {/* Added By */}
        <View style={styles.addedBySection}>
          <Text style={styles.addedByText}>
            {addedByMember?.username || 'Unknown'}
          </Text>
        </View>

        {/* Delete Button */}
        {canDelete && (
          <TouchableOpacity 
            style={styles.deleteSection}
            onPress={() => deleteItem(item.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={12} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.checklistBlock}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="list" size={20} color="#60a5fa" />
            <Text style={styles.title}>Event Checklist</Text>
          </View>
          
          {checklistItems.length === 0 ? (
            <TouchableOpacity 
              style={styles.generateButton}
              onPress={generateChecklist}
            >
              <Ionicons name="sparkles" size={16} color="#10b981" />
              <Text style={styles.generateButtonText}>Generate Checklist</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddItemModal(true)}
            >
              <Ionicons name="add" size={16} color="#10b981" />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          )}
        </View>

        {checklistItems.length > 0 && (
          <View style={styles.separator} />
        )}

        <View style={styles.checklistContent}>
          {checklistItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyStateText}>No checklist yet</Text>
              <Text style={styles.emptyStateSubtext}>Generate a checklist to get started</Text>
            </View>
          ) : (
            <>
              {/* Column Headers */}
              <View style={styles.columnHeaders}>
                <View style={styles.headerAssignedSection}>
                  <Text style={styles.columnHeaderText}>Assigned & Done</Text>
                </View>
                <View style={styles.headerItemNameSection}>
                  <Text style={styles.columnHeaderText}>Task Name</Text>
                </View>
                <View style={styles.headerAddedBySection}>
                  <Text style={styles.columnHeaderText}>Added By</Text>
                </View>
                <View style={styles.headerDeleteSection}>
                  {/* Empty for delete button column */}
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {checklistItems.map(renderChecklistItem)}
              </ScrollView>
            </>
          )}
        </View>
      </View>


      {/* Add Item Modal */}
      <AddItemModal 
        visible={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        newItemName={newItemName}
        setNewItemName={setNewItemName}
        newItemPeopleNeeded={newItemPeopleNeeded}
        setNewItemPeopleNeeded={setNewItemPeopleNeeded}
        onAddItem={addCustomItem}
      />
    </View>
  );
}


// Add Item Modal Component
function AddItemModal({
  visible,
  onClose,
  newItemName,
  setNewItemName,
  newItemPeopleNeeded,
  setNewItemPeopleNeeded,
  onAddItem,
}: {
  visible: boolean;
  onClose: () => void;
  newItemName: string;
  setNewItemName: (name: string) => void;
  newItemPeopleNeeded: string;
  setNewItemPeopleNeeded: (count: string) => void;
  onAddItem: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalBackButton}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Checklist Item</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Item Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Bring snacks"
              placeholderTextColor="#9ca3af"
              value={newItemName}
              onChangeText={setNewItemName}
            />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>People Needed</Text>
            <TextInput
              style={styles.textInput}
              placeholder="1"
              placeholderTextColor="#9ca3af"
              value={newItemPeopleNeeded}
              onChangeText={setNewItemPeopleNeeded}
              keyboardType="number-pad"
            />
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSaveButton} onPress={onAddItem}>
            <Text style={styles.modalSaveButtonText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  checklistBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  generateButtonText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginBottom: 16,
  },
  checklistContent: {
    minHeight: 120,
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  columnHeaderText: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '600',
    textAlign: 'center',
  },
  headerAssignedSection: {
    width: 80,
    marginRight: 8,
    alignItems: 'center',
  },
  headerItemNameSection: {
    flex: 1,
    marginRight: 8,
    alignItems: 'flex-start',
  },
  headerAddedBySection: {
    width: 60,
    marginRight: 6,
    alignItems: 'center',
  },
  headerDeleteSection: {
    width: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  completedItem: {
    // No special styling for completed items
  },
  assignedSection: {
    width: 80,
    marginRight: 8,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: '#4a4a4a',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  avatarMore: {
    backgroundColor: '#6b7280',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  avatarCompleted: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  avatarCheckmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10b981',
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  itemNameSection: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  completedText: {
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  addedBySection: {
    width: 60,
    marginRight: 6,
  },
  addedByText: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  deleteSection: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBackButton: {
    padding: 8,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  modalHeaderSpacer: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  taskDetailsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  taskPeopleNeeded: {
    fontSize: 14,
    color: '#9ca3af',
  },
  memberList: {
    gap: 12,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  memberOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  memberName: {
    fontSize: 14,
    color: '#e5e7eb',
    flex: 1,
  },
  memberNameSelected: {
    color: '#ffffff',
    fontWeight: '500',
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
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});