import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ExpenseCard from './ExpenseCard';
import AddExpenseModal from './AddExpenseModal';
import { Expense } from '../utils/expenseCalculations';
import { ApiService } from '@/services/api';

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface GroupExpenseIndicatorProps {
  groupId: string;
  currentUserId?: string;
  events: any[];
  members: GroupMember[];
  groupName: string;
  onExpensePress?: () => void;
}

export default function GroupExpenseIndicator({ 
  groupId, 
  currentUserId,
  events,
  members,
  groupName,
  onExpensePress 
}: GroupExpenseIndicatorProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [userOwes, setUserOwes] = useState(0);
  const [userOwed, setUserOwed] = useState(0);

  useEffect(() => {
    fetchExpenses();
  }, [groupId]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      // Fetch expenses without event_id to get all group expenses (not event-specific)
      const { expenses: expenseData } = await ApiService.getGroupExpenses(groupId);
      setExpenses(expenseData);
      
      // Calculate user's total owed/owing
      calculateUserTotals(expenseData);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateUserTotals = (expenseList: Expense[]) => {
    if (!currentUserId) return;
    
    let totalOwes = 0;
    let totalOwed = 0;
    
    expenseList.forEach(expense => {
      expense.participants.forEach(participant => {
        if (participant.member_device_id === currentUserId) {
          if (participant.role === 'ower' && participant.payment_status !== 'completed') {
            totalOwes += participant.individual_amount;
          } else if (participant.role === 'payer') {
            // Calculate how much others owe this user
            const totalOwedToUser = expense.participants
              .filter(p => p.role === 'ower' && p.payment_status !== 'completed')
              .reduce((sum, p) => sum + p.individual_amount, 0);
            totalOwed += totalOwedToUser;
          }
        }
      });
    });
    
    setUserOwes(totalOwes);
    setUserOwed(totalOwed);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchExpenses();
    setRefreshing(false);
  };

  const handleAddExpense = async (expenseData: {
    description: string;
    total_amount: number;
    participants: any[];
  }) => {
    try {
      if (!currentUserId) {
        console.error('User ID not found');
        return;
      }
      
      const requestData = {
        ...expenseData,
        created_by_device_id: currentUserId,
        // No event_id - this is a group expense, not event-specific
      };
      
      const response = await fetch(`https://group-event.vercel.app/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setShowAddModal(false);
      await fetchExpenses();
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  };

  const handleUpdateExpense = async (expenseData: {
    description: string;
    total_amount: number;
    participants: any[];
  }) => {
    if (!editingExpense) return;
    
    try {
      const response = await fetch(`https://group-event.vercel.app/api/expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setEditingExpense(null);
      await fetchExpenses();
    } catch (error) {
      console.error('Error updating expense:', error);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const response = await fetch(`https://group-event.vercel.app/api/expenses/${expenseId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const netAmount = userOwed - userOwes;
  const showSummary = userOwes > 0 || userOwed > 0;

  return (
    <View style={styles.container}>
      {/* Header with Group Expenses title */}
      <TouchableOpacity 
        style={styles.header}
        onPress={onExpensePress}
        activeOpacity={0.8}
      >
        <View style={styles.headerContent}>
          <Ionicons name="wallet" size={20} color="#10b981" />
          <Text style={styles.headerTitle}>Group Expenses</Text>
          <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
        </View>
      </TouchableOpacity>
      
      {/* Total Amount Summary */}
      {showSummary && (
        <View style={styles.summaryContainer}>
          {netAmount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You are owed</Text>
              <Text style={styles.amountOwed}>${netAmount.toFixed(2)}</Text>
            </View>
          ) : netAmount < 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You owe</Text>
              <Text style={styles.amountOwes}>${Math.abs(netAmount).toFixed(2)}</Text>
            </View>
          ) : (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>All settled up!</Text>
              <Text style={styles.amountSettled}>$0.00</Text>
            </View>
          )}
        </View>
      )}
      
      {/* Expenses List */}
      <ScrollView 
        style={styles.expenseList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#60a5fa"
            colors={["#60a5fa"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {expenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>No group expenses yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Add expenses that aren't tied to specific events
            </Text>
          </View>
        ) : (
          expenses.map(expense => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              currentUserId={currentUserId || ''}
              isCreator={expense.created_by_device_id === currentUserId}
              isChecked={false}
              onToggleCheck={() => {}}
              onEdit={() => setEditingExpense(expense)}
              onDelete={() => handleDeleteExpense(expense.id)}
              members={members}
            />
          ))
        )}
        
        {/* Add some bottom padding */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={20} color="#ffffff" />
        <Text style={styles.addButtonText}>Add Expense</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      {(showAddModal || editingExpense) && (
        <AddExpenseModal
          visible={showAddModal || !!editingExpense}
          expense={editingExpense}
          groupMembers={members}
          onSave={editingExpense ? handleUpdateExpense : handleAddExpense}
          onCancel={() => {
            setShowAddModal(false);
            setEditingExpense(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    maxHeight: 400,
  },
  header: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
    flex: 1,
  },
  summaryContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#e5e7eb',
    fontWeight: '500',
  },
  amountOwed: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  amountOwes: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  amountSettled: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  expenseList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 14,
  },
});