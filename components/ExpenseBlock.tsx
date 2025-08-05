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
import Slider from '@react-native-community/slider';
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
  name: string;
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
  const [lockedPercentages, setLockedPercentages] = useState<Set<string>>(new Set());
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);

  const validMembers = members.filter(member => member.has_username && member.username);

  // Load expenses from API on component mount
  useEffect(() => {
    loadExpenses();
  }, [groupId]);

  const loadExpenses = async () => {
    try {
      const { expenses: apiExpenses } = await ApiService.getGroupExpenses(groupId);
      
      // Transform API data to match our interface
      const transformedExpenses: ExpenseItem[] = apiExpenses.map((expense: any) => {
        // Create participants array from API data
        const participants: ExpenseParticipant[] = [];
        
        // Add payers
        if (expense.payers && Array.isArray(expense.payers)) {
          expense.payers.forEach((payerDeviceId: string) => {
            participants.push({
              device_id: payerDeviceId,
              role: 'payer',
              individual_amount: 0,
              payment_status: 'pending'
            });
          });
        }
        
        // Add owers
        if (expense.owers && Array.isArray(expense.owers)) {
          expense.owers.forEach((owerDeviceId: string) => {
            const percentage = expense.owers_percentages?.[owerDeviceId] || 0;
            participants.push({
              device_id: owerDeviceId,
              role: 'ower',
              individual_amount: (parseFloat(expense.total_amount) || 0) * percentage / 100,
              payment_status: expense.payment_status?.[owerDeviceId] || 'pending'
            });
          });
        }
        
        return {
          id: expense.id,
          name: expense.description || 'Untitled Expense',
          total_amount: parseFloat(expense.total_amount) || 0,
          addedBy: expense.created_by_device_id,
          participants: participants,
          createdAt: expense.created_at,
        };
      });
      
      setExpenseItems(transformedExpenses);
    } catch (error) {
      // If API fails, continue with empty state
      setExpenseItems([]);
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
      // Create optimistic expense with participants
      const payerParticipants: ExpenseParticipant[] = Array.from(selectedPayers).map(deviceId => ({
        device_id: deviceId,
        role: 'payer' as const,
        individual_amount: 0, // Payers don't owe anything
        payment_status: 'pending' as const
      }));
      
      const owerParticipants: ExpenseParticipant[] = Array.from(selectedOwers).map(deviceId => ({
        device_id: deviceId,
        role: 'ower' as const,
        individual_amount: (amount * (owersPercentages[deviceId] || 0)) / 100,
        payment_status: 'pending' as const
      }));
      
      const optimisticExpense: ExpenseItem = {
        id: `optimistic-${Date.now()}`,
        name: newExpenseDescription.trim(),
        total_amount: amount,
        addedBy: currentDeviceId,
        participants: [...payerParticipants, ...owerParticipants],
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

  const renderPayerAvatars = (participants: ExpenseParticipant[]) => {
    // Show people who paid upfront
    const payers = participants.filter(p => p.role === 'payer');
    
    if (payers.length === 0) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.placeholderText}>-</Text>
        </View>
      );
    }

    return (
      <View style={styles.avatarContainer}>
        {payers.slice(0, 3).map((participant, index) => {
          const member = validMembers.find(m => m.device_id === participant.device_id);
          return (
            <View 
              key={`payer-${participant.device_id}`} 
              style={[
                styles.avatar, 
                styles.payerAvatar,
                { marginLeft: index > 0 ? -4 : 0 }
              ]}
            >
              <Text style={styles.avatarText}>
                {member?.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          );
        })}
        {payers.length > 3 && (
          <View style={[styles.avatar, styles.avatarMore, { marginLeft: -4 }]}>
            <Text style={styles.avatarText}>+{payers.length - 3}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderOwerAvatars = (participants: ExpenseParticipant[]) => {
    // Show people who owe money
    const owers = participants.filter(p => p.role === 'ower');
    
    if (owers.length === 0) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.placeholderText}>-</Text>
        </View>
      );
    }

    return (
      <View style={styles.avatarContainer}>
        {owers.slice(0, 3).map((participant, index) => {
          const member = validMembers.find(m => m.device_id === participant.device_id);
          return (
            <View 
              key={`ower-${participant.device_id}`} 
              style={[
                styles.avatar,
                styles.owerAvatar, 
                { marginLeft: index > 0 ? -4 : 0 }
              ]}
            >
              <Text style={styles.avatarText}>
                {member?.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          );
        })}
        {owers.length > 3 && (
          <View style={[styles.avatar, styles.avatarMore, { marginLeft: -4 }]}>
            <Text style={styles.avatarText}>+{owers.length - 3}</Text>
          </View>
        )}
      </View>
    );
  };


  const renderExpenseItem = (expense: ExpenseItem) => {
    const addedByMember = validMembers.find(m => m.device_id === expense.addedBy);
    const canDelete = expense.addedBy === currentDeviceId;

    return (
      <TouchableOpacity 
        key={expense.id} 
        style={styles.expenseItem}
        onPress={() => {
          setSelectedExpense(expense);
          setShowExpenseModal(true);
        }}
        activeOpacity={0.8}
      >
        {/* Payers */}
        <View style={styles.payersSection}>
          {renderPayerAvatars(expense.participants)}
        </View>

        {/* Owers */}
        <View style={styles.owersSection}>
          {renderOwerAvatars(expense.participants)}
        </View>

        {/* Expense Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.description}>
            {expense.name}
          </Text>
        </View>

        {/* Total Amount */}
        <View style={styles.amountSection}>
          <Text style={styles.amount}>
            ${(expense.total_amount || 0).toFixed(2)}
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
            onPress={(e) => {
              e.stopPropagation();
              deleteExpense(expense.id);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={14} color="#ef4444" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
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
          
          <TouchableOpacity 
            style={styles.expandButton}
            onPress={() => {/* TODO: Navigate to full expense screen */}}
          >
            <Ionicons name="expand" size={16} color="#10b981" />
            <Text style={styles.expandButtonText}>View All</Text>
          </TouchableOpacity>
        </View>

        {expenseItems.length > 0 && (
          <View style={styles.separator} />
        )}

        <View style={styles.expenseContent}>
          {expenseItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyStateText}>No expenses yet</Text>
              <Text style={styles.emptyStateSubtext}>Add an expense to get started</Text>
            </View>
          ) : (
            <>
              {/* Column Headers */}
              <View style={styles.columnHeaders}>
                <View style={styles.headerPayersSection}>
                  <Text style={styles.columnHeaderText}>Payers</Text>
                </View>
                <View style={styles.headerOwersSection}>
                  <Text style={styles.columnHeaderText}>Owers</Text>
                </View>
                <View style={styles.headerDescriptionSection}>
                  <Text style={styles.columnHeaderText}>Name</Text>
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
                
                {/* Add Expense Button at bottom */}
                <TouchableOpacity 
                  style={styles.addExpenseButton}
                  onPress={() => setShowAddExpenseModal(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#10b981" />
                  <Text style={styles.addExpenseButtonText}>Add New Expense</Text>
                </TouchableOpacity>
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
        lockedPercentages={lockedPercentages}
        setLockedPercentages={setLockedPercentages}
        updatePercentage={updatePercentage}
        togglePercentageLock={togglePercentageLock}
        toggleOwer={toggleOwer}
        togglePayer={togglePayer}
      />

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={showExpenseModal}
          onRequestClose={() => setShowExpenseModal(false)}
        >
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowExpenseModal(false)} style={styles.modalBackButton}>
                <Ionicons name="chevron-back" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Expense Details</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>Name</Text>
                <Text style={styles.expenseDetailText}>{selectedExpense.name}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>Total Amount</Text>
                <Text style={styles.expenseDetailAmount}>${selectedExpense.total_amount.toFixed(2)}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>Participants</Text>
                {selectedExpense.participants.map((participant) => {
                  const member = validMembers.find(m => m.device_id === participant.device_id);
                  return (
                    <View key={participant.device_id} style={styles.participantDetailRow}>
                      <View style={styles.participantInfo}>
                        <View style={[
                          styles.avatar,
                          participant.role === 'payer' ? styles.payerAvatar : styles.owerAvatar
                        ]}>
                          <Text style={styles.avatarText}>
                            {member?.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <Text style={styles.participantName}>{member?.username || 'Unknown'}</Text>
                      </View>
                      <View style={styles.participantRole}>
                        <Text style={styles.participantRoleText}>
                          {participant.role === 'payer' ? 'Paid' : `Owes $${participant.individual_amount.toFixed(2)}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
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
  lockedPercentages,
  setLockedPercentages,
  updatePercentage,
  togglePercentageLock,
  toggleOwer,
  togglePayer,
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
  lockedPercentages: Set<string>;
  setLockedPercentages: (locked: Set<string>) => void;
  updatePercentage: (deviceId: string, newPercentage: number) => void;
  togglePercentageLock: (deviceId: string) => void;
  toggleOwer: (deviceId: string) => void;
  togglePayer: (deviceId: string) => void;
}) {
  const insets = useSafeAreaInsets();

  const updatePercentage = (deviceId: string, newPercentage: number) => {
    const newPercentages = { ...owersPercentages };
    const otherOwers = Array.from(selectedOwers).filter(id => id !== deviceId && !lockedPercentages.has(id));
    
    // Set the new percentage for this user
    newPercentages[deviceId] = Math.max(0, Math.min(100, newPercentage));
    
    // Calculate how much percentage is already locked
    const lockedTotal = Array.from(lockedPercentages).reduce((sum, id) => {
      return sum + (newPercentages[id] || 0);
    }, 0);
    
    // Calculate remaining percentage to distribute (excluding locked and current user)
    const remaining = 100 - newPercentages[deviceId] - lockedTotal;
    
    if (otherOwers.length > 0 && remaining >= 0) {
      // Distribute remaining percentage equally among unlocked others
      const equalShare = Math.floor(remaining / otherOwers.length);
      const remainder = remaining % otherOwers.length;
      
      otherOwers.forEach((id, index) => {
        newPercentages[id] = equalShare + (index < remainder ? 1 : 0);
      });
    }
    
    setOwersPercentages(newPercentages);
  };

  const togglePercentageLock = (deviceId: string) => {
    const newLocked = new Set(lockedPercentages);
    if (newLocked.has(deviceId)) {
      newLocked.delete(deviceId);
    } else {
      newLocked.add(deviceId);
    }
    setLockedPercentages(newLocked);
  };

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
      
      // Remove from locked as well
      const newLocked = new Set(lockedPercentages);
      newLocked.delete(deviceId);
      setLockedPercentages(newLocked);
      
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
                  
                  {selectedOwers.has(member.device_id) && (
                    <View style={styles.sliderFullWidthContainer}>
                      <View style={styles.sliderInfoRow}>
                        <View style={styles.sliderLabels}>
                          <Text style={styles.sliderLabel}>
                            {owersPercentages[member.device_id] || 0}% 
                            {newExpenseAmount && (
                              <Text style={styles.dollarAmount}>
                                (${((parseFloat(newExpenseAmount) || 0) * (owersPercentages[member.device_id] || 0) / 100).toFixed(2)})
                              </Text>
                            )}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.lockButton,
                            lockedPercentages.has(member.device_id) && styles.lockButtonActive
                          ]}
                          onPress={() => togglePercentageLock(member.device_id)}
                        >
                          <Ionicons 
                            name={lockedPercentages.has(member.device_id) ? "lock-closed" : "lock-open"} 
                            size={16} 
                            color={lockedPercentages.has(member.device_id) ? "#10b981" : "#9ca3af"} 
                          />
                        </TouchableOpacity>
                      </View>
                      <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={100}
                        value={owersPercentages[member.device_id] || 0}
                        onValueChange={(value) => {
                          if (!lockedPercentages.has(member.device_id)) {
                            updatePercentage(member.device_id, Math.round(value));
                          }
                        }}
                        disabled={lockedPercentages.has(member.device_id)}
                        minimumTrackTintColor={lockedPercentages.has(member.device_id) ? "#6b7280" : "#10b981"}
                        maximumTrackTintColor="#3a3a3a"
                        thumbStyle={[
                          styles.sliderThumbStyle,
                          lockedPercentages.has(member.device_id) && styles.sliderThumbLocked
                        ]}
                        trackStyle={styles.sliderTrackStyle}
                      />
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
  expandButton: {
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
  expandButtonText: {
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
  headerPayersSection: {
    width: 60,
    alignItems: 'center',
  },
  headerOwersSection: {
    width: 60,
    alignItems: 'center',
    marginLeft: 8,
  },
  headerDescriptionSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerAmountSection: {
    width: 60,
    alignItems: 'center',
  },
  headerAddedBySection: {
    width: 50,
    alignItems: 'center',
  },
  headerDeleteSection: {
    width: 24,
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
  payersSection: {
    width: 60,
  },
  owersSection: {
    width: 60,
    marginLeft: 8,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: '#4a4a4a',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    position: 'relative',
  },
  payerAvatar: {
    backgroundColor: '#10b981',
  },
  owerAvatar: {
    backgroundColor: '#ef4444',
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
  descriptionSection: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  amountSection: {
    width: 60,
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
  },
  addedBySection: {
    width: 50,
  },
  addedByText: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  deleteSection: {
    width: 24,
    height: 24,
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
  sliderFullWidthContainer: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sliderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabels: {
    flex: 1,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  dollarAmount: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '400',
  },
  slider: {
    width: '100%',
    height: 20,
    marginBottom: 8,
  },
  sliderThumbStyle: {
    backgroundColor: '#10b981',
    width: 16,
    height: 16,
  },
  sliderTrackStyle: {
    height: 4,
    borderRadius: 2,
  },
  calculatedAmountText: {
    fontSize: 11,
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
  lockButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  lockButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
  },
  sliderThumbLocked: {
    backgroundColor: '#6b7280',
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderStyle: 'dashed',
  },
  addExpenseButtonText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
    marginLeft: 8,
  },
  expenseDetailText: {
    fontSize: 16,
    color: '#ffffff',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  expenseDetailAmount: {
    fontSize: 20,
    color: '#10b981',
    fontWeight: '600',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  participantDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 12,
  },
  participantRole: {
    alignItems: 'flex-end',
  },
  participantRoleText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});