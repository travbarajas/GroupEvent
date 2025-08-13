import React, { useState, useEffect } from 'react';
import { 
  View, Modal, Text, TextInput, TouchableOpacity, 
  ScrollView, StyleSheet, Alert, Dimensions 
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Expense, ExpenseParticipant } from '../utils/expenseCalculations';

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface AddExpenseModalProps {
  visible: boolean;
  expense?: Expense | null;
  groupMembers: GroupMember[];
  onSave: (expenseData: {
    description: string;
    total_amount: number;
    participants: ExpenseParticipant[];
  }) => void;
  onCancel: () => void;
}

const { width } = Dimensions.get('window');

export default function AddExpenseModal({ 
  visible, 
  expense, 
  groupMembers, 
  onSave, 
  onCancel 
}: AddExpenseModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payers, setPayers] = useState<string[]>([]);
  const [owers, setOwers] = useState<string[]>([]);
  const [payerSplits, setPayerSplits] = useState<{ [key: string]: number }>({});
  const [owerSplits, setOwerSplits] = useState<{ [key: string]: number }>({});
  const [lockedPayers, setLockedPayers] = useState<{ [key: string]: boolean }>({});
  const [lockedOwers, setLockedOwers] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (expense) {
      // Load existing expense data for editing
      setDescription(expense.description);
      setAmount(expense.total_amount.toString());
      loadParticipants(expense);
    } else {
      // Reset for new expense
      resetForm();
    }
  }, [expense, visible]);

  const loadParticipants = (expense: Expense) => {
    const payerList = expense.participants
      .filter(p => p.role === 'payer')
      .map(p => p.member_device_id);
    const owerList = expense.participants
      .filter(p => p.role === 'ower')
      .map(p => p.member_device_id);
    
    setPayers(payerList);
    setOwers(owerList);
    
    // Calculate percentages from amounts
    const payerPercentages: { [key: string]: number } = {};
    const owerPercentages: { [key: string]: number } = {};
    
    expense.participants.forEach(p => {
      const percentage = (p.individual_amount / expense.total_amount) * 100;
      if (p.role === 'payer') {
        payerPercentages[p.member_device_id] = percentage;
      } else {
        owerPercentages[p.member_device_id] = percentage;
      }
    });
    
    setPayerSplits(payerPercentages);
    setOwerSplits(owerPercentages);
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setPayers([]);
    setOwers([]);
    setPayerSplits({});
    setOwerSplits({});
    setLockedPayers({});
    setLockedOwers({});
  };

  const toggleUserSelection = (userId: string, type: 'payer' | 'ower') => {
    if (type === 'payer') {
      const newPayers = payers.includes(userId) 
        ? payers.filter(id => id !== userId)
        : [...payers, userId];
      setPayers(newPayers);
      
      // Initialize or remove splits
      if (newPayers.includes(userId)) {
        const equalSplit = 100 / newPayers.length;
        const newSplits: { [key: string]: number } = {};
        newPayers.forEach(id => {
          newSplits[id] = equalSplit;
        });
        setPayerSplits(newSplits);
      } else {
        // Remove from splits and locks when deselected
        const newSplits = { ...payerSplits };
        const newLocked = { ...lockedPayers };
        delete newSplits[userId];
        delete newLocked[userId];
        setPayerSplits(newSplits);
        setLockedPayers(newLocked);
      }
    } else {
      const newOwers = owers.includes(userId)
        ? owers.filter(id => id !== userId)
        : [...owers, userId];
      setOwers(newOwers);
      
      if (newOwers.includes(userId)) {
        const equalSplit = 100 / newOwers.length;
        const newSplits: { [key: string]: number } = {};
        newOwers.forEach(id => {
          newSplits[id] = equalSplit;
        });
        setOwerSplits(newSplits);
      } else {
        // Remove from splits and locks when deselected
        const newSplits = { ...owerSplits };
        const newLocked = { ...lockedOwers };
        delete newSplits[userId];
        delete newLocked[userId];
        setOwerSplits(newSplits);
        setLockedOwers(newLocked);
      }
    }
  };

  const updateSplit = (userId: string, value: number, type: 'payer' | 'ower') => {
    const splits = type === 'payer' ? payerSplits : owerSplits;
    const locked = type === 'payer' ? lockedPayers : lockedOwers;
    const users = type === 'payer' ? payers : owers;
    
    // Calculate the sum of locked percentages
    let lockedSum = 0;
    Object.keys(locked).forEach(id => {
      if (locked[id] && id !== userId) {
        lockedSum += splits[id] || 0;
      }
    });
    
    // Calculate maximum allowed value for this user
    const maxAllowedValue = 100 - lockedSum;
    
    // Silently constrain the value to prevent exceeding 100%
    const constrainedValue = Math.min(Math.max(0, value), maxAllowedValue);
    
    // Calculate available percentage for unlocked users
    const availablePercentage = 100 - lockedSum - constrainedValue;
    const unlockedUsers = users.filter(id => 
      id !== userId && !locked[id]
    );
    
    const newSplits = { ...splits, [userId]: constrainedValue };
    
    // Distribute remaining percentage among unlocked users
    if (unlockedUsers.length > 0 && availablePercentage >= 0) {
      const splitPerUser = Math.max(0, availablePercentage / unlockedUsers.length);
      unlockedUsers.forEach(id => {
        newSplits[id] = splitPerUser;
      });
    }
    
    if (type === 'payer') {
      setPayerSplits(newSplits);
    } else {
      setOwerSplits(newSplits);
    }
  };

  const toggleLock = (userId: string, type: 'payer' | 'ower') => {
    // Don't allow locking the last unlocked user
    if (isLastUnlockedUser(userId, type)) {
      return;
    }
    
    if (type === 'payer') {
      setLockedPayers(prev => ({
        ...prev,
        [userId]: !prev[userId]
      }));
    } else {
      setLockedOwers(prev => ({
        ...prev,
        [userId]: !prev[userId]
      }));
    }
  };

  const handleSave = () => {
    const numAmount = parseFloat(amount);
    
    if (!amount || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }
    
    if (payers.length === 0 || owers.length === 0) {
      Alert.alert('Missing Information', 'Please select at least one payer and one ower');
      return;
    }
    
    // Validate percentages sum to 100% (with small tolerance for rounding)
    const payerSum = Object.values(payerSplits).reduce((a, b) => a + b, 0);
    const owerSum = Object.values(owerSplits).reduce((a, b) => a + b, 0);
    
    // If percentages don't add up to 100%, silently normalize them
    if (Math.abs(payerSum - 100) > 0.1) {
      const normalizedPayerSplits: { [key: string]: number } = {};
      const factor = 100 / payerSum;
      Object.keys(payerSplits).forEach(id => {
        normalizedPayerSplits[id] = (payerSplits[id] || 0) * factor;
      });
      setPayerSplits(normalizedPayerSplits);
    }
    
    if (Math.abs(owerSum - 100) > 0.1) {
      const normalizedOwerSplits: { [key: string]: number } = {};
      const factor = 100 / owerSum;
      Object.keys(owerSplits).forEach(id => {
        normalizedOwerSplits[id] = (owerSplits[id] || 0) * factor;
      });
      setOwerSplits(normalizedOwerSplits);
      
      // Don't proceed with save if we had to normalize - let user see the changes first
      return;
    }
    
    const finalDescription = description.trim() || 'Expense';
    const totalAmount = numAmount;
    
    // Calculate individual amounts based on percentages
    const participants: ExpenseParticipant[] = [];
    
    payers.forEach(userId => {
      const percentage = (payerSplits[userId] || 0) / 100;
      participants.push({
        member_device_id: userId,
        role: 'payer',
        individual_amount: totalAmount * percentage,
        payment_status: 'completed'
      });
    });
    
    owers.forEach(userId => {
      const percentage = (owerSplits[userId] || 0) / 100;
      participants.push({
        member_device_id: userId,
        role: 'ower',
        individual_amount: totalAmount * percentage,
        payment_status: 'pending'
      });
    });
    
    onSave({
      description: finalDescription,
      total_amount: totalAmount,
      participants
    });
    
    resetForm();
  };

  const getMemberDisplayName = (member: GroupMember): string => {
    return member.username || `User ${member.device_id.slice(-4)}`;
  };

  const getMaxValueForUser = (userId: string, type: 'payer' | 'ower'): number => {
    const splits = type === 'payer' ? payerSplits : owerSplits;
    const locked = type === 'payer' ? lockedPayers : lockedOwers;
    
    // Calculate the sum of locked percentages (excluding current user)
    let lockedSum = 0;
    Object.keys(locked).forEach(id => {
      if (locked[id] && id !== userId) {
        lockedSum += splits[id] || 0;
      }
    });
    
    // Maximum this user can have is 100% minus all locked percentages
    return Math.max(0, 100 - lockedSum);
  };

  const isLastUnlockedUser = (userId: string, type: 'payer' | 'ower'): boolean => {
    const users = type === 'payer' ? payers : owers;
    const locked = type === 'payer' ? lockedPayers : lockedOwers;
    
    // Count unlocked users
    const unlockedUsers = users.filter(id => !locked[id]);
    
    // This user is the last unlocked if there's only 1 unlocked user and it's them
    return unlockedUsers.length === 1 && unlockedUsers[0] === userId;
  };

  const isEffectivelyLocked = (userId: string, type: 'payer' | 'ower'): boolean => {
    const locked = type === 'payer' ? lockedPayers : lockedOwers;
    return locked[userId] || isLastUnlockedUser(userId, type);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>
            {expense ? 'Edit Expense' : 'Add Expense'}
          </Text>
          
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <TextInput
              style={styles.input}
              placeholder="Expense name (optional)"
              placeholderTextColor="#6b7280"
              value={description}
              onChangeText={setDescription}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              placeholderTextColor="#6b7280"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            
            <Text style={styles.sectionTitle}>Who paid?</Text>
            {groupMembers.map(member => (
              <View key={member.member_id}>
                <TouchableOpacity
                  style={[
                    styles.memberItem,
                    payers.includes(member.device_id) && styles.selectedMember
                  ]}
                  onPress={() => toggleUserSelection(member.device_id, 'payer')}
                >
                  <View style={styles.memberRow}>
                    <Text style={styles.memberText}>
                      {getMemberDisplayName(member)}
                    </Text>
                    {payers.includes(member.device_id) && (
                      <View style={styles.amountInfo}>
                        {payers.length > 1 && (
                          <>
                            <Text style={styles.percentageText}>
                              {Math.round(payerSplits[member.device_id] || 0)}%
                            </Text>
                            <Text style={styles.dollarAmount}>
                              ${((parseFloat(amount) || 0) * ((payerSplits[member.device_id] || 0) / 100)).toFixed(2)}
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.lockButtonInline,
                                isEffectivelyLocked(member.device_id, 'payer') && styles.locked,
                                isLastUnlockedUser(member.device_id, 'payer') && styles.autoLocked
                              ]}
                              onPress={() => toggleLock(member.device_id, 'payer')}
                              disabled={isLastUnlockedUser(member.device_id, 'payer')}
                            >
                              <Text style={styles.lockText}>
                                {isEffectivelyLocked(member.device_id, 'payer') ? '🔒' : '🔓'}
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                        {payers.length === 1 && (
                          <Text style={styles.dollarAmount}>
                            ${(parseFloat(amount) || 0).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                
                {payers.length > 1 && payers.includes(member.device_id) && (
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={getMaxValueForUser(member.device_id, 'payer')}
                      value={payerSplits[member.device_id] || 0}
                      onValueChange={(value) => updateSplit(member.device_id, value, 'payer')}
                      minimumTrackTintColor="#60a5fa"
                      maximumTrackTintColor="#2a2a2a"
                      thumbStyle={styles.sliderThumb}
                      disabled={lockedPayers[member.device_id] || isLastUnlockedUser(member.device_id, 'payer')}
                    />
                  </View>
                )}
              </View>
            ))}
            
            <Text style={styles.sectionTitle}>Who owes?</Text>
            {groupMembers.map(member => (
              <View key={member.member_id}>
                <TouchableOpacity
                  style={[
                    styles.memberItem,
                    owers.includes(member.device_id) && styles.selectedMember
                  ]}
                  onPress={() => toggleUserSelection(member.device_id, 'ower')}
                >
                  <View style={styles.memberRow}>
                    <Text style={styles.memberText}>
                      {getMemberDisplayName(member)}
                    </Text>
                    {owers.includes(member.device_id) && (
                      <View style={styles.amountInfo}>
                        {owers.length > 1 && (
                          <>
                            <Text style={styles.percentageText}>
                              {Math.round(owerSplits[member.device_id] || 0)}%
                            </Text>
                            <Text style={styles.dollarAmount}>
                              ${((parseFloat(amount) || 0) * ((owerSplits[member.device_id] || 0) / 100)).toFixed(2)}
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.lockButtonInline,
                                isEffectivelyLocked(member.device_id, 'ower') && styles.locked,
                                isLastUnlockedUser(member.device_id, 'ower') && styles.autoLocked
                              ]}
                              onPress={() => toggleLock(member.device_id, 'ower')}
                              disabled={isLastUnlockedUser(member.device_id, 'ower')}
                            >
                              <Text style={styles.lockText}>
                                {isEffectivelyLocked(member.device_id, 'ower') ? '🔒' : '🔓'}
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                        {owers.length === 1 && (
                          <Text style={styles.dollarAmount}>
                            ${(parseFloat(amount) || 0).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                
                {owers.length > 1 && owers.includes(member.device_id) && (
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={getMaxValueForUser(member.device_id, 'ower')}
                      value={owerSplits[member.device_id] || 0}
                      onValueChange={(value) => updateSplit(member.device_id, value, 'ower')}
                      minimumTrackTintColor="#60a5fa"
                      maximumTrackTintColor="#2a2a2a"
                      thumbStyle={styles.sliderThumb}
                      disabled={lockedOwers[member.device_id] || isLastUnlockedUser(member.device_id, 'ower')}
                    />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={handleSave}
            >
              <Text style={styles.buttonText}>
                {expense ? 'Submit Change' : 'Add Expense'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: width - 40,
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#ffffff',
  },
  scrollContent: {
    maxHeight: 500,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#e5e7eb',
  },
  memberItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#0a0a0a',
  },
  selectedMember: {
    backgroundColor: '#1e3a8a',
    borderColor: '#60a5fa',
  },
  memberText: {
    color: '#ffffff',
    fontSize: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  amountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  dollarAmount: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  lockButtonInline: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    minWidth: 24,
    alignItems: 'center',
  },
  sliderContainer: {
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    backgroundColor: '#60a5fa',
    width: 20,
    height: 20,
  },
  locked: {
    backgroundColor: '#fbbf24',
  },
  autoLocked: {
    backgroundColor: '#6b7280',
    opacity: 0.7,
  },
  lockText: {
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  saveButton: {
    backgroundColor: '#16a34a',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  }
});