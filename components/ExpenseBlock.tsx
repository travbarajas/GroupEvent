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

interface ExpenseParticipant {
  device_id: string;
  role: 'payer' | 'ower';
  individual_amount: number;
  payment_status: 'pending' | 'sent' | 'completed';
}

interface ExpenseItem {
  id: string;
  description: string;
  total_amount: number;
  addedBy: string;
  participants: ExpenseParticipant[];
  createdAt: string;
}

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface ExpenseBlockProps {
  groupId: string;
  members: GroupMember[];
  currentDeviceId: string;
}

// Sample data for testing
const sampleExpenses = [
  { description: 'Dinner at restaurant' },
  { description: 'Uber ride' },
  { description: 'Groceries for party' },
  { description: 'Movie tickets' },
  { description: 'Gas for road trip' },
];

export default function ExpenseBlock({
  groupId,
  members,
  currentDeviceId,
}: ExpenseBlockProps) {
  const insets = useSafeAreaInsets();
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(new Set());
  const [selectedOwers, setSelectedOwers] = useState<Set<string>>(new Set());
  const [owersPercentages, setOwersPercentages] = useState<{[key: string]: number}>({});

  const validMembers = members.filter(member => member.has_username && member.username);

  // Load expenses from API on component mount
  useEffect(() => {
    loadExpenses();
  }, [groupId]);

  const loadExpenses = async () => {
    try {
      const { expenses: apiExpenses } = await ApiService.getGroupExpenses(groupId);
      
      // Transform API data to match our interface
      const transformedExpenses: ExpenseItem[] = apiExpenses.map((expense: any) => ({
        id: expense.id,
        description: expense.description,
        total_amount: expense.total_amount,
        addedBy: expense.created_by_device_id,
        participants: expense.participants || [],
        createdAt: expense.created_at,
      }));
      
      setExpenseItems(transformedExpenses);
    } catch (error) {
      // If API fails, continue with empty state
      setExpenseItems([]);
    }
  };

  const generateExpenses = async () => {
    try {
      // Create optimistic items immediately for UI responsiveness
      const optimisticExpenses: ExpenseItem[] = sampleExpenses.map((expense, index) => ({
        id: `optimistic-${Date.now()}-${index}`,
        description: expense.description,
        total_amount: 25.00 + (index * 10), // Sample amounts
        addedBy: currentDeviceId,
        participants: [],
        createdAt: new Date().toISOString(),
      }));

      setExpenseItems(optimisticExpenses);

      // Create expenses via API in the background
      const createPromises = sampleExpenses.map((expense, index) => 
        ApiService.createGroupExpense(groupId, {
          description: expense.description,
          totalAmount: 25.00 + (index * 10),
          paidBy: [currentDeviceId],
          splitBetween: [currentDeviceId]
        })
      );

      await Promise.all(createPromises);

      // Reload from API to get real IDs and ensure consistency
      await loadExpenses();
      
    } catch (error) {
      Alert.alert('Error', 'Failed to generate expenses. Please try again.');
      // Revert optimistic update on error
      setExpenseItems([]);
    }
  };

  const toggleMyParticipation = async (expenseId: string) => {
    try {
      const expense = expenseItems.find(e => e.id === expenseId);
      if (!expense) return;

      const isCurrentlyParticipating = expense.participants.some(p => p.device_id === currentDeviceId);
      
      let newParticipants;
      if (isCurrentlyParticipating) {
        // Remove user from participants
        newParticipants = expense.participants.filter(p => p.device_id !== currentDeviceId);
      } else {
        // Add user as an ower
        newParticipants = [...expense.participants, {
          device_id: currentDeviceId,
          role: 'ower' as const,
          individual_amount: expense.total_amount / (expense.participants.length + 1),
          payment_status: 'pending' as const
        }];
      }

      // Optimistic update
      setExpenseItems(prev => prev.map(e => 
        e.id === expenseId ? { ...e, participants: newParticipants } : e
      ));

      // Update via API (you'll need to implement this endpoint)
      // await ApiService.updateExpenseParticipants(groupId, expenseId, newParticipants);
    } catch (error) {
      // Revert optimistic update on error
      setExpenseItems(prev => prev.map(expense => 
        expense.id === expenseId ? { ...expense, participants: expense.participants } : expense
      ));
      Alert.alert('Error', 'Failed to update participation. Please try again.');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    const expense = expenseItems.find(e => e.id === expenseId);
    if (expense && expense.addedBy !== currentDeviceId) {
      Alert.alert('Error', 'You can only delete expenses you created.');
      return;
    }
    
    try {
      // Optimistic update
      const previousExpenses = expenseItems;
      setExpenseItems(prev => prev.filter(expense => expense.id !== expenseId));

      // Delete via API
      await ApiService.deleteGroupExpense(groupId, expenseId);
    } catch (error) {
      // Revert optimistic update on error
      setExpenseItems(expenseItems);
      Alert.alert('Error', 'Failed to delete expense. Please try again.');
    }
  };

  const addCustomExpense = async () => {
    if (!newExpenseDescription.trim()) {
      Alert.alert('Error', 'Please enter an expense description');
      return;
    }

    const amount = parseFloat(newExpenseAmount) || 0;
    if (amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      // Create optimistic expense
      const optimisticExpense: ExpenseItem = {
        id: `optimistic-${Date.now()}`,
        description: newExpenseDescription.trim(),
        total_amount: amount,
        addedBy: currentDeviceId,
        participants: [],
        createdAt: new Date().toISOString(),
      };

      setExpenseItems(prev => [...prev, optimisticExpense]);
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setShowAddExpenseModal(false);

      // Create via API
      await ApiService.createGroupExpense(groupId, {
        description: newExpenseDescription.trim(),
        totalAmount: amount,
        paidBy: Array.from(selectedPayers),
        splitBetween: Array.from(selectedOwers)
      });

      // Reload to get real ID and ensure consistency
      await loadExpenses();
    } catch (error) {
      // Revert optimistic update on error
      setExpenseItems(prev => prev.filter(expense => !expense.id.startsWith('optimistic-')));
      setShowAddExpenseModal(true);
      Alert.alert('Error', 'Failed to add expense. Please try again.');
    }
  };

  const renderParticipantAvatars = (participants: ExpenseParticipant[]) => {
    if (participants.length === 0) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person-add-outline" size={14} color="#6b7280" />
        </View>
      );
    }

    return (
      <View style={styles.avatarContainer}>
        {participants.slice(0, 4).map((participant, index) => {
          const member = validMembers.find(m => m.device_id === participant.device_id);
          return (
            <View 
              key={`${participant.device_id}-${participant.role}`} 
              style={[
                styles.avatar, 
                { marginLeft: index > 0 ? -6 : 0 }
              ]}
            >
              <Text style={styles.avatarText}>
                {member?.username?.[0]?.toUpperCase() || '?'}
              </Text>
              {/* Role indicator */}
              <View style={participant.role === 'payer' ? styles.payerIndicator : styles.owerIndicator}>
                <Text style={styles.indicatorText}>
                  {participant.role === 'payer' ? '+' : '-'}
                </Text>
              </View>
            </View>
          );
        })}
        {participants.length > 4 && (
          <View style={[styles.avatar, styles.avatarMore, { marginLeft: -6 }]}>
            <Text style={styles.avatarText}>+{participants.length - 4}</Text>
          </View>
        )}
      </View>
    );
  };

  const getPaymentStatus = (participants: ExpenseParticipant[]) => {
    const owers = participants.filter(p => p.role === 'ower');
    
    if (owers.length === 0) return 'completed';
    
    const completedCount = owers.filter(p => p.payment_status === 'completed').length;
    const sentCount = owers.filter(p => p.payment_status === 'sent').length;
    
    if (completedCount === owers.length) return 'completed';
    if (sentCount > 0 || completedCount > 0) return 'in_progress';
    return 'pending';
  };

  const renderPaymentStatusCircle = (participants: ExpenseParticipant[]) => {
    const status = getPaymentStatus(participants);
    
    let statusColor, statusIcon;
    switch (status) {
      case 'completed':
        statusColor = '#10b981';
        statusIcon = 'checkmark-circle';
        break;
      case 'in_progress':
        statusColor = '#f59e0b';
        statusIcon = 'time';
        break;
      default:
        statusColor = '#6b7280';
        statusIcon = 'ellipse-outline';
    }

    return (
      <View style={styles.statusSection}>
        <Ionicons name={statusIcon} size={16} color={statusColor} />
      </View>
    );
  };

  const renderExpenseItem = (expense: ExpenseItem) => {
    const addedByMember = validMembers.find(m => m.device_id === expense.addedBy);
    const canDelete = expense.addedBy === currentDeviceId;

    return (
      <View 
        key={expense.id} 
        style={styles.expenseItem}
      >
        {/* Participant Avatars */}
        <TouchableOpacity 
          style={styles.participantSection}
          onPress={() => toggleMyParticipation(expense.id)}
          activeOpacity={0.8}
        >
          {renderParticipantAvatars(expense.participants)}
        </TouchableOpacity>

        {/* Payment Status Circle */}
        {renderPaymentStatusCircle(expense.participants)}

        {/* Expense Description */}
        <TouchableOpacity 
          style={styles.descriptionSection}
          onPress={() => toggleMyParticipation(expense.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.description}>
            {expense.description}
          </Text>
        </TouchableOpacity>

        {/* Total Amount */}
        <View style={styles.amountSection}>
          <Text style={styles.amount}>
            ${expense.total_amount.toFixed(2)}
          </Text>
        </View>

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
            onPress={() => deleteExpense(expense.id)}
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
      <View style={styles.expenseBlock}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="wallet" size={20} color="#60a5fa" />
            <Text style={styles.title}>Group Expenses</Text>
          </View>
          
          {expenseItems.length === 0 ? (
            <TouchableOpacity 
              style={styles.generateButton}
              onPress={generateExpenses}
            >
              <Ionicons name="sparkles" size={16} color="#10b981" />
              <Text style={styles.generateButtonText}>Generate Expenses</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddExpenseModal(true)}
            >
              <Ionicons name="add" size={16} color="#10b981" />
              <Text style={styles.addButtonText}>Add Expense</Text>
            </TouchableOpacity>
          )}
        </View>

        {expenseItems.length > 0 && (
          <View style={styles.separator} />
        )}

        <View style={styles.expenseContent}>
          {expenseItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyStateText}>No expenses yet</Text>
              <Text style={styles.emptyStateSubtext}>Generate expenses to get started</Text>
            </View>
          ) : (
            <>
              {/* Column Headers */}
              <View style={styles.columnHeaders}>
                <View style={styles.headerParticipantSection}>
                  <Text style={styles.columnHeaderText}>Participants</Text>
                </View>
                <View style={styles.headerStatusSection}>
                  <Text style={styles.columnHeaderText}>Status</Text>
                </View>
                <View style={styles.headerDescriptionSection}>
                  <Text style={styles.columnHeaderText}>Description</Text>
                </View>
                <View style={styles.headerAmountSection}>
                  <Text style={styles.columnHeaderText}>Amount</Text>
                </View>
                <View style={styles.headerAddedBySection}>
                  <Text style={styles.columnHeaderText}>Added By</Text>
                </View>
                <View style={styles.headerDeleteSection}>
                  {/* Empty for delete button column */}
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {expenseItems.map(renderExpenseItem)}
              </ScrollView>
            </>
          )}
        </View>
      </View>

      {/* Add Expense Modal */}
      <AddExpenseModal 
        visible={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        newExpenseDescription={newExpenseDescription}
        setNewExpenseDescription={setNewExpenseDescription}
        newExpenseAmount={newExpenseAmount}
        setNewExpenseAmount={setNewExpenseAmount}
        onAddExpense={addCustomExpense}
        members={validMembers}
        selectedPayers={selectedPayers}
        setSelectedPayers={setSelectedPayers}
        selectedOwers={selectedOwers}
        setSelectedOwers={setSelectedOwers}
        owersPercentages={owersPercentages}
        setOwersPercentages={setOwersPercentages}
      />
    </View>
  );
}

