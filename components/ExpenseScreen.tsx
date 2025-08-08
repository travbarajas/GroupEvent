import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ExpenseCard from './ExpenseCard';
import AddExpenseModal from './AddExpenseModal';
import { Expense } from '../utils/expenseCalculations';
import { ApiService } from '../services/api';

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface ExpenseScreenProps {
  groupId: string;
  eventId?: string;
  currentUserId: string;
  groupMembers: GroupMember[];
}

export default function ExpenseScreen({ groupId, eventId, currentUserId, groupMembers }: ExpenseScreenProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [checkedExpenses, setCheckedExpenses] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchExpenses();
  }, [groupId]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { expenses: expenseData } = await ApiService.getGroupExpenses(groupId, eventId);
      setExpenses(expenseData);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      Alert.alert('Error', 'Failed to load expenses. Please try again.');
    } finally {
      setLoading(false);
    }
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
      console.log('👤 Current User ID:', currentUserId);
      console.log('🏷️  Event ID:', eventId);
      console.log('🏢 Group ID:', groupId);
      
      if (!currentUserId) {
        Alert.alert('Error', 'User ID not found. Please try refreshing the page.');
        return;
      }
      
      const requestData = {
        ...expenseData,
        created_by_device_id: currentUserId,
        ...(eventId && { event_id: eventId })
      };
      
      console.log('🚀 Creating expense with data:', JSON.stringify(requestData, null, 2));
      
      const response = await fetch(`https://group-event.vercel.app/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Expense created successfully:', responseData);
        await fetchExpenses();
        setShowAddModal(false);
        Alert.alert('Success', 'Expense added successfully!');
      } else {
        const errorData = await response.text();
        console.error('❌ Failed to add expense:', response.status, errorData);
        throw new Error(`Server error: ${errorData}`);
      }
    } catch (error: any) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', error.message || 'Failed to add expense. Please try again.');
    }
  };

  const handleEditExpense = async (expenseId: string, expenseData: {
    description: string;
    total_amount: number;
    participants: any[];
  }) => {
    try {
      const response = await fetch(`https://group-event.vercel.app/api/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData)
      });
      
      if (response.ok) {
        await fetchExpenses();
        setEditingExpense(null);
        Alert.alert('Success', 'Expense updated successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update expense');
      }
    } catch (error: any) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', error.message || 'Failed to update expense. Please try again.');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`https://group-event.vercel.app/api/expenses/${expenseId}`, {
                method: 'DELETE'
              });
              
              if (response.ok) {
                await fetchExpenses();
                Alert.alert('Success', 'Expense deleted successfully!');
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete expense');
              }
            } catch (error: any) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', error.message || 'Failed to delete expense. Please try again.');
            }
          }
        }
      ]
    );
  };

  const toggleCheck = (expenseId: string) => {
    setCheckedExpenses(prev => ({
      ...prev,
      [expenseId]: !prev[expenseId]
    }));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading expenses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            <Ionicons name="receipt-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>No expenses yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Add your first expense to start tracking group spending
            </Text>
          </View>
        ) : (
          expenses.map(expense => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              currentUserId={currentUserId}
              isCreator={expense.created_by_device_id === currentUserId}
              isChecked={checkedExpenses[expense.id] || false}
              onToggleCheck={() => toggleCheck(expense.id)}
              onEdit={() => setEditingExpense(expense)}
              onDelete={() => handleDeleteExpense(expense.id)}
              members={groupMembers}
            />
          ))
        )}
        
        {/* Add some bottom padding for the floating button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color="#ffffff" />
        <Text style={styles.addButtonText}>Add Expense</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      {(showAddModal || editingExpense) && (
        <AddExpenseModal
          visible={showAddModal || !!editingExpense}
          expense={editingExpense}
          groupMembers={groupMembers}
          onSave={editingExpense 
            ? (data) => handleEditExpense(editingExpense.id, data)
            : handleAddExpense
          }
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
    flex: 1, 
    backgroundColor: '#0a0a0a' 
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  expenseList: { 
    flex: 1, 
    padding: 16 
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: { 
    color: '#ffffff', 
    fontSize: 16, 
    fontWeight: 'bold',
    marginLeft: 8,
  }
});