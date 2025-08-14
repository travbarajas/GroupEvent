import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ExpenseCard from './ExpenseCard';
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
  const [checkedExpenses, setCheckedExpenses] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchExpenses();
  }, [groupId]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { expenses: expenseData } = await ApiService.getGroupExpenses(groupId, eventId);
      
      // Show ALL group expenses, sorted by total amount (highest first)
      const sortedExpenses = expenseData.sort((a: any, b: any) => 
        b.total_amount - a.total_amount
      );
      
      setExpenses(sortedExpenses);
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
              onEdit={() => {}} // No edit functionality - handled by ExpenseBlock
              onDelete={() => handleDeleteExpense(expense.id)}
              members={groupMembers}
            />
          ))
        )}
        
        {/* Add some bottom padding */}
        <View style={{ height: 20 }} />
      </ScrollView>
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