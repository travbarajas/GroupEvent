import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ExpenseData {
  totalAmount: number;
  eventCount: number;
  userOwes: number;
  userOwed: number;
}

interface GroupExpenseIndicatorProps {
  groupId: string;
  currentUserId?: string;
  events: any[]; // Events data passed from parent
}

export default function GroupExpenseIndicator({ 
  groupId, 
  currentUserId,
  events 
}: GroupExpenseIndicatorProps) {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'chart'>('expenses');
  const insets = useSafeAreaInsets();

  // Load expense summary from server
  const [expenseData, setExpenseData] = useState<ExpenseData>({
    totalAmount: 0,
    eventCount: 0,
    userOwes: 0,
    userOwed: 0,
  });
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

  // Load summary when component mounts
  useEffect(() => {
    if (groupId && currentUserId) {
      loadExpenseSummary();
    }
  }, [groupId, currentUserId]);

  return (
    <>
      {/* Group Expenses Block - Same size as calendar block */}
      <TouchableOpacity 
        style={styles.expenseBlock}
        activeOpacity={0.8}
        onPress={() => setShowModal(true)}
      >
        <View style={styles.expenseHeader}>
          <Ionicons name="wallet" size={20} color="#10b981" />
          <Text style={styles.expenseTitle}>Group Expenses</Text>
          <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
        </View>
        
        {expenseData.totalAmount > 0 ? (
          <View style={styles.expensePreview}>
            <Text style={styles.totalAmount}>${expenseData.totalAmount.toFixed(2)}</Text>
            <Text style={styles.eventCount}>{expenseData.eventCount} expenses</Text>
            {expenseData.userOwes > 0 && (
              <Text style={styles.userOwes}>You owe: ${expenseData.userOwes.toFixed(2)}</Text>
            )}
            {expenseData.userOwed > 0 && (
              <Text style={styles.userOwed}>You are owed: ${expenseData.userOwed.toFixed(2)}</Text>
            )}
          </View>
        ) : (
          <Text style={styles.noExpenseText}>No expenses yet</Text>
        )}
      </TouchableOpacity>

      {/* Group Expenses Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.backButton}>
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
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Expenses content coming soon</Text>
              </View>
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Chart content coming soon</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
});