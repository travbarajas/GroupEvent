import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import PaymentWebView, { PaymentDetails } from './PaymentWebView';
import { ApiService } from '@/services/api';

interface ExpenseData {
  totalAmount: number;
  eventCount: number;
  userOwes: number;
  userOwed: number;
}

interface ExpenseItem {
  id: string;
  description: string;
  totalAmount: number;
  paidBy: string[];
  splitBetween: string[];
  individualAmount: number;
  paymentStatus: { [memberId: string]: 'pending' | 'sent' | 'completed' };
  createdAt: string;
  createdByDeviceId?: string;
}

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface GroupExpenseIndicatorProps {
  groupId: string;
  currentUserId?: string;
  events: any[]; // Events data passed from parent
  members: GroupMember[];
  groupName: string;
  // Optional modal props for use in event screens
  visible?: boolean;
  onClose?: () => void;
}

export default function GroupExpenseIndicator({ 
  groupId, 
  currentUserId,
  events,
  members,
  groupName,
  visible,
  onClose 
}: GroupExpenseIndicatorProps) {
  const [showModal, setShowModal] = useState(false);
  
  // Use external modal state if provided, otherwise use internal state
  const isModalVisible = visible !== undefined ? visible : showModal;
  const handleCloseModal = onClose || (() => setShowModal(false));
  const [activeTab, setActiveTab] = useState<'expenses' | 'chart'>('expenses');
  const [currentStep, setCurrentStep] = useState<'list' | 'create' | 'payment'>('list');
  const insets = useSafeAreaInsets();

  // Create expense form state
  const [expenseDescription, setExpenseDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(new Set()); 
  const [selectedOwers, setSelectedOwers] = useState<Set<string>>(new Set()); 
  
  // Payment state
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [currentPayment, setCurrentPayment] = useState<PaymentDetails | null>(null);
  const [processingExpenseId, setProcessingExpenseId] = useState<string>('');

  const validMembers = members.filter(member => member.has_username && member.username);

  // Load expense summary from server
  const [expenseData, setExpenseData] = useState<ExpenseData>({
    totalAmount: 0,
    eventCount: 0,
    userOwes: 0,
    userOwed: 0,
  });
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadExpenseSummary = async () => {
    if (!groupId || !currentUserId) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `https://group-event.vercel.app/api/groups/${groupId}/expenses-summary?device_id=${currentUserId}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const { summary } = await response.json();
      console.log('Received expense summary:', summary);
      setExpenseData({
        totalAmount: summary.totalAmount,
        eventCount: summary.expenseCount,
        userOwes: summary.userOwes,
        userOwed: summary.userOwed,
      });
    } catch (error) {
      console.error('Failed to load expense summary:', error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedExpenses = async () => {
    if (!groupId || !currentUserId) return;
    
    try {
      const { expenses: apiExpenses } = await ApiService.getGroupExpenses(groupId);
      
      // Transform API data to match our ExpenseItem interface
      const transformedExpenses: ExpenseItem[] = apiExpenses.map((expense: any) => ({
        id: expense.id,
        description: expense.description,
        totalAmount: parseFloat(expense.total_amount),
        paidBy: expense.payers || [],
        splitBetween: expense.owers || [],
        individualAmount: expense.individual_amount || 0,
        paymentStatus: expense.payment_status || {},
        createdAt: expense.created_at,
        createdByDeviceId: expense.created_by_device_id
      }));
      
      setExpenses(transformedExpenses);
    } catch (error) {
      console.error('Failed to load detailed expenses:', error);
      setExpenses([]);
    }
  };

  // Load summary when component mounts
  useEffect(() => {
    if (groupId && currentUserId) {
      loadExpenseSummary();
    }
  }, [groupId, currentUserId]);

  // Load detailed expenses when modal opens (either internal or external modal)
  useEffect(() => {
    if (isModalVisible && currentUserId) {
      loadDetailedExpenses();
      resetCreateForm();
    }
  }, [isModalVisible, groupId, currentUserId]);

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
      await loadDetailedExpenses();
      
      setCurrentStep('list');
      resetCreateForm();
    } catch (error) {
      console.error('Failed to create expense:', error);
      Alert.alert('Error', 'Failed to create expense. Please try again.');
    }
  };

  const handleTogglePaymentStatus = async (expenseId: string, memberId: string, currentStatus: string) => {
    console.log('🔄 Payment Status Toggle Debug:', {
      expenseId,
      memberId,
      currentStatus,
      currentUserId,
      validMembersCount: validMembers.length
    });

    try {
      // Toggle between 'pending' and 'completed'
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      console.log('🔄 Status change:', currentStatus, '->', newStatus);
      
      // Find the current user's device_id to pass as participant_id
      const currentMember = validMembers.find(m => m.device_id === currentUserId);
      console.log('👤 Current member found:', {
        currentMember: currentMember ? {
          member_id: currentMember.member_id,
          device_id: currentMember.device_id,
          username: currentMember.username
        } : null
      });

      if (!currentMember) {
        console.error('❌ Current user not found in group members');
        Alert.alert('Error', 'Current user not found in group members');
        return;
      }
      
      console.log('📡 Making API call with:', {
        groupId,
        expenseId,
        participantId: currentMember.device_id,
        newStatus
      });

      // Pass the current user's device_id (which matches member_device_id in the database)
      const result = await ApiService.updateExpensePaymentStatus(groupId, expenseId, currentMember.device_id, newStatus);
      console.log('✅ API call successful:', result);
      
      // Debug: Check what the API actually returned
      console.log('📋 API Response Details:', {
        success: result?.success,
        participant: result?.participant,
        fullResponse: result
      });
      
      // Reload expenses to get updated data
      console.log('🔄 Reloading expenses...');
      const expenseBeforeReload = expenses.find(e => e.id === expenseId);
      console.log('📊 Expense before reload:', {
        expenseId,
        statusBefore: expenseBeforeReload?.paymentStatus,
        payersBefore: expenseBeforeReload?.paidBy,
        owersBefore: expenseBeforeReload?.splitBetween
      });
      
      await loadDetailedExpenses();
      
      const expenseAfterReload = expenses.find(e => e.id === expenseId);
      console.log('📊 Expense after reload:', {
        expenseId,
        statusAfter: expenseAfterReload?.paymentStatus,
        payersAfter: expenseAfterReload?.paidBy,
        owersAfter: expenseAfterReload?.splitBetween
      });
      console.log('✅ Expenses reloaded');
    } catch (error) {
      console.error('❌ Failed to update payment status:', error);
      Alert.alert('Error', 'Failed to update payment status. Please try again.');
    }
  };

  const togglePayerSelection = (deviceId: string) => {
    const newSelected = new Set(selectedPayers);
    if (newSelected.has(deviceId)) {
      newSelected.delete(deviceId);
    } else {
      // Remove from owers if adding to payers (can't be both)
      const newOwers = new Set(selectedOwers);
      newOwers.delete(deviceId);
      setSelectedOwers(newOwers);
      
      newSelected.add(deviceId);
    }
    setSelectedPayers(newSelected);
  };

  const toggleOwerSelection = (deviceId: string) => {
    const newSelected = new Set(selectedOwers);
    if (newSelected.has(deviceId)) {
      newSelected.delete(deviceId);
    } else {
      // Remove from payers if adding to owers (can't be both)
      const newPayers = new Set(selectedPayers);
      newPayers.delete(deviceId);
      setSelectedPayers(newPayers);
      
      newSelected.add(deviceId);
    }
    setSelectedOwers(newSelected);
  };

  // Helper function to check if expense is fully settled
  const isExpenseFullyPaid = (expense: ExpenseItem) => {
    // Check if all owers have marked themselves as paid ("I've paid")
    const allOwersHavePaid = expense.splitBetween.every(deviceId => 
      expense.paymentStatus[deviceId] === 'completed'
    );
    
    // Check if all payers have marked themselves as been paid ("I've been paid")
    const allPayersHaveBeenPaid = expense.paidBy.every(deviceId => 
      expense.paymentStatus[deviceId] === 'completed'
    );
    
    // Expense is complete when EITHER all owers have paid OR all payers have been paid
    return allOwersHavePaid || allPayersHaveBeenPaid;
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

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      Alert.alert(
        'Delete Expense',
        'Are you sure you want to delete this expense? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await ApiService.deleteGroupExpense(groupId, expenseId);
                await loadDetailedExpenses();
              } catch (error) {
                console.error('Failed to delete expense:', error);
                Alert.alert('Error', 'Failed to delete expense. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error showing delete confirmation:', error);
    }
  };

  // Reload summary when screen comes back into focus
  useFocusEffect(
    React.useCallback(() => {
      if (groupId && currentUserId) {
        loadExpenseSummary();
      }
    }, [groupId, currentUserId])
  );

  return (
    <>
      {/* Group Expenses Block - Same size as calendar block */}
      <View style={styles.expenseBlockFullWidth}>
        <TouchableOpacity 
          style={styles.integratedExpenseButton}
          activeOpacity={0.6}
          onPress={() => setShowModal(true)}
        >
          <View style={styles.expenseButtonContent}>
            <Ionicons name="wallet" size={20} color="#10b981" />
            <Text style={styles.integratedExpenseButtonText}>Group Expenses</Text>
            <Ionicons name="chevron-forward" size={14} color="#9ca3af" style={styles.expenseButtonArrow} />
          </View>
        </TouchableOpacity>
        
        {/* Separator line between expense button and content */}
        <View style={styles.expensePreviewSeparator} />
        
        <View style={styles.expenseFullWidthContent}>
          {/* Left Column - Total and Count */}
          <View style={styles.expenseLeftColumn}>
            <Text style={styles.totalAmount} numberOfLines={1}>${Math.round(expenseData.totalAmount)}</Text>
            <Text style={styles.expenseCount}>{expenseData.eventCount} expense{expenseData.eventCount === 1 ? '' : 's'}</Text>
          </View>
          
          {/* Middle Column - Expense List Preview */}
          <View style={styles.expenseMiddleColumn}>
            {expenses.length > 0 ? (
              <View style={styles.expenseList}>
                {expenses.slice(0, 3).map(expense => (
                  <View key={expense.id} style={styles.expenseItem}>
                    <Text style={styles.expenseItemName} numberOfLines={1}>
                      {expense.description}
                    </Text>
                    <Text style={styles.expenseItemAmount}>
                      ${expense.totalAmount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noExpensesText}>No expenses yet</Text>
            )}
          </View>
          
          {/* Right Column - User Balance */}
          <View style={styles.expenseRightColumn}>
            {(expenseData.userOwes > 0 || expenseData.userOwed > 0) && (
              <View style={styles.userBalanceCompact}>
                {expenseData.userOwed > 0 ? (
                  <>
                    <Text style={styles.userBalanceLabelCompact}>You are owed</Text>
                    <Text style={styles.userOwedAmountCompact}>${expenseData.userOwed.toFixed(2)}</Text>
                  </>
                ) : expenseData.userOwes > 0 ? (
                  <>
                    <Text style={styles.userBalanceLabelCompact}>You owe</Text>
                    <Text style={styles.userOwesAmountCompact}>${expenseData.userOwes.toFixed(2)}</Text>
                  </>
                ) : (
                  <Text style={styles.userEvenTextCompact}>
                    All settled up
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Group Expenses Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isModalVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={handleCloseModal} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Group Expenses</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[
                styles.tab,
                activeTab === 'expenses' && styles.activeTab
              ]}
              onPress={() => setActiveTab('expenses')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'expenses' && styles.activeTabText
              ]}>
                Expenses
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.tab,
                activeTab === 'chart' && styles.activeTab
              ]}
              onPress={() => setActiveTab('chart')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'chart' && styles.activeTabText
              ]}>
                Chart
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <View style={styles.contentArea}>
            {activeTab === 'expenses' ? (
              currentStep === 'list' ? (
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
                              <View style={styles.expenseHeaderRight}>
                                <Text style={[
                                  styles.expenseAmount,
                                  isFullyPaid && styles.expenseAmountPaid
                                ]}>
                                  ${expense.totalAmount.toFixed(2)}
                                </Text>
                                {/* Show delete button only for expense creator */}
                                {expense.createdByDeviceId === currentUserId && (
                                  <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDeleteExpense(expense.id)}
                                  >
                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                            
                            <Text style={[
                              styles.expenseDetails,
                              isFullyPaid && styles.expenseDetailsPaid
                            ]}>
                              Paid by {expense.paidBy.map(id => validMembers.find(m => m.device_id === id)?.username || 'Unknown').join(', ')} • 
                              {expense.splitBetween.length} people owe ${expense.individualAmount.toFixed(2)} each
                            </Text>

                            <View style={styles.paymentStatusContainer}>
                              {[...new Set([...expense.paidBy, ...expense.splitBetween])].map(deviceId => {
                                const member = validMembers.find(m => m.device_id === deviceId);
                                const status = expense.paymentStatus[deviceId] || 'pending';
                                const isPayer = expense.paidBy.includes(deviceId);
                                const isCurrentUser = member?.device_id === currentUserId;
                                
                                // Debug logging for each participant
                                if (isCurrentUser) {
                                  console.log('👤 Current user participant debug:', {
                                    expenseId: expense.id,
                                    expenseDescription: expense.description,
                                    deviceId,
                                    memberUsername: member?.username,
                                    status,
                                    isPayer,
                                    isCurrentUser,
                                    paidByArray: expense.paidBy,
                                    splitBetweenArray: expense.splitBetween,
                                    paymentStatus: expense.paymentStatus,
                                    // Additional debugging
                                    isInPaidByArray: expense.paidBy.includes(deviceId),
                                    isInSplitBetweenArray: expense.splitBetween.includes(deviceId),
                                    calculatedButtonText: isPayer 
                                      ? (status === 'completed' ? "Haven't been paid" : "I've been paid")
                                      : (status === 'completed' ? "Haven't paid" : "I've paid")
                                  });
                                }
                                
                                if (!member) return null;

                                return (
                                  <View key={deviceId} style={styles.paymentStatusRow}>
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
                                    
                                    <View style={styles.buttonContainer}>
                                      {isCurrentUser && (
                                        <TouchableOpacity
                                          style={[
                                            styles.markPaidButton,
                                            status === 'completed' && styles.markUnpaidButton
                                          ]}
                                          onPress={() => {
                                            console.log('🔘 Button pressed!', {
                                              expenseId: expense.id,
                                              deviceId,
                                              status,
                                              isPayer,
                                              buttonText: isPayer 
                                                ? (status === 'completed' ? "Haven't been paid" : "I've been paid")
                                                : (status === 'completed' ? "Haven't paid" : "I've paid")
                                            });
                                            handleTogglePaymentStatus(expense.id, deviceId, status);
                                          }}
                                        >
                                          <Text style={[
                                            styles.markPaidButtonText,
                                            status === 'completed' && styles.markUnpaidButtonText
                                          ]}>
                                            {(() => {
                                              const buttonText = isPayer 
                                                ? (status === 'completed' ? "Haven't been paid" : "I've been paid")
                                                : (status === 'completed' ? "Haven't paid" : "I've paid");
                                              
                                              if (isCurrentUser) {
                                                console.log('🔘 Button text being rendered:', {
                                                  expenseId: expense.id,
                                                  isPayer,
                                                  status,
                                                  renderedText: buttonText
                                                });
                                              }
                                              
                                              return buttonText;
                                            })()}
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
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
              ) : (
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
                              selectedPayers.has(member.device_id) && styles.memberOptionSelected
                            ]}
                            onPress={() => togglePayerSelection(member.device_id)}
                          >
                            <Text style={[
                              styles.memberOptionText,
                              selectedPayers.has(member.device_id) && styles.memberOptionTextSelected
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
                              selectedOwers.has(member.device_id) && styles.memberOptionSelected
                            ]}
                            onPress={() => toggleOwerSelection(member.device_id)}
                          >
                            <Text style={[
                              styles.memberOptionText,
                              selectedOwers.has(member.device_id) && styles.memberOptionTextSelected
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
              )
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Chart content coming soon</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Payment WebView */}
      {currentPayment && (
        <PaymentWebView
          visible={showPaymentWebView}
          onClose={() => setShowPaymentWebView(false)}
          paymentDetails={currentPayment}
          onPaymentComplete={(success) => {
            setCurrentPayment(null);
            setProcessingExpenseId('');
            setShowPaymentWebView(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  expenseBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    flex: 1,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
    flex: 1,
  },
  noExpenseText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  expensePreview: {
    alignItems: 'center',
    gap: 4,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  eventCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  userOwes: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  userOwed: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#10b981',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9ca3af',
  },
  activeTabText: {
    color: '#10b981',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    padding: 20,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  // Expenses list styles
  scrollContainer: {
    flex: 1,
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
  expenseCardPaid: {
    backgroundColor: '#1a1a1a',
    opacity: 0.7,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  expenseTitlePaid: {
    color: '#6b7280',
  },
  expenseAmountPaid: {
    color: '#6b7280',
  },
  expenseDetails: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  expenseDetailsPaid: {
    color: '#6b7280',
  },
  paymentStatusContainer: {
    gap: 8,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  buttonContainer: {
    alignSelf: 'flex-end',
    marginTop: 'auto',
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
  memberNamePaid: {
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: '#ef4444',
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
  expenseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  // Full width block styles
  expenseBlockFullWidth: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  integratedExpenseButton: {
    marginBottom: 16,
  },
  expenseButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  integratedExpenseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  expenseButtonArrow: {
    marginLeft: 6,
  },
  expensePreviewSeparator: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 16,
  },
  expenseFullWidthContent: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  expenseLeftColumn: {
    flex: 0.25,
    alignItems: 'flex-start',
  },
  expenseMiddleColumn: {
    flex: 0.5,
  },
  expenseRightColumn: {
    flex: 0.25,
    alignItems: 'flex-end',
    gap: 8,
  },
  expenseList: {
    gap: 6,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  expenseItemName: {
    fontSize: 12,
    color: '#e5e7eb',
    flex: 1,
    marginRight: 8,
  },
  expenseItemAmount: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  noExpensesText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  userBalanceCompact: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBalanceLabelCompact: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  userOwedAmountCompact: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
    textAlign: 'center',
  },
  userOwesAmountCompact: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '700',
    textAlign: 'center',
  },
  userEvenTextCompact: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
});