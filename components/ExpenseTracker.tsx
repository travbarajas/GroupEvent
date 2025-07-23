import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PaymentWebView, { PaymentDetails } from './PaymentWebView';

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface ExpenseItem {
  id: string;
  description: string;
  totalAmount: number;
  paidBy: string; // member_id of who paid
  splitBetween: string[]; // array of member_ids
  individualAmount: number;
  paymentStatus: { [memberId: string]: 'pending' | 'sent' | 'completed' };
  createdAt: string;
}

interface ExpenseTrackerProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  groupId: string;
  members: GroupMember[];
}

const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({
  visible,
  onClose,
  groupName,
  groupId,
  members,
}) => {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<'list' | 'create' | 'payment'>('list');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  
  // Create expense form state
  const [expenseDescription, setExpenseDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [selectedPayer, setSelectedPayer] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  
  // Payment state
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [currentPayment, setCurrentPayment] = useState<PaymentDetails | null>(null);
  const [processingExpenseId, setProcessingExpenseId] = useState<string>('');

  const validMembers = members.filter(member => member.has_username && member.username);

  useEffect(() => {
    if (visible) {
      loadExpenses();
      resetCreateForm();
    }
  }, [visible]);

  const loadExpenses = async () => {
    // TODO: Load expenses from API/storage
    // For now, using mock data
    const mockExpenses: ExpenseItem[] = [
      {
        id: '1',
        description: 'Beach Day Lunch',
        totalAmount: 75.50,
        paidBy: validMembers[0]?.member_id || '',
        splitBetween: validMembers.slice(0, 3).map(m => m.member_id),
        individualAmount: 25.17,
        paymentStatus: validMembers.slice(0, 3).reduce((acc, member) => {
          acc[member.member_id] = member.member_id === validMembers[0]?.member_id ? 'completed' : 'pending';
          return acc;
        }, {} as { [key: string]: 'pending' | 'sent' | 'completed' }),
        createdAt: new Date().toISOString(),
      }
    ];
    setExpenses(mockExpenses);
  };

  const resetCreateForm = () => {
    setExpenseDescription('');
    setTotalAmount('');
    setSelectedPayer('');
    setSelectedMembers(new Set());
  };

  const handleCreateExpense = () => {
    const amount = parseFloat(totalAmount);
    
    if (!expenseDescription.trim()) {
      Alert.alert('Error', 'Please enter an expense description');
      return;
    }
    
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    if (!selectedPayer) {
      Alert.alert('Error', 'Please select who paid');
      return;
    }
    
    if (selectedMembers.size === 0) {
      Alert.alert('Error', 'Please select members to split with');
      return;
    }

    const individualAmount = amount / selectedMembers.size;
    const newExpense: ExpenseItem = {
      id: Date.now().toString(),
      description: expenseDescription,
      totalAmount: amount,
      paidBy: selectedPayer,
      splitBetween: Array.from(selectedMembers),
      individualAmount,
      paymentStatus: Array.from(selectedMembers).reduce((acc, memberId) => {
        acc[memberId] = memberId === selectedPayer ? 'completed' : 'pending';
        return acc;
      }, {} as { [key: string]: 'pending' | 'sent' | 'completed' }),
      createdAt: new Date().toISOString(),
    };

    setExpenses(prev => [newExpense, ...prev]);
    setCurrentStep('list');
    resetCreateForm();
    
    // TODO: Save to API/storage
  };

  const handlePayExpense = (expense: ExpenseItem, payerMemberId: string, recipientMemberId: string) => {
    const recipient = validMembers.find(m => m.member_id === recipientMemberId);
    const payer = validMembers.find(m => m.member_id === payerMemberId);
    
    if (!recipient || !payer) {
      Alert.alert('Error', 'Invalid member selection');
      return;
    }

    // Show payment method selection
    Alert.alert(
      'Choose Payment Method',
      `Pay ${recipient.username} $${expense.individualAmount.toFixed(2)}`,
      [
        {
          text: 'PayPal',
          onPress: () => initiatePayment(expense, recipient, 'paypal')
        },
        {
          text: 'Venmo',
          onPress: () => initiatePayment(expense, recipient, 'venmo')
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const initiatePayment = (expense: ExpenseItem, recipient: GroupMember, method: 'paypal' | 'venmo') => {
    const paymentDetails: PaymentDetails = {
      recipientName: recipient.username!,
      recipientUsername: recipient.username!,
      amount: expense.individualAmount,
      description: `${groupName} - ${expense.description}`,
      paymentMethod: method,
    };

    setCurrentPayment(paymentDetails);
    setProcessingExpenseId(expense.id);
    setShowPaymentWebView(true);
  };

  const handlePaymentComplete = (success: boolean) => {
    if (success && processingExpenseId && currentPayment) {
      // Update payment status
      setExpenses(prev => prev.map(expense => {
        if (expense.id === processingExpenseId) {
          const currentUserId = 'current-user-id'; // TODO: Get from context
          return {
            ...expense,
            paymentStatus: {
              ...expense.paymentStatus,
              [currentUserId]: 'sent'
            }
          };
        }
        return expense;
      }));

      // TODO: Update API/storage
    }

    setCurrentPayment(null);
    setProcessingExpenseId('');
    setShowPaymentWebView(false);
  };

  const toggleMemberSelection = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const renderExpenseList = () => (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Group Expenses</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setCurrentStep('create')}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.createButtonText}>Add Expense</Text>
          </TouchableOpacity>
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyStateText}>No expenses yet</Text>
            <Text style={styles.emptyStateSubtext}>Add an expense to start tracking payments</Text>
          </View>
        ) : (
          expenses.map(expense => (
            <View key={expense.id} style={styles.expenseCard}>
              <View style={styles.expenseHeader}>
                <Text style={styles.expenseTitle}>{expense.description}</Text>
                <Text style={styles.expenseAmount}>${expense.totalAmount.toFixed(2)}</Text>
              </View>
              
              <Text style={styles.expenseDetails}>
                Paid by {validMembers.find(m => m.member_id === expense.paidBy)?.username || 'Unknown'} • 
                Split {expense.splitBetween.length} ways (${expense.individualAmount.toFixed(2)} each)
              </Text>

              <View style={styles.paymentStatusContainer}>
                {expense.splitBetween.map(memberId => {
                  const member = validMembers.find(m => m.member_id === memberId);
                  const status = expense.paymentStatus[memberId] || 'pending';
                  const isPayer = memberId === expense.paidBy;
                  
                  if (!member) return null;

                  return (
                    <View key={memberId} style={styles.paymentStatusRow}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.username}</Text>
                        <View style={[styles.statusBadge, styles[`status${status.charAt(0).toUpperCase() + status.slice(1)}`]]}>
                          <Text style={styles.statusText}>
                            {isPayer ? 'Paid' : status === 'pending' ? 'Owes' : status === 'sent' ? 'Sent' : 'Paid'}
                          </Text>
                        </View>
                      </View>
                      
                      {!isPayer && status === 'pending' && (
                        <TouchableOpacity
                          style={styles.payButton}
                          onPress={() => handlePayExpense(expense, 'current-user-id', memberId)}
                        >
                          <Text style={styles.payButtonText}>Pay ${expense.individualAmount.toFixed(2)}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderCreateExpense = () => (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add New Expense</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>What was the expense for?</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Beach Day Lunch, Movie Tickets"
            placeholderTextColor="#9ca3af"
            value={expenseDescription}
            onChangeText={setExpenseDescription}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Total Amount ($)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="0.00"
            placeholderTextColor="#9ca3af"
            value={totalAmount}
            onChangeText={setTotalAmount}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Who paid?</Text>
          <View style={styles.memberSelection}>
            {validMembers.map(member => (
              <TouchableOpacity
                key={member.member_id}
                style={[
                  styles.memberOption,
                  selectedPayer === member.member_id && styles.memberOptionSelected
                ]}
                onPress={() => setSelectedPayer(member.member_id)}
              >
                <Text style={[
                  styles.memberOptionText,
                  selectedPayer === member.member_id && styles.memberOptionTextSelected
                ]}>
                  {member.username}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Split between:</Text>
          <View style={styles.memberSelection}>
            {validMembers.map(member => (
              <TouchableOpacity
                key={member.member_id}
                style={[
                  styles.memberOption,
                  selectedMembers.has(member.member_id) && styles.memberOptionSelected
                ]}
                onPress={() => toggleMemberSelection(member.member_id)}
              >
                <Text style={[
                  styles.memberOptionText,
                  selectedMembers.has(member.member_id) && styles.memberOptionTextSelected
                ]}>
                  {member.username}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedMembers.size > 0 && totalAmount && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              ${totalAmount} ÷ {selectedMembers.size} people = ${(parseFloat(totalAmount) / selectedMembers.size).toFixed(2)} each
            </Text>
          </View>
        )}

        <View style={styles.createActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setCurrentStep('list');
              resetCreateForm();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleCreateExpense}
          >
            <Text style={styles.saveButtonText}>Create Expense</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  if (!visible) return null;

  return (
    <>
      <Modal
        animationType="slide"
        transparent={false}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>
                {currentStep === 'create' ? 'Add Expense' : 'Group Expenses'}
              </Text>
              <Text style={styles.headerSubtitle}>{groupName}</Text>
            </View>
            <View style={styles.headerRight} />
          </View>

          {/* Content */}
          {currentStep === 'list' && renderExpenseList()}
          {currentStep === 'create' && renderCreateExpense()}
        </View>
      </Modal>

      {/* Payment WebView */}
      {currentPayment && (
        <PaymentWebView
          visible={showPaymentWebView}
          onClose={() => setShowPaymentWebView(false)}
          paymentDetails={currentPayment}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  createButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  createButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
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
  expenseCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  expenseDetails: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  paymentStatusContainer: {
    gap: 8,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberName: {
    fontSize: 12,
    color: '#e5e7eb',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: '#fbbf24',
  },
  statusSent: {
    backgroundColor: '#3b82f6',
  },
  statusCompleted: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#ffffff',
  },
  payButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  payButtonText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 16,
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
  memberSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberOption: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  memberOptionSelected: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  memberOptionText: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  memberOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '500',
  },
  summaryContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  summaryText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
  },
  createActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExpenseTracker;