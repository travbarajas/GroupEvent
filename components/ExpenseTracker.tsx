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
import { ApiService } from '@/services/api';

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
  paidBy: string[]; // array of member_ids who paid upfront
  splitBetween: string[]; // array of member_ids who should pay back
  individualAmount: number; // amount each person in splitBetween owes
  paymentStatus: { [memberId: string]: 'pending' | 'sent' | 'completed' };
  createdAt: string;
}

interface ExpenseTrackerProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  groupId: string;
  members: GroupMember[];
  onExpensesChange?: (expenses: ExpenseItem[]) => void;
}

const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({
  visible,
  onClose,
  groupName,
  groupId,
  members,
  onExpensesChange,
}) => {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<'list' | 'create' | 'payment'>('list');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  
  // Create expense form state
  const [expenseDescription, setExpenseDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(new Set()); // who paid upfront
  const [selectedOwers, setSelectedOwers] = useState<Set<string>>(new Set()); // who owes money
  
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
    try {
      const { expenses: apiExpenses } = await ApiService.getGroupExpenses(groupId);
      
      // Transform API data to match our ExpenseItem interface
      const transformedExpenses: ExpenseItem[] = apiExpenses.map(expense => ({
        id: expense.id,
        description: expense.description,
        totalAmount: parseFloat(expense.total_amount),
        paidBy: expense.payers || [],
        splitBetween: expense.owers || [],
        individualAmount: expense.individual_amount || 0,
        paymentStatus: expense.payment_status || {},
        createdAt: expense.created_at
      }));
      
      setExpenses(transformedExpenses);
    } catch (error) {
      console.error('Failed to load expenses:', error);
      // Fall back to empty expenses on error
      setExpenses([]);
    }
  };

  const resetCreateForm = () => {
    setExpenseDescription('');
    setTotalAmount('');
    setSelectedPayers(new Set());
    setSelectedOwers(new Set());
  };

  const handleCreateExpense = async () => {
    const amount = parseFloat(totalAmount);
    
    if (!expenseDescription.trim()) {
      Alert.alert('Error', 'Please enter an expense description');
      return;
    }
    
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    if (selectedPayers.size === 0) {
      Alert.alert('Error', 'Please select who paid upfront');
      return;
    }
    
    if (selectedOwers.size === 0) {
      Alert.alert('Error', 'Please select who should pay back');
      return;
    }

    try {
      // Create expense via API
      await ApiService.createGroupExpense(groupId, {
        description: expenseDescription,
        totalAmount: amount,
        paidBy: Array.from(selectedPayers),
        splitBetween: Array.from(selectedOwers)
      });
      
      // Reload expenses from API to get the latest data
      await loadExpenses();
      
      // Notify parent of expense changes
      onExpensesChange?.(expenses);
      
      setCurrentStep('list');
      resetCreateForm();
    } catch (error) {
      console.error('Failed to create expense:', error);
      Alert.alert('Error', 'Failed to create expense. Please try again.');
    }
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

  const handleTogglePaymentStatus = async (expenseId: string, memberId: string, currentStatus: string) => {
    try {
      // Toggle between 'pending' and 'completed'
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await ApiService.updateExpensePaymentStatus(groupId, expenseId, memberId, newStatus);
      
      // Reload expenses to get updated data
      await loadExpenses();
      
      // Notify parent of expense changes
      onExpensesChange?.(expenses);
    } catch (error) {
      console.error('Failed to update payment status:', error);
      Alert.alert('Error', 'Failed to update payment status. Please try again.');
    }
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

  const togglePayerSelection = (memberId: string) => {
    const newSelected = new Set(selectedPayers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedPayers(newSelected);
  };

  const toggleOwerSelection = (memberId: string) => {
    const newSelected = new Set(selectedOwers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedOwers(newSelected);
  };

  // Helper function to check if all owers have paid
  const isExpenseFullyPaid = (expense: ExpenseItem) => {
    return expense.splitBetween.every(memberId => 
      expense.paymentStatus[memberId] === 'completed'
    );
  };

  // Helper function to sort expenses
  const getSortedExpenses = () => {
    const unpaidExpenses = expenses.filter(expense => !isExpenseFullyPaid(expense));
    const paidExpenses = expenses.filter(expense => isExpenseFullyPaid(expense));

    // Sort unpaid by amount (highest first)
    unpaidExpenses.sort((a, b) => b.totalAmount - a.totalAmount);
    
    // Sort paid by amount (highest first) 
    paidExpenses.sort((a, b) => b.totalAmount - a.totalAmount);

    return [...unpaidExpenses, ...paidExpenses];
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
          getSortedExpenses().map(expense => {
            const isFullyPaid = isExpenseFullyPaid(expense);
            
            return (
              <View key={expense.id} style={[
                styles.expenseCard,
                isFullyPaid && styles.expenseCardPaid
              ]}>
                <View style={styles.expenseHeader}>
                  <Text style={[
                    styles.expenseTitle,
                    isFullyPaid && styles.expenseTitlePaid
                  ]}>
                    {expense.description}
                  </Text>
                  <Text style={[
                    styles.expenseAmount,
                    isFullyPaid && styles.expenseAmountPaid
                  ]}>
                    ${expense.totalAmount.toFixed(2)}
                  </Text>
                </View>
                
                <Text style={[
                  styles.expenseDetails,
                  isFullyPaid && styles.expenseDetailsPaid
                ]}>
                  Paid by {expense.paidBy.map(id => validMembers.find(m => m.member_id === id)?.username || 'Unknown').join(', ')} • 
                  {expense.splitBetween.length} people owe ${expense.individualAmount.toFixed(2)} each
                </Text>

                <View style={styles.paymentStatusContainer}>
                  {expense.splitBetween.map(memberId => {
                    const member = validMembers.find(m => m.member_id === memberId);
                    const status = expense.paymentStatus[memberId] || 'pending';
                    const isPayer = expense.paidBy.includes(memberId);
                    
                    if (!member) return null;

                    return (
                      <View key={memberId} style={styles.paymentStatusRow}>
                        <View style={styles.memberInfo}>
                          <Text style={[
                            styles.memberName,
                            isFullyPaid && styles.memberNamePaid
                          ]}>
                            {member.username}
                          </Text>
                          <View style={[styles.statusBadge, styles[`status${status.charAt(0).toUpperCase() + status.slice(1)}`]]}>
                            <Text style={styles.statusText}>
                              {isPayer ? 'Paid' : status === 'pending' ? 'Owes' : status === 'sent' ? 'Sent' : 'Paid'}
                            </Text>
                          </View>
                        </View>
                        
                        {!isPayer && (
                          <TouchableOpacity
                            style={[
                              styles.markPaidButton,
                              status === 'completed' && styles.markUnpaidButton
                            ]}
                            onPress={() => handleTogglePaymentStatus(expense.id, memberId, status)}
                          >
                            <Text style={[
                              styles.markPaidButtonText,
                              status === 'completed' && styles.markUnpaidButtonText
                            ]}>
                              {status === 'completed' ? 'Mark Unpaid' : 'Mark Paid'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
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
          <Text style={styles.inputLabel}>Who paid upfront?</Text>
          <View style={styles.memberSelection}>
            {validMembers.map(member => (
              <TouchableOpacity
                key={member.member_id}
                style={[
                  styles.memberOption,
                  selectedPayers.has(member.member_id) && styles.memberOptionSelected
                ]}
                onPress={() => togglePayerSelection(member.member_id)}
              >
                <Text style={[
                  styles.memberOptionText,
                  selectedPayers.has(member.member_id) && styles.memberOptionTextSelected
                ]}>
                  {member.username}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Who should pay back?</Text>
          <View style={styles.memberSelection}>
            {validMembers.map(member => (
              <TouchableOpacity
                key={member.member_id}
                style={[
                  styles.memberOption,
                  selectedOwers.has(member.member_id) && styles.memberOptionSelected
                ]}
                onPress={() => toggleOwerSelection(member.member_id)}
              >
                <Text style={[
                  styles.memberOptionText,
                  selectedOwers.has(member.member_id) && styles.memberOptionTextSelected
                ]}>
                  {member.username}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedOwers.size > 0 && totalAmount && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              ${totalAmount} ÷ {selectedOwers.size} people = ${(parseFloat(totalAmount) / selectedOwers.size).toFixed(2)} each
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
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
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
  backButton: {
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
  markPaidButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  markPaidButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  markUnpaidButton: {
    backgroundColor: '#f59e0b',
  },
  markUnpaidButtonText: {
    color: '#ffffff',
  },
  expenseCardPaid: {
    backgroundColor: '#1a1a1a',
    opacity: 0.6,
  },
  expenseTitlePaid: {
    color: '#9ca3af',
  },
  expenseAmountPaid: {
    color: '#9ca3af',
  },
  expenseDetailsPaid: {
    color: '#6b7280',
  },
  memberNamePaid: {
    color: '#9ca3af',
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