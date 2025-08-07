import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Expense, calculateUserBalances } from '../utils/expenseCalculations';

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface ExpenseCardProps {
  expense: Expense;
  currentUserId: string;
  isCreator: boolean;
  isChecked: boolean;
  onToggleCheck: () => void;
  onEdit: () => void;
  onDelete: () => void;
  members: GroupMember[];
}

export default function ExpenseCard({ 
  expense, 
  currentUserId, 
  isCreator, 
  isChecked, 
  onToggleCheck, 
  onEdit, 
  onDelete,
  members
}: ExpenseCardProps) {
  // Calculate what the current user owes or is owed
  const calculateUserPosition = () => {
    const userPaid = expense.participants
      .filter(p => p.role === 'payer' && p.member_device_id === currentUserId)
      .reduce((sum, p) => sum + parseFloat(p.individual_amount.toString()), 0);
    
    const userOwes = expense.participants
      .filter(p => p.role === 'ower' && p.member_device_id === currentUserId)
      .reduce((sum, p) => sum + parseFloat(p.individual_amount.toString()), 0);
    
    const netPosition = userPaid - userOwes;
    
    // Get breakdown of who owes current user (if they paid)
    const owersToMe = expense.participants
      .filter(p => p.role === 'ower')
      .map(p => {
        const member = members.find(m => m.device_id === p.member_device_id);
        const displayName = member?.username || `User ${p.member_device_id.slice(-4)}`;
        return {
          userId: p.member_device_id,
          displayName,
          amount: (parseFloat(p.individual_amount.toString()) * userPaid) / expense.total_amount
        };
      });
    
    // Get breakdown of who current user owes (if they owe)
    const iOweToOthers = expense.participants
      .filter(p => p.role === 'payer')
      .map(p => {
        const member = members.find(m => m.device_id === p.member_device_id);
        const displayName = member?.username || `User ${p.member_device_id.slice(-4)}`;
        return {
          userId: p.member_device_id,
          displayName,
          amount: (parseFloat(p.individual_amount.toString()) * userOwes) / expense.total_amount
        };
      });
    
    return {
      netPosition,
      userPaid,
      userOwes,
      owersToMe: owersToMe.filter(o => o.amount > 0),
      iOweToOthers: iOweToOthers.filter(o => o.amount > 0)
    };
  };
  
  const position = calculateUserPosition();
  const cardStyle = isChecked ? [styles.card, styles.checkedCard] : styles.card;
  
  return (
    <View style={cardStyle}>
      <View style={styles.topRow}>
        <Text style={[styles.expenseName, isChecked && styles.checkedText]}>
          {expense.description}
        </Text>
        <View style={styles.amountContainer}>
          <Text style={[styles.totalAmount, isChecked && styles.checkedText]}>
            ${expense.total_amount.toFixed(2)}
          </Text>
          <Text style={[
            styles.netAmount,
            position.netPosition > 0 ? styles.positiveAmount : styles.negativeAmount,
            isChecked && styles.checkedText
          ]}>
            {position.netPosition > 0 ? '+' : ''}${Math.abs(position.netPosition).toFixed(2)}
          </Text>
        </View>
      </View>
      
      <View style={styles.middleSection}>
        {position.userOwes > 0 && position.iOweToOthers.length > 0 && (
          <View>
            <Text style={[styles.owesLabel, isChecked && styles.checkedText]}>
              You owe:
            </Text>
            {position.iOweToOthers.map((debt, index) => (
              <Text key={index} style={[styles.debtDetail, isChecked && styles.checkedText]}>
                ${debt.amount.toFixed(2)} to {debt.displayName}
              </Text>
            ))}
          </View>
        )}
        
        {position.userPaid > 0 && position.owersToMe.length > 0 && (
          <View>
            <Text style={[styles.owesLabel, isChecked && styles.checkedText]}>
              Owed to you:
            </Text>
            {position.owersToMe.map((debt, index) => (
              <Text key={index} style={[styles.debtDetail, isChecked && styles.checkedText]}>
                ${debt.amount.toFixed(2)} from {debt.displayName}
              </Text>
            ))}
          </View>
        )}
      </View>
      
      <View style={styles.bottomRow}>
        {isCreator && (
          <View style={styles.creatorButtons}>
            <TouchableOpacity onPress={onEdit} style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableOpacity 
          onPress={onToggleCheck} 
          style={[styles.checkbox, isChecked && styles.checkedBox]}
        >
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  checkedCard: {
    backgroundColor: '#0f0f0f',
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#ffffff',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  netAmount: {
    fontSize: 14,
    marginTop: 2,
  },
  positiveAmount: {
    color: '#4CAF50',
  },
  negativeAmount: {
    color: '#f44336',
  },
  middleSection: {
    marginVertical: 8,
  },
  owesLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#e5e7eb',
  },
  debtDetail: {
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 12,
    marginBottom: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  creatorButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#4CAF50',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkedText: {
    color: '#6b7280',
  }
});