import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ExpenseParticipant {
  device_id: string;
  role: 'payer' | 'ower';
  individual_amount: number;
  payment_status: 'pending' | 'sent' | 'completed';
  username?: string;
}

interface ExpenseItemData {
  id: string;
  description: string;
  total_amount: number;
  created_by_device_id: string;
  created_at: string;
  participants: ExpenseParticipant[];
}

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface ExpenseListItemProps {
  expense: ExpenseItemData;
  members: GroupMember[];
  currentDeviceId: string;
  onPress: () => void;
  onDelete: () => void;
}

export default function ExpenseListItem({
  expense,
  members,
  currentDeviceId,
  onPress,
  onDelete,
}: ExpenseListItemProps) {
  const canDelete = expense.created_by_device_id === currentDeviceId;
  const createdByMember = members.find(m => m.device_id === expense.created_by_device_id);

  // Calculate payment status
  const getPaymentStatus = () => {
    const owers = expense.participants.filter(p => p.role === 'ower');
    
    if (owers.length === 0) return 'completed';
    
    const completedCount = owers.filter(p => p.payment_status === 'completed').length;
    const sentCount = owers.filter(p => p.payment_status === 'sent').length;
    
    if (completedCount === owers.length) return 'completed';
    if (sentCount > 0 || completedCount > 0) return 'in_progress';
    return 'pending';
  };

  const paymentStatus = getPaymentStatus();

  // Render participant avatars
  const renderParticipantAvatars = () => {
    const uniqueParticipants = new Map();
    
    // Combine participants, prioritizing those who are both payers and owers
    expense.participants.forEach(participant => {
      const existing = uniqueParticipants.get(participant.device_id);
      if (existing) {
        existing.roles.push(participant.role);
      } else {
        const member = members.find(m => m.device_id === participant.device_id);
        uniqueParticipants.set(participant.device_id, {
          device_id: participant.device_id,
          username: member?.username,
          roles: [participant.role],
          payment_status: participant.payment_status,
        });
      }
    });

    const participantArray = Array.from(uniqueParticipants.values());

    if (participantArray.length === 0) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="people-outline" size={14} color="#6b7280" />
        </View>
      );
    }

    return (
      <View style={styles.avatarContainer}>
        {participantArray.slice(0, 4).map((participant, index) => (
          <View 
            key={participant.device_id} 
            style={[
              styles.avatar, 
              { marginLeft: index > 0 ? -6 : 0 }
            ]}
          >
            <Text style={styles.avatarText}>
              {participant.username?.[0]?.toUpperCase() || '?'}
            </Text>
            {/* Role indicators */}
            {participant.roles.includes('payer') && (
              <View style={styles.payerIndicator}>
                <Text style={styles.indicatorText}>+</Text>
              </View>
            )}
            {participant.roles.includes('ower') && (
              <View style={styles.owerIndicator}>
                <Text style={styles.indicatorText}>-</Text>
              </View>
            )}
          </View>
        ))}
        {participantArray.length > 4 && (
          <View style={[styles.avatar, styles.avatarMore, { marginLeft: -6 }]}>
            <Text style={styles.avatarText}>+{participantArray.length - 4}</Text>
          </View>
        )}
      </View>
    );
  };

  // Render payment status indicator
  const renderPaymentStatus = () => {
    let statusColor, statusIcon;
    
    switch (paymentStatus) {
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
        <Ionicons name={statusIcon} size={20} color={statusColor} />
      </View>
    );
  };

  return (
    <TouchableOpacity 
      style={styles.expenseItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Participant Avatars */}
      <View style={styles.participantSection}>
        {renderParticipantAvatars()}
      </View>

      {/* Payment Status */}
      {renderPaymentStatus()}

      {/* Expense Description */}
      <View style={styles.descriptionSection}>
        <Text style={styles.description} numberOfLines={1}>
          {expense.description}
        </Text>
      </View>

      {/* Total Amount */}
      <View style={styles.amountSection}>
        <Text style={styles.amount}>
          ${expense.total_amount.toFixed(2)}
        </Text>
      </View>

      {/* Added By */}
      <View style={styles.addedBySection}>
        <Text style={styles.addedByText}>
          {createdByMember?.username || 'Unknown'}
        </Text>
      </View>

      {/* Delete Button */}
      {canDelete && (
        <TouchableOpacity 
          style={styles.deleteSection}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={12} color="#ef4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14,
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
});