// Add Expense Modal Component (matching AddItemModal from checklist)
function AddExpenseModal({
  visible,
  onClose,
  newExpenseDescription,
  setNewExpenseDescription,
  newExpenseAmount,
  setNewExpenseAmount,
  onAddExpense,
  members,
  selectedPayers,
  setSelectedPayers,
  selectedOwers,
  setSelectedOwers,
  owersPercentages,
  setOwersPercentages,
}: {
  visible: boolean;
  onClose: () => void;
  newExpenseDescription: string;
  setNewExpenseDescription: (description: string) => void;
  newExpenseAmount: string;
  setNewExpenseAmount: (amount: string) => void;
  onAddExpense: () => void;
  members: GroupMember[];
  selectedPayers: Set<string>;
  setSelectedPayers: (payers: Set<string>) => void;
  selectedOwers: Set<string>;
  setSelectedOwers: (owers: Set<string>) => void;
  owersPercentages: {[key: string]: number};
  setOwersPercentages: (percentages: {[key: string]: number}) => void;
}) {
  const insets = useSafeAreaInsets();

  const togglePayer = (deviceId: string) => {
    const newPayers = new Set(selectedPayers);
    if (newPayers.has(deviceId)) {
      newPayers.delete(deviceId);
    } else {
      newPayers.add(deviceId);
    }
    setSelectedPayers(newPayers);
  };

  const toggleOwer = (deviceId: string) => {
    const newOwers = new Set(selectedOwers);
    if (newOwers.has(deviceId)) {
      newOwers.delete(deviceId);
      const newPercentages = { ...owersPercentages };
      delete newPercentages[deviceId];
      
      // Redistribute percentages equally
      const remainingMembers = Array.from(newOwers);
      if (remainingMembers.length > 0) {
        const equalPercentage = Math.floor(100 / remainingMembers.length);
        remainingMembers.forEach(id => {
          newPercentages[id] = equalPercentage;
        });
      }
      setOwersPercentages(newPercentages);
    } else {
      newOwers.add(deviceId);
      
      // Redistribute percentages equally among all selected owers
      const newPercentages = { ...owersPercentages };
      const allOwers = Array.from(newOwers);
      const equalPercentage = Math.floor(100 / allOwers.length);
      allOwers.forEach(id => {
        newPercentages[id] = equalPercentage;
      });
      setOwersPercentages(newPercentages);
    }
    setSelectedOwers(newOwers);
  };

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
          <Text style={styles.modalTitle}>Add Expense</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Expense Description</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Dinner at restaurant"
              placeholderTextColor="#9ca3af"
              value={newExpenseDescription}
              onChangeText={setNewExpenseDescription}
            />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Total Amount</Text>
            <TextInput
              style={styles.textInput}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              value={newExpenseAmount}
              onChangeText={setNewExpenseAmount}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Who Paid?</Text>
            <View style={styles.memberList}>
              {members.map(member => (
                <TouchableOpacity
                  key={`payer-${member.device_id}`}
                  style={[
                    styles.memberOption,
                    selectedPayers.has(member.device_id) && styles.memberOptionSelected
                  ]}
                  onPress={() => togglePayer(member.device_id)}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {member.username?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <Text style={[
                    styles.memberName,
                    selectedPayers.has(member.device_id) && styles.memberNameSelected
                  ]}>
                    {member.username}
                  </Text>
                  {selectedPayers.has(member.device_id) && (
                    <Ionicons name="checkmark" size={20} color="#10b981" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Split Between</Text>
            <View style={styles.memberList}>
              {members.map(member => (
                <View key={`ower-${member.device_id}`}>
                  <TouchableOpacity
                    style={[
                      styles.memberOption,
                      selectedOwers.has(member.device_id) && styles.memberOptionSelected
                    ]}
                    onPress={() => toggleOwer(member.device_id)}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={[
                      styles.memberName,
                      selectedOwers.has(member.device_id) && styles.memberNameSelected
                    ]}>
                      {member.username}
                    </Text>
                    {selectedOwers.has(member.device_id) && (
                      <Text style={styles.percentageText}>
                        {owersPercentages[member.device_id] || 0}%
                      </Text>
                    )}
                  </TouchableOpacity>
                  
                  {selectedOwers.has(member.device_id) && newExpenseAmount && (
                    <View style={styles.calculatedAmount}>
                      <Text style={styles.calculatedAmountText}>
                        ${((parseFloat(newExpenseAmount) || 0) * (owersPercentages[member.device_id] || 0) / 100).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSaveButton} onPress={onAddExpense}>
            <Text style={styles.modalSaveButtonText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Styles copied and adapted from ChecklistBlock
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  expenseBlock: {
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
  expenseContent: {
    minHeight: 120,
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
  headerParticipantSection: {
    width: 80,
    marginRight: 8,
    alignItems: 'center',
  },
  headerStatusSection: {
    width: 32,
    alignItems: 'center',
    marginRight: 8,
  },
  headerDescriptionSection: {
    flex: 1,
    marginRight: 8,
    alignItems: 'flex-start',
  },
  headerAmountSection: {
    width: 70,
    alignItems: 'center',
    marginRight: 8,
  },
  headerAddedBySection: {
    width: 60,
    marginRight: 6,
    alignItems: 'center',
  },
  headerDeleteSection: {
    width: 20,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  participantSection: {
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
    position: 'relative',
  },
  avatarMore: {
    backgroundColor: '#6b7280',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  payerIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10b981',
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  owerIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  indicatorText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusSection: {
    width: 32,
    alignItems: 'center',
    marginRight: 8,
  },
  descriptionSection: {
    flex: 1,
    marginRight: 8,
  },
  description: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  amountSection: {
    width: 70,
    alignItems: 'flex-end',
    marginRight: 8,
  },
  amount: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
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
  // Modal Styles (copied from checklist)
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
  percentageText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  calculatedAmount: {
    marginLeft: 44,
    paddingLeft: 12,
    paddingTop: 4,
  },
  calculatedAmountText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
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