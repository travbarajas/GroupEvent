import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '@/services/api';

interface ExpenseParticipant {
  device_id: string;
  // Payer information (if user paid upfront)
  payer_percentage?: number;
  payer_amount?: number;
  // Ower information (if user owes money)  
  ower_percentage?: number;
  ower_amount?: number;
  // Payment status
  payment_status: 'pending' | 'sent' | 'completed';
}

interface ExpenseItem {
  id: string;
  name: string;
  total_amount: number;
  addedBy: string;
  participants: ExpenseParticipant[];
  createdAt: string;
  eventName?: string;
}

interface GroupMember {
  member_id: string;
  device_id: string;
  username?: string;
  has_username: boolean;
}

interface ExpenseBlockProps {
  groupId: string;
  eventId?: string;
  members: GroupMember[];
  currentDeviceId: string;
}


export default function ExpenseBlock({
  groupId,
  eventId,
  members,
  currentDeviceId,
}: ExpenseBlockProps) {
  const insets = useSafeAreaInsets();
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(new Set());
  const [selectedOwers, setSelectedOwers] = useState<Set<string>>(new Set());
  const [owersPercentages, setOwersPercentages] = useState<{[key: string]: number}>({});
  const [lockedPercentages, setLockedPercentages] = useState<Set<string>>(new Set());
  const [payersPercentages, setPayersPercentages] = useState<{[key: string]: number}>({});
  const [lockedPayersPercentages, setLockedPayersPercentages] = useState<Set<string>>(new Set());
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);
  
  // Local storage for percentage data (workaround for backend not returning percentages)
  const [localPercentageData, setLocalPercentageData] = useState<{[expenseId: string]: {
    payersPercentages?: {[deviceId: string]: number};
    owersPercentages?: {[deviceId: string]: number};
  }}>({});
  
  // Editing state variables
  const [editingExpenseDescription, setEditingExpenseDescription] = useState('');
  const [editingExpenseAmount, setEditingExpenseAmount] = useState('');
  const [editingSelectedPayers, setEditingSelectedPayers] = useState<Set<string>>(new Set());
  const [editingSelectedOwers, setEditingSelectedOwers] = useState<Set<string>>(new Set());
  const [editingOwersPercentages, setEditingOwersPercentages] = useState<{[key: string]: number}>({});
  const [editingLockedPercentages, setEditingLockedPercentages] = useState<Set<string>>(new Set());
  const [editingPayersPercentages, setEditingPayersPercentages] = useState<{[key: string]: number}>({});
  const [editingLockedPayersPercentages, setEditingLockedPayersPercentages] = useState<Set<string>>(new Set());

  const validMembers = members.filter(member => member.has_username && member.username);

  // Calculate user's net total across all expenses
  const calculateUserNetTotal = () => {
    let totalOwed = 0; // Money user is owed
    let totalOwes = 0; // Money user owes

    expenseItems.forEach(expense => {
      const userAsPayer = expense.participants.find(p => p.device_id === currentDeviceId && p.payer_amount !== undefined && p.payer_amount > 0);
      const userAsOwer = expense.participants.find(p => p.device_id === currentDeviceId && p.ower_amount !== undefined && p.ower_amount > 0);

      if (userAsPayer) {
        totalOwed += userAsPayer.payer_amount;
      }
      if (userAsOwer) {
        totalOwes += userAsOwer.ower_amount;
      }
    });

    return totalOwed - totalOwes; // Positive = user is owed money, Negative = user owes money
  };

  const userNetTotal = calculateUserNetTotal();

  // Calculate who specifically owes the user and who the user owes
  const calculateSpecificDebts = () => {
    const peopleWhoOweUser: {[name: string]: number} = {};
    const peopleUserOwes: {[name: string]: number} = {};

    expenseItems.forEach(expense => {
      const userAsPayer = expense.participants.find(p => p.device_id === currentDeviceId && p.payer_amount !== undefined && p.payer_amount > 0);
      const userAsOwer = expense.participants.find(p => p.device_id === currentDeviceId && p.ower_amount !== undefined && p.ower_amount > 0);

      // If user paid for this expense, others owe them
      if (userAsPayer) {
        expense.participants
          .filter(p => p.ower_amount !== undefined && p.ower_amount > 0 && p.device_id !== currentDeviceId)
          .forEach(p => {
            const member = validMembers.find(m => m.device_id === p.device_id);
            if (member?.username) {
              peopleWhoOweUser[member.username] = (peopleWhoOweUser[member.username] || 0) + (p.ower_amount || 0);
            }
          });
      }

      // If user owes for this expense, they owe the payers (excluding themselves)
      if (userAsOwer) {
        expense.participants
          .filter(p => p.payer_amount !== undefined && p.payer_amount > 0 && p.device_id !== currentDeviceId)
          .forEach(p => {
            const member = validMembers.find(m => m.device_id === p.device_id);
            if (member?.username) {
              // Calculate what portion of the user's debt goes to this payer
              const totalPaid = expense.participants
                .filter(x => x.payer_amount !== undefined && x.payer_amount > 0 && x.device_id !== currentDeviceId)
                .reduce((sum, x) => sum + (x.payer_amount || 0), 0);
              
              if (totalPaid > 0) {
                const payerShare = (p.payer_amount || 0) / totalPaid;
                const userOwesToThisPayer = (userAsOwer.ower_amount || 0) * payerShare;
                
                peopleUserOwes[member.username] = (peopleUserOwes[member.username] || 0) + userOwesToThisPayer;
              }
            }
          });
      }
    });

    return { peopleWhoOweUser, peopleUserOwes };
  };

  const { peopleWhoOweUser, peopleUserOwes } = calculateSpecificDebts();

  // Generate header text - simple totals without names
  const getNetTotalHeaderText = () => {
    if (Math.abs(userNetTotal) < 0.01) {
      return "All settled";
    } else if (userNetTotal > 0) {
      return `You are owed $${userNetTotal.toFixed(2)}`;
    } else {
      return `You owe $${Math.abs(userNetTotal).toFixed(2)}`;
    }
  };

  // Filter and limit to top 3 most expensive expenses user is involved in
  const userInvolvedExpenses = expenseItems.filter(expense => 
    expense.participants.some(p => p.device_id === currentDeviceId)
  );
  
  const displayExpenses = userInvolvedExpenses
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 3);
  
  const hasMoreExpenses = userInvolvedExpenses.length > 3;

  // Load percentage data from AsyncStorage on component mount
  useEffect(() => {
    const loadStoredPercentageData = async () => {
      try {
        const storageKey = `expense-percentages-${groupId}`;
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          setLocalPercentageData(JSON.parse(stored));
        }
      } catch (error) {
        console.warn('Failed to load stored percentage data:', error);
      }
    };
    
    loadStoredPercentageData();
  }, [groupId]);
  
  // Save percentage data to AsyncStorage whenever it changes
  const savePercentageData = async (expenseId: string, payersPercentages: {[key: string]: number}, owersPercentages: {[key: string]: number}) => {
    try {
      const storageKey = `expense-percentages-${groupId}`;
      const newData = {
        ...localPercentageData,
        [expenseId]: {
          payersPercentages,
          owersPercentages
        }
      };
      setLocalPercentageData(newData);
      await AsyncStorage.setItem(storageKey, JSON.stringify(newData));
    } catch (error) {
      console.warn('Failed to save percentage data:', error);
    }
  };
  
  // Map percentage data from optimistic ID to real API ID
  const mapPercentageData = async (optimisticId: string, realId: string) => {
    try {
      const storageKey = `expense-percentages-${groupId}`;
      const data = localPercentageData[optimisticId];
      if (data) {
        const newData = {
          ...localPercentageData,
          [realId]: data
        };
        delete newData[optimisticId]; // Remove the optimistic entry
        setLocalPercentageData(newData);
        await AsyncStorage.setItem(storageKey, JSON.stringify(newData));
      }
    } catch (error) {
      console.warn('Failed to map percentage data:', error);
    }
  };

  // Load expenses from API on component mount
  useEffect(() => {
    loadExpenses();
  }, [groupId]);

  const loadExpenses = async () => {
    try {
      const { expenses: apiExpenses } = await ApiService.getGroupExpenses(groupId, eventId);
      
      
      // Transform API data to match our interface
      const transformedExpenses: ExpenseItem[] = apiExpenses.map((expense: any) => {
        
        // Create participants array from API data
        const participants: ExpenseParticipant[] = [];
        
        // Check if API returns participant records with percentage data
        if (expense.participants && Array.isArray(expense.participants)) {
          
          expense.participants.forEach((participant: any) => {
            const participantData: ExpenseParticipant = {
              device_id: participant.member_device_id,
              payment_status: participant.payment_status || 'pending'
            };
            
            // Add payer data if this participant is a payer
            if (participant.role === 'payer' || participant.payer_percentage || participant.payer_amount) {
              participantData.payer_percentage = participant.payer_percentage || (100 / expense.payers?.length || 1);
              participantData.payer_amount = parseFloat(participant.payer_amount) || parseFloat(participant.individual_amount) || 0;
            }
            
            // Add ower data if this participant is an ower  
            if (participant.role === 'ower' || participant.ower_percentage || participant.ower_amount) {
              participantData.ower_percentage = participant.ower_percentage || (100 / expense.owers?.length || 1);
              participantData.ower_amount = parseFloat(participant.ower_amount) || parseFloat(participant.individual_amount) || 0;
            }
            
            
            participants.push(participantData);
          });
        } else {
          // Fallback to old processing method if no participant records
          console.log('No participant records found, using fallback processing...');
          
          // Add payers with their contribution amounts and percentages
          if (expense.payers && Array.isArray(expense.payers)) {
            expense.payers.forEach((payerDeviceId: string) => {
              // Try to get percentage from: 1) API response, 2) local storage, 3) equal split fallback
              const localData = localPercentageData[expense.id];
              const payerPercentage = expense.payers_percentages?.[payerDeviceId] 
                || localData?.payersPercentages?.[payerDeviceId] 
                || (100 / expense.payers.length);
              const payerAmount = (parseFloat(expense.total_amount) || 0) * payerPercentage / 100;
              
              console.log(`Payer ${payerDeviceId}:`, {
                percentage: payerPercentage,
                amount: payerAmount,
                hasPercentageData: !!expense.payers_percentages?.[payerDeviceId],
                hasLocalData: !!localData?.payersPercentages?.[payerDeviceId]
              });
              
              participants.push({
                device_id: payerDeviceId,
                payer_percentage: payerPercentage,
                payer_amount: payerAmount,
                payment_status: expense.payment_status?.[payerDeviceId] || 'pending'
              });
            });
          }
          
          // Add owers with their share amounts and percentages (fallback method)
          if (expense.owers && Array.isArray(expense.owers)) {
            expense.owers.forEach((owerDeviceId: string) => {
              // Try to get percentage from: 1) API response, 2) local storage, 3) equal split fallback
              const localData = localPercentageData[expense.id];
              const owerPercentage = expense.owers_percentages?.[owerDeviceId] 
                || localData?.owersPercentages?.[owerDeviceId] 
                || (100 / expense.owers.length);
              const owerAmount = (parseFloat(expense.total_amount) || 0) * owerPercentage / 100;
              
              console.log(`Ower ${owerDeviceId}:`, {
                percentage: owerPercentage,
                amount: owerAmount,
                hasPercentageData: !!expense.owers_percentages?.[owerDeviceId],
                hasLocalData: !!localData?.owersPercentages?.[owerDeviceId]
              });
              
              participants.push({
                device_id: owerDeviceId,
                ower_percentage: owerPercentage,
                ower_amount: owerAmount,
                payment_status: expense.payment_status?.[owerDeviceId] || 'pending'
              });
            });
          }
        }
        
        return {
          id: expense.id,
          name: expense.description || 'Untitled Expense',
          total_amount: parseFloat(expense.total_amount) || 0,
          addedBy: expense.created_by_device_id,
          participants: participants,
          createdAt: expense.created_at,
          eventName: expense.event_name || undefined,
        };
      });
      
      setExpenseItems(transformedExpenses);
    } catch (error) {
      // If API fails, continue with empty state
      setExpenseItems([]);
    }
  };



  const deleteExpense = async (expenseId: string) => {
    const expense = expenseItems.find(e => e.id === expenseId);
    if (expense && expense.addedBy !== currentDeviceId) {
      Alert.alert('Error', 'You can only delete expenses you created.');
      return;
    }
    
    try {
      // Optimistic update
      const previousExpenses = expenseItems;
      setExpenseItems(prev => prev.filter(expense => expense.id !== expenseId));

      // Delete via API
      await ApiService.deleteGroupExpense(groupId, expenseId);
    } catch (error) {
      // Revert optimistic update on error
      setExpenseItems(expenseItems);
      Alert.alert('Error', 'Failed to delete expense. Please try again.');
    }
  };

  const updatePercentage = (deviceId: string, newPercentage: number) => {
    const newPercentages = { ...owersPercentages };
    const allOwers = Array.from(selectedOwers);
    const otherOwers = allOwers.filter(id => id !== deviceId && !lockedPercentages.has(id));
    
    // Check if this is the only unlocked slider (all others are locked)
    const unlockedCount = allOwers.filter(id => !lockedPercentages.has(id)).length;
    if (unlockedCount === 1) {
      // Don't allow changes if this is the only unlocked slider
      return;
    }
    
    // Set the new percentage for this user
    newPercentages[deviceId] = Math.max(0, Math.min(100, newPercentage));
    
    // Calculate how much percentage is already locked
    const lockedTotal = Array.from(lockedPercentages).reduce((sum, id) => {
      return sum + (newPercentages[id] || 0);
    }, 0);
    
    // Calculate remaining percentage to distribute (excluding locked and current user)
    const remaining = 100 - newPercentages[deviceId] - lockedTotal;
    
    if (otherOwers.length > 0 && remaining >= 0) {
      // Distribute remaining percentage equally among unlocked others
      const equalShare = Math.floor(remaining / otherOwers.length);
      const remainder = remaining % otherOwers.length;
      
      otherOwers.forEach((id, index) => {
        newPercentages[id] = equalShare + (index < remainder ? 1 : 0);
      });
    }
    
    setOwersPercentages(newPercentages);
  };

  const togglePercentageLock = (deviceId: string) => {
    const newLocked = new Set(lockedPercentages);
    if (newLocked.has(deviceId)) {
      newLocked.delete(deviceId);
    } else {
      newLocked.add(deviceId);
    }
    setLockedPercentages(newLocked);
  };

  const updatePayerPercentage = (deviceId: string, newPercentage: number) => {
    const newPercentages = { ...payersPercentages };
    const allPayers = Array.from(selectedPayers);
    const otherPayers = allPayers.filter(id => id !== deviceId && !lockedPayersPercentages.has(id));
    
    // Check if this is the only unlocked slider (all others are locked)
    const unlockedCount = allPayers.filter(id => !lockedPayersPercentages.has(id)).length;
    if (unlockedCount === 1) {
      // Don't allow changes if this is the only unlocked slider
      return;
    }
    
    // Set the new percentage for this user
    newPercentages[deviceId] = Math.max(0, Math.min(100, newPercentage));
    
    // Calculate how much percentage is already locked
    const lockedTotal = Array.from(lockedPayersPercentages).reduce((sum, id) => {
      return sum + (newPercentages[id] || 0);
    }, 0);
    
    // Calculate remaining percentage to distribute (excluding locked and current user)
    const remaining = 100 - newPercentages[deviceId] - lockedTotal;
    
    if (otherPayers.length > 0 && remaining >= 0) {
      // Distribute remaining percentage equally among unlocked others
      const equalShare = Math.floor(remaining / otherPayers.length);
      const remainder = remaining % otherPayers.length;
      
      otherPayers.forEach((id, index) => {
        newPercentages[id] = equalShare + (index < remainder ? 1 : 0);
      });
    }
    
    setPayersPercentages(newPercentages);
  };

  const togglePayerPercentageLock = (deviceId: string) => {
    const newLocked = new Set(lockedPayersPercentages);
    if (newLocked.has(deviceId)) {
      newLocked.delete(deviceId);
    } else {
      newLocked.add(deviceId);
    }
    setLockedPayersPercentages(newLocked);
  };

  const updateEditingPercentage = (deviceId: string, newPercentage: number) => {
    const allOwers = Array.from(editingSelectedOwers);
    const unlockedOwers = allOwers.filter(id => !editingLockedPercentages.has(id));
    const currentPercentage = editingOwersPercentages[deviceId] || 0;
    const difference = newPercentage - currentPercentage;
    
    if (unlockedOwers.length <= 1) return;
    
    const otherUnlockedOwers = unlockedOwers.filter(id => id !== deviceId);
    const totalOtherPercentage = otherUnlockedOwers.reduce((sum, id) => sum + (editingOwersPercentages[id] || 0), 0);
    
    if (totalOtherPercentage - difference < 0) return;
    
    const newPercentages = { ...editingOwersPercentages };
    newPercentages[deviceId] = newPercentage;
    
    const distributionPerOwer = Math.floor(difference / otherUnlockedOwers.length);
    const remainder = difference % otherUnlockedOwers.length;
    
    otherUnlockedOwers.forEach((id, index) => {
      const currentValue = newPercentages[id] || 0;
      const adjustment = distributionPerOwer + (index < remainder ? 1 : 0);
      newPercentages[id] = Math.max(0, currentValue - adjustment);
    });
    
    const total = Object.values(newPercentages).reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - 100) > 1) return;
    
    setEditingOwersPercentages(newPercentages);
  };

  const handleSaveExpenseEdit = async () => {
    if (!selectedExpense) return;
    
    const amount = parseFloat(editingExpenseAmount);
    
    if (!editingExpenseDescription.trim()) {
      alert('Please enter an expense description');
      return;
    }
    
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    if (editingSelectedPayers.size === 0) {
      alert('Please select who paid upfront');
      return;
    }
    
    if (editingSelectedOwers.size === 0) {
      alert('Please select who should pay back');
      return;
    }

    try {
      // Create updated expense with new data
      const updatedExpense: ExpenseItem = {
        ...selectedExpense,
        name: editingExpenseDescription.trim(),
        total_amount: amount,
        participants: [
          ...Array.from(editingSelectedPayers).map(deviceId => ({
            device_id: deviceId,
            payer_percentage: editingPayersPercentages[deviceId] || 0,
            payer_amount: (amount * (editingPayersPercentages[deviceId] || 0)) / 100,
            payment_status: 'pending' as const
          })),
          ...Array.from(editingSelectedOwers).map(deviceId => ({
            device_id: deviceId,
            ower_percentage: editingOwersPercentages[deviceId] || 0,
            ower_amount: (amount * (editingOwersPercentages[deviceId] || 0)) / 100,
            payment_status: 'pending' as const
          }))
        ]
      };
      
      // Save percentage data locally for the edited expense
      console.log('Saving percentage data for expense ID:', selectedExpense.id, {
        payersPercentages: editingPayersPercentages,
        owersPercentages: editingOwersPercentages
      });
      await savePercentageData(selectedExpense.id, editingPayersPercentages, editingOwersPercentages);
      
      // Update the expense in the list optimistically
      const updatedExpenses = expenseItems.map(expense => 
        expense.id === selectedExpense.id ? updatedExpense : expense
      );
      setExpenseItems(updatedExpenses);
      
      // Close the modal
      setShowExpenseModal(false);
      
      // Workaround: Delete + Recreate since backend doesn't support PUT for expense updates
      // Only attempt server sync if user created this expense (has delete permission)
      if (selectedExpense.addedBy === currentDeviceId) {
        try {
          // Create the new expense first to ensure it works before deleting the original
          console.log('=== EDITING EXPENSE DEBUG ===');
          console.log('Original expense data:', {
            id: selectedExpense.id,
            name: selectedExpense.name,
            total_amount: selectedExpense.total_amount,
            participants: selectedExpense.participants
          });
          
          console.log('Editing data being sent to API:', {
            description: editingExpenseDescription.trim(),
            totalAmount: amount,
            paidBy: Array.from(editingSelectedPayers),
            splitBetween: Array.from(editingSelectedOwers),
            payersPercentages: editingPayersPercentages,
            owersPercentages: editingOwersPercentages
          });
          
          // Create participants array for the API using new format
          const participants = [];
          
          // Add payers
          for (const deviceId of editingSelectedPayers) {
            participants.push({
              device_id: deviceId,
              role: 'payer' as const,
              percentage: editingPayersPercentages[deviceId] || 0,
              amount: (amount * (editingPayersPercentages[deviceId] || 0)) / 100
            });
          }
          
          // Add owers
          for (const deviceId of editingSelectedOwers) {
            participants.push({
              device_id: deviceId,
              role: 'ower' as const,
              percentage: editingOwersPercentages[deviceId] || 0,
              amount: (amount * (editingOwersPercentages[deviceId] || 0)) / 100
            });
          }
          
          console.log('=== EDIT EXPENSE API REQUEST ===');
          console.log('Participants:', JSON.stringify(participants, null, 2));
          
          console.log('Creating updated expense...');
          const newExpenseResponse = await ApiService.createGroupExpense(groupId, {
            description: editingExpenseDescription.trim(),
            totalAmount: amount,
            eventId: eventId, // Associate with the current event
            participants: participants
          });
          
          // Check if this was an optimistic expense
          const wasOptimisticExpense = selectedExpense.id.startsWith('optimistic-');
          const newExpenseId = newExpenseResponse?.expenseId || newExpenseResponse?.expense?.id;
          
          if (!newExpenseId) {
            throw new Error('Failed to get new expense ID from API response');
          }
          
          console.log(`✅ New expense created with ID: ${newExpenseId}`);
          
          // Create the new expense object for frontend state
          const newExpense: ExpenseItem = {
            id: newExpenseId,
            name: editingExpenseDescription.trim(),
            total_amount: amount,
            addedBy: currentDeviceId,
            participants: [
              ...Array.from(editingSelectedPayers).map(deviceId => ({
                device_id: deviceId,
                payer_percentage: editingPayersPercentages[deviceId] || 0,
                payer_amount: (amount * (editingPayersPercentages[deviceId] || 0)) / 100,
                payment_status: 'pending' as const
              })),
              ...Array.from(editingSelectedOwers).map(deviceId => ({
                device_id: deviceId,
                ower_percentage: editingOwersPercentages[deviceId] || 0,
                ower_amount: (amount * (editingOwersPercentages[deviceId] || 0)) / 100,
                payment_status: 'pending' as const
              }))
            ],
            createdAt: new Date().toISOString(),
          };
          
          if (wasOptimisticExpense) {
            // Map percentage data from optimistic ID to new real ID
            console.log(`📊 Mapping percentage data from ${selectedExpense.id} to ${newExpenseId}`);
            await mapPercentageData(selectedExpense.id, newExpenseId);
            
            // Remove optimistic expense and add new real expense
            console.log('🔄 Replacing optimistic expense with real expense in state');
            setExpenseItems(prev => prev.filter(expense => expense.id !== selectedExpense.id).concat(newExpense));
          } else {
            // For real expenses, delete the old one and add the new one
            console.log('Deleting original expense...');
            await ApiService.deleteGroupExpense(groupId, selectedExpense.id);
            
            // Replace old expense with new expense in state
            console.log('🔄 Replacing old expense with new expense in state');
            setExpenseItems(prev => prev.filter(expense => expense.id !== selectedExpense.id).concat(newExpense));
          }
          
          // Save percentage data for the new expense ID
          console.log(`💾 Saving percentage data for new expense ID: ${newExpenseId}`);
          await savePercentageData(newExpenseId, editingPayersPercentages, editingOwersPercentages);
          
          console.log('Successfully updated expense via recreate+delete');
          
          // Close the modal to prevent duplicate edits
          setShowExpenseModal(false);
          setSelectedExpense(null);
          
          // Don't reload expenses - the optimistic update already has correct data
          // Reloading would lose our percentage data since the new expense has a different ID
          console.log('Skipping reload to preserve percentage data. Server sync complete.');
          console.log('=== END EDITING EXPENSE DEBUG ===');
          
        } catch (apiError) {
          console.error('Delete+recreate failed:', apiError);
          alert('Failed to sync changes to server. Changes are saved locally only.');
          // If API fails, at least we have the optimistic update
        }
        
        // State updates are handled in the success block above
        
      } else {
        console.warn('Cannot sync changes to server - user did not create this expense');
        alert('Changes saved locally only. You can only sync changes for expenses you created.');
        
        // Close the modal after showing the message
        setShowExpenseModal(false);
        setSelectedExpense(null);
      }
      
    } catch (error) {
      console.error('Failed to update expense:', error);
      alert('Failed to update expense. Please try again.');
      // Reload expenses on error to revert optimistic update
      loadExpenses();
    }
  };

  const togglePayer = (deviceId: string) => {
    const newPayers = new Set(selectedPayers);
    if (newPayers.has(deviceId)) {
      newPayers.delete(deviceId);
      const newPercentages = { ...payersPercentages };
      delete newPercentages[deviceId];
      
      // Remove from locked as well
      const newLocked = new Set(lockedPayersPercentages);
      newLocked.delete(deviceId);
      setLockedPayersPercentages(newLocked);
      
      // Redistribute percentages equally
      const remainingMembers = Array.from(newPayers);
      if (remainingMembers.length > 0) {
        const equalPercentage = Math.floor(100 / remainingMembers.length);
        remainingMembers.forEach(id => {
          newPercentages[id] = equalPercentage;
        });
      }
      setPayersPercentages(newPercentages);
    } else {
      newPayers.add(deviceId);
      
      // Redistribute percentages equally among all selected payers
      const newPercentages = { ...payersPercentages };
      const allPayers = Array.from(newPayers);
      const equalPercentage = Math.floor(100 / allPayers.length);
      allPayers.forEach(id => {
        newPercentages[id] = equalPercentage;
      });
      setPayersPercentages(newPercentages);
    }
    setSelectedPayers(newPayers);
  };

  const toggleOwer = (deviceId: string) => {
    const newOwers = new Set(selectedOwers);
    if (newOwers.has(deviceId)) {
      newOwers.delete(deviceId);
      const newPercentages = { ...owersPercentages };
      delete newPercentages[deviceId];
      
      // Remove from locked as well
      const newLocked = new Set(lockedPercentages);
      newLocked.delete(deviceId);
      setLockedPercentages(newLocked);
      
      // Redistribute percentages equally
      const remainingMembers = Array.from(newOwers);
      if (remainingMembers.length > 0) {
        const equalPercentage = Math.floor(100 / remainingMembers.length);
        remainingMembers.forEach(id => {
          newPercentages[id] = equalPercentage;
        });
      }
      setOwersPercentages(newPercentages);
    } else {
      newOwers.add(deviceId);
      
      // Redistribute percentages equally among all selected owers
      const newPercentages = { ...owersPercentages };
      const allOwers = Array.from(newOwers);
      const equalPercentage = Math.floor(100 / allOwers.length);
      allOwers.forEach(id => {
        newPercentages[id] = equalPercentage;
      });
      setOwersPercentages(newPercentages);
    }
    setSelectedOwers(newOwers);
  };

  const addCustomExpense = async () => {
    if (!newExpenseDescription.trim()) {
      Alert.alert('Error', 'Please enter an expense description');
      return;
    }

    const amount = parseFloat(newExpenseAmount) || 0;
    if (amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      // Create optimistic expense with participants
      const payerParticipants: ExpenseParticipant[] = Array.from(selectedPayers).map(deviceId => ({
        device_id: deviceId,
        payer_percentage: payersPercentages[deviceId] || 0,
        payer_amount: (amount * (payersPercentages[deviceId] || 0)) / 100,
        payment_status: 'pending' as const
      }));
      
      const owerParticipants: ExpenseParticipant[] = Array.from(selectedOwers).map(deviceId => ({
        device_id: deviceId,
        ower_percentage: owersPercentages[deviceId] || 0,
        ower_amount: (amount * (owersPercentages[deviceId] || 0)) / 100,
        payment_status: 'pending' as const
      }));
      
      const optimisticExpense: ExpenseItem = {
        id: `optimistic-${Date.now()}`,
        name: newExpenseDescription.trim(),
        total_amount: amount,
        addedBy: currentDeviceId,
        participants: [...payerParticipants, ...owerParticipants],
        createdAt: new Date().toISOString(),
      };

      // Save percentage data locally for the optimistic expense
      await savePercentageData(optimisticExpense.id, payersPercentages, owersPercentages);

      setExpenseItems(prev => [...prev, optimisticExpense]);
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setShowAddExpenseModal(false);

      // Create via API in background using new participant-based format
      try {
        const participants = [];
        
        // Add payers
        for (const deviceId of selectedPayers) {
          participants.push({
            device_id: deviceId,
            role: 'payer' as const,
            percentage: payersPercentages[deviceId] || 0,
            amount: (amount * (payersPercentages[deviceId] || 0)) / 100
          });
        }
        
        // Add owers
        for (const deviceId of selectedOwers) {
          participants.push({
            device_id: deviceId,
            role: 'ower' as const,
            percentage: owersPercentages[deviceId] || 0,
            amount: (amount * (owersPercentages[deviceId] || 0)) / 100
          });
        }
        
        console.log('=== ADD EXPENSE API REQUEST ===');
        console.log('Participants:', JSON.stringify(participants, null, 2));
        
        await ApiService.createGroupExpense(groupId, {
          description: newExpenseDescription.trim(),
          totalAmount: amount,
          eventId: eventId,
          participants: participants
        });
        // Note: Not reloading from API to preserve custom percentages
        // The optimistic expense already has the correct percentage data
      } catch (apiError) {
        console.warn('API call failed, but optimistic update succeeded:', apiError);
        // Continue with optimistic data even if API fails
      }
    } catch (error) {
      // Revert optimistic update on error
      setExpenseItems(prev => prev.filter(expense => !expense.id.startsWith('optimistic-')));
      setShowAddExpenseModal(true);
      Alert.alert('Error', 'Failed to add expense. Please try again.');
    }
  };

  const renderPayerAvatars = (participants: ExpenseParticipant[]) => {
    // Show people who paid upfront
    const payers = participants.filter(p => p.payer_amount !== undefined && p.payer_amount > 0);
    
    if (payers.length === 0) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.placeholderText}>-</Text>
        </View>
      );
    }

    return (
      <View style={styles.avatarContainer}>
        {payers.slice(0, 3).map((participant, index) => {
          const member = validMembers.find(m => m.device_id === participant.device_id);
          return (
            <View 
              key={`payer-${participant.device_id}`} 
              style={[
                styles.avatar, 
                styles.payerAvatar,
                { marginLeft: index > 0 ? -4 : 0 }
              ]}
            >
              <Text style={styles.avatarText}>
                {member?.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          );
        })}
        {payers.length > 3 && (
          <View style={[styles.avatar, styles.avatarMore, { marginLeft: -4 }]}>
            <Text style={styles.avatarText}>+{payers.length - 3}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderOwerAvatars = (participants: ExpenseParticipant[]) => {
    // Show people who owe money
    const owers = participants.filter(p => p.ower_amount !== undefined && p.ower_amount > 0);
    
    if (owers.length === 0) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.placeholderText}>-</Text>
        </View>
      );
    }

    return (
      <View style={styles.avatarContainer}>
        {owers.slice(0, 3).map((participant, index) => {
          const member = validMembers.find(m => m.device_id === participant.device_id);
          return (
            <View 
              key={`ower-${participant.device_id}`} 
              style={[
                styles.avatar,
                styles.owerAvatar, 
                { marginLeft: index > 0 ? -4 : 0 }
              ]}
            >
              <Text style={styles.avatarText}>
                {member?.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          );
        })}
        {owers.length > 3 && (
          <View style={[styles.avatar, styles.avatarMore, { marginLeft: -4 }]}>
            <Text style={styles.avatarText}>+{owers.length - 3}</Text>
          </View>
        )}
      </View>
    );
  };


  const renderExpenseItem = (expense: ExpenseItem) => {
    const addedByMember = validMembers.find(m => m.device_id === expense.addedBy);
    const canDelete = expense.addedBy === currentDeviceId;

    return (
      <TouchableOpacity 
        key={expense.id} 
        style={styles.expenseItemNew}
        onPress={() => {
          setSelectedExpense(expense);
          // Initialize editing state with current expense data
          setEditingExpenseDescription(expense.name);
          setEditingExpenseAmount(expense.total_amount.toString());
          setEditingSelectedPayers(new Set(expense.participants.filter(p => p.payer_amount !== undefined && p.payer_amount > 0).map(p => p.device_id)));
          setEditingSelectedOwers(new Set(expense.participants.filter(p => p.ower_amount !== undefined && p.ower_amount > 0).map(p => p.device_id)));
          
          // Initialize ower percentages from stored data
          const initialOwersPercentages: {[key: string]: number} = {};
          const owersData = expense.participants.filter(p => p.ower_amount !== undefined && p.ower_amount > 0);
          owersData.forEach(participant => {
            // If percentage is missing or appears to be wrong (like 1 instead of 100), calculate equal split
            const percentage = participant.ower_percentage && participant.ower_percentage >= 5 
              ? participant.ower_percentage 
              : Math.floor(100 / owersData.length);
            console.log(`🔧 Ower ${participant.device_id}: stored=${participant.ower_percentage}, using=${percentage}`);
            initialOwersPercentages[participant.device_id] = percentage;
          });
          setEditingOwersPercentages(initialOwersPercentages);
          setEditingLockedPercentages(new Set());
          
          // Initialize payer percentages from stored data
          const initialPayersPercentages: {[key: string]: number} = {};
          const payersData = expense.participants.filter(p => p.payer_amount !== undefined && p.payer_amount > 0);
          payersData.forEach(participant => {
            // If percentage is missing or appears to be wrong (like 1 instead of 100), calculate equal split
            const percentage = participant.payer_percentage && participant.payer_percentage >= 5 
              ? participant.payer_percentage 
              : Math.floor(100 / payersData.length);
            console.log(`🔧 Payer ${participant.device_id}: stored=${participant.payer_percentage}, using=${percentage}`);
            initialPayersPercentages[participant.device_id] = percentage;
          });
          setEditingPayersPercentages(initialPayersPercentages);
          setEditingLockedPayersPercentages(new Set());
          
          setShowExpenseModal(true);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.expenseItemContainer}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text style={styles.expenseName}>
              {expense.name.length > 24 ? `${expense.name.substring(0, 24)}...` : expense.name}
            </Text>
            
            <View style={styles.titleRightSection}>
              {/* Total Amount */}
              <Text style={styles.totalAmountTopRight}>
                ${(expense.total_amount || 0).toFixed(2)}
              </Text>
              
              {/* Delete Button - Right of amount */}
              {canDelete && (
                <TouchableOpacity 
                  style={styles.deleteButtonTitleRow}
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteExpense(expense.id);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Event Name Row - Only show if expense is from an event */}
          {expense.eventName && (
            <View style={styles.eventNameRow}>
              <Text style={styles.eventNameText}>
                from {expense.eventName}
              </Text>
            </View>
          )}

          {/* Content Break */}
          <View style={styles.contentBreak} />

          {/* Content Row - User's debt status */}
          <View style={styles.contentRowNew}>
            {/* User's owe status */}
            <View style={styles.userOwesContainer}>
              {(() => {
                // Find user's role in this expense
                const userAsOwer = expense.participants.find(p => p.device_id === currentDeviceId && p.ower_amount !== undefined && p.ower_amount > 0);
                const userAsPayer = expense.participants.find(p => p.device_id === currentDeviceId && p.payer_amount !== undefined && p.payer_amount > 0);
                
                if (!userAsOwer && !userAsPayer) {
                  return <Text style={styles.userDebtText}>Not involved</Text>;
                }
                
                // Calculate what user owes
                const userPaid = userAsPayer?.payer_amount || 0;
                const userOwes = userAsOwer?.ower_amount || 0;
                const netAmount = userPaid - userOwes;
                
                if (Math.abs(netAmount) < 0.01) {
                  return <Text style={styles.userDebtText}>All settled up</Text>;
                }
                
                if (netAmount > 0) {
                  // User is owed money - show who owes them
                  const owers = expense.participants
                    .filter(p => p.ower_amount !== undefined && p.ower_amount > 0 && p.device_id !== currentDeviceId)
                    .map(p => validMembers.find(m => m.device_id === p.device_id)?.username || 'Unknown')
                    .filter(name => name !== 'Unknown');
                  
                  if (owers.length === 0) {
                    return <Text style={styles.userOwedText}>You are owed ${netAmount.toFixed(2)}</Text>;
                  }
                  
                  let owersText = '';
                  if (owers.length === 1) {
                    owersText = `${owers[0]} owes you ${netAmount.toFixed(2)}`;
                  } else if (owers.length === 2) {
                    owersText = `${owers[0]} and ${owers[1]} owe you a total of ${netAmount.toFixed(2)}`;
                  } else {
                    owersText = `${owers.slice(0, -1).join(', ')}, and ${owers[owers.length - 1]} owe you a total of ${netAmount.toFixed(2)}`;
                  }
                  
                  return <Text style={styles.userOwedText}>{owersText}</Text>;
                }
                
                // User owes money - show who they owe to (excluding themselves)
                const payers = expense.participants
                  .filter(p => p.payer_amount !== undefined && p.payer_amount > 0 && p.device_id !== currentDeviceId)
                  .map(p => validMembers.find(m => m.device_id === p.device_id)?.username || 'Unknown')
                  .filter(name => name !== 'Unknown');
                
                if (payers.length === 0) {
                  // User owes but paid for themselves - should show as settled
                  return <Text style={styles.userDebtText}>All settled up</Text>;
                }
                
                let payersText = '';
                let preposition = 'to';
                
                if (payers.length === 1) {
                  payersText = payers[0];
                  preposition = 'to';
                } else if (payers.length === 2) {
                  payersText = `${payers[0]} and ${payers[1]}`;
                  preposition = 'between';
                } else if (payers.length > 2) {
                  payersText = `${payers.slice(0, -1).join(', ')}, and ${payers[payers.length - 1]}`;
                  preposition = 'between';
                }
                
                return (
                  <Text style={styles.userOwesText}>
                    You owe ${Math.abs(netAmount).toFixed(2)} {preposition} {payersText}
                  </Text>
                );
              })()}
            </View>
        </View>

        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.expenseBlock}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="wallet" size={20} color="#60a5fa" />
            <Text style={styles.title}>Expenses</Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.netTotalButton}
              onPress={() => {
                setSelectedExpense(null);
                setShowExpenseModal(true);
              }}
            >
              <Text style={
                Math.abs(userNetTotal) < 0.01 ? styles.netTotalTextSettled :
                userNetTotal > 0 ? styles.netTotalTextOwed :
                styles.netTotalTextOwes
              }>
                {getNetTotalHeaderText()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {expenseItems.length > 0 && (
          <View style={styles.separator} />
        )}

        <View style={styles.expenseContent}>
          {displayExpenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyStateText}>No expenses yet</Text>
              <Text style={styles.emptyStateSubtext}>Add an expense to get started</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {displayExpenses.map(renderExpenseItem)}
              
              {/* View All Button - Show if there are more than 3 user-involved expenses OR for testing */}
              {(hasMoreExpenses || userInvolvedExpenses.length > 0) && (
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={() => {
                    setSelectedExpense(null);
                    setShowExpenseModal(true);
                  }}
                >
                  <Ionicons name="list-outline" size={18} color="#60a5fa" />
                  <Text style={styles.viewAllButtonText}>View All Expenses</Text>
                </TouchableOpacity>
              )}
              
              {/* Add Expense Button at bottom */}
              <TouchableOpacity 
                style={styles.addExpenseButton}
                onPress={() => setShowAddExpenseModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#10b981" />
                <Text style={styles.addExpenseButtonText}>Add New Expense</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Add Expense Modal */}
      <AddExpenseModal 
        visible={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        newExpenseDescription={newExpenseDescription}
        setNewExpenseDescription={setNewExpenseDescription}
        newExpenseAmount={newExpenseAmount}
        setNewExpenseAmount={setNewExpenseAmount}
        onAddExpense={addCustomExpense}
        members={validMembers}
        selectedPayers={selectedPayers}
        setSelectedPayers={setSelectedPayers}
        selectedOwers={selectedOwers}
        setSelectedOwers={setSelectedOwers}
        owersPercentages={owersPercentages}
        setOwersPercentages={setOwersPercentages}
        lockedPercentages={lockedPercentages}
        setLockedPercentages={setLockedPercentages}
        payersPercentages={payersPercentages}
        setPayersPercentages={setPayersPercentages}
        lockedPayersPercentages={lockedPayersPercentages}
        setLockedPayersPercentages={setLockedPayersPercentages}
        onUpdatePercentage={updatePercentage}
        onTogglePercentageLock={togglePercentageLock}
        onUpdatePayerPercentage={updatePayerPercentage}
        onTogglePayerPercentageLock={togglePayerPercentageLock}
        onToggleOwer={toggleOwer}
        onTogglePayer={togglePayer}
      />

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={showExpenseModal}
          onRequestClose={() => setShowExpenseModal(false)}
        >
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowExpenseModal(false)} style={styles.modalBackButton}>
                <Ionicons name="chevron-back" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Expense</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>Expense Description</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="What was this expense for?"
                  placeholderTextColor="#9ca3af"
                  value={editingExpenseDescription}
                  onChangeText={setEditingExpenseDescription}
                />
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>Total Amount ($)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  value={editingExpenseAmount}
                  onChangeText={setEditingExpenseAmount}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>Who Paid?</Text>
                <View style={styles.memberList}>
                  {validMembers.map(member => (
                    <View key={`edit-payer-${member.device_id}`}>
                      <TouchableOpacity
                        style={[
                          styles.memberOption,
                          editingSelectedPayers.has(member.device_id) && styles.memberOptionSelected
                        ]}
                        onPress={() => {
                          const newSelected = new Set(editingSelectedPayers);
                          if (newSelected.has(member.device_id)) {
                            newSelected.delete(member.device_id);
                            const newPercentages = { ...editingPayersPercentages };
                            delete newPercentages[member.device_id];
                            
                            // Remove from locked as well
                            const newLocked = new Set(editingLockedPayersPercentages);
                            newLocked.delete(member.device_id);
                            setEditingLockedPayersPercentages(newLocked);
                            
                            // Redistribute percentages equally
                            const remainingMembers = Array.from(newSelected);
                            if (remainingMembers.length > 0) {
                              const equalPercentage = Math.floor(100 / remainingMembers.length);
                              remainingMembers.forEach(id => {
                                newPercentages[id] = equalPercentage;
                              });
                            }
                            setEditingPayersPercentages(newPercentages);
                          } else {
                            newSelected.add(member.device_id);
                            
                            // Redistribute percentages equally among all selected payers
                            const newPercentages = { ...editingPayersPercentages };
                            const allPayers = Array.from(newSelected);
                            const equalPercentage = Math.floor(100 / allPayers.length);
                            allPayers.forEach(id => {
                              newPercentages[id] = equalPercentage;
                            });
                            setEditingPayersPercentages(newPercentages);
                          }
                          setEditingSelectedPayers(newSelected);
                        }}
                      >
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberAvatarText}>
                            {member.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <Text style={[
                          styles.memberName,
                          editingSelectedPayers.has(member.device_id) && styles.memberNameSelected
                        ]}>
                          {member.username}
                        </Text>
                        {editingSelectedPayers.has(member.device_id) && (
                          <View style={styles.percentageContainer}>
                            <Text style={styles.dollarAmountText}>
                              ${editingExpenseAmount && editingPayersPercentages[member.device_id] 
                                ? ((parseFloat(editingExpenseAmount) * editingPayersPercentages[member.device_id]) / 100).toFixed(2)
                                : '0.00'}
                            </Text>
                            <Text style={styles.percentageText}>
                              {editingPayersPercentages[member.device_id] || 0}%
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      
                      {editingSelectedPayers.has(member.device_id) && (
                        <View style={styles.sliderWithLockContainer}>
                          <View style={styles.sliderOnlyContainer}>
                            <Slider
                              style={styles.slider}
                              minimumValue={0}
                              maximumValue={(() => {
                                // Calculate max value based on locked percentages
                                const allPayers = Array.from(editingSelectedPayers);
                                const lockedTotal = allPayers
                                  .filter(id => editingLockedPayersPercentages.has(id))
                                  .reduce((sum, id) => sum + (editingPayersPercentages[id] || 0), 0);
                                const maxAvailable = 100 - lockedTotal;
                                const currentValue = editingPayersPercentages[member.device_id] || 0;
                                return Math.min(100, maxAvailable + currentValue);
                              })()}
                              value={editingPayersPercentages[member.device_id] || 0}
                              onValueChange={(value) => {
                                const allPayers = Array.from(editingSelectedPayers);
                                const unlockedCount = allPayers.filter(id => !editingLockedPayersPercentages.has(id)).length;
                                if (!editingLockedPayersPercentages.has(member.device_id) && unlockedCount > 1) {
                                  // Use the same logic as add expense for payers
                                  const newPercentages = { ...editingPayersPercentages };
                                  const otherPayers = allPayers.filter(id => id !== member.device_id && !editingLockedPayersPercentages.has(id));
                                  
                                  // Set the new percentage for this user
                                  newPercentages[member.device_id] = Math.max(0, Math.min(100, Math.round(value)));
                                  
                                  // Calculate how much percentage is already locked
                                  const lockedTotal = Array.from(editingLockedPayersPercentages).reduce((sum, id) => {
                                    return sum + (newPercentages[id] || 0);
                                  }, 0);
                                  
                                  // Calculate remaining percentage to distribute (excluding locked and current user)
                                  const remaining = 100 - newPercentages[member.device_id] - lockedTotal;
                                  
                                  if (otherPayers.length > 0 && remaining >= 0) {
                                    // Distribute remaining percentage equally among unlocked others
                                    const equalShare = Math.floor(remaining / otherPayers.length);
                                    const remainder = remaining % otherPayers.length;
                                    
                                    otherPayers.forEach((id, index) => {
                                      newPercentages[id] = equalShare + (index < remainder ? 1 : 0);
                                    });
                                  }
                                  
                                  setEditingPayersPercentages(newPercentages);
                                }
                              }}
                              disabled={editingLockedPayersPercentages.has(member.device_id) || Array.from(editingSelectedPayers).filter(id => !editingLockedPayersPercentages.has(id)).length === 1}
                              minimumTrackTintColor={
                                editingLockedPayersPercentages.has(member.device_id) || Array.from(editingSelectedPayers).filter(id => !editingLockedPayersPercentages.has(id)).length === 1 
                                  ? "#6b7280" 
                                  : "#10b981"
                              }
                              maximumTrackTintColor="#3a3a3a"
                              thumbStyle={[
                                styles.sliderThumbStyle,
                                (editingLockedPayersPercentages.has(member.device_id) || Array.from(editingSelectedPayers).filter(id => !editingLockedPayersPercentages.has(id)).length === 1) && styles.sliderThumbLocked
                              ]}
                              trackStyle={styles.sliderTrackStyle}
                            />
                          </View>
                          <View style={styles.lockButtonSquare}>
                            <TouchableOpacity
                              style={[
                                styles.lockButton,
                                editingLockedPayersPercentages.has(member.device_id) && styles.lockButtonActive
                              ]}
                              onPress={() => {
                                const newLocked = new Set(editingLockedPayersPercentages);
                                if (newLocked.has(member.device_id)) {
                                  newLocked.delete(member.device_id);
                                } else {
                                  newLocked.add(member.device_id);
                                }
                                setEditingLockedPayersPercentages(newLocked);
                              }}
                            >
                              <Ionicons 
                                name={editingLockedPayersPercentages.has(member.device_id) ? "lock-closed" : "lock-open"} 
                                size={16} 
                                color={editingLockedPayersPercentages.has(member.device_id) ? "#10b981" : "#9ca3af"} 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>Split Between</Text>
                <View style={styles.memberList}>
                  {validMembers.map(member => (
                    <View key={`edit-ower-${member.device_id}`}>
                      <TouchableOpacity
                        style={[
                          styles.memberOption,
                          editingSelectedOwers.has(member.device_id) && styles.memberOptionSelected
                        ]}
                        onPress={() => {
                          const newSelected = new Set(editingSelectedOwers);
                          if (newSelected.has(member.device_id)) {
                            // Removing user - redistribute their percentage
                            newSelected.delete(member.device_id);
                            const newPercentages = { ...editingOwersPercentages };
                            const removedPercentage = newPercentages[member.device_id] || 0;
                            delete newPercentages[member.device_id];
                            
                            // Remove from locked as well
                            const newLocked = new Set(editingLockedPercentages);
                            newLocked.delete(member.device_id);
                            setEditingLockedPercentages(newLocked);
                            
                            // Redistribute the removed percentage among remaining unlocked users
                            const remainingUsers = Array.from(newSelected);
                            const unlockedUsers = remainingUsers.filter(id => !newLocked.has(id));
                            
                            if (unlockedUsers.length > 0 && removedPercentage > 0) {
                              const redistributePerUser = Math.floor(removedPercentage / unlockedUsers.length);
                              const remainder = removedPercentage % unlockedUsers.length;
                              
                              unlockedUsers.forEach((id, index) => {
                                const additionalPercentage = redistributePerUser + (index < remainder ? 1 : 0);
                                newPercentages[id] = (newPercentages[id] || 0) + additionalPercentage;
                              });
                            }
                            
                            setEditingOwersPercentages(newPercentages);
                          } else {
                            // Adding user
                            newSelected.add(member.device_id);
                            
                            // Calculate even split for all users
                            const totalUsers = newSelected.size;
                            const evenSplit = Math.floor(100 / totalUsers);
                            const remainder = 100 % totalUsers;
                            
                            const newPercentages = { ...editingOwersPercentages };
                            Array.from(newSelected).forEach((id, index) => {
                              newPercentages[id] = evenSplit + (index < remainder ? 1 : 0);
                            });
                            setEditingOwersPercentages(newPercentages);
                          }
                          setEditingSelectedOwers(newSelected);
                        }}
                      >
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberAvatarText}>
                            {member.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <Text style={[
                          styles.memberName,
                          editingSelectedOwers.has(member.device_id) && styles.memberNameSelected
                        ]}>
                          {member.username}
                        </Text>
                        {editingSelectedOwers.has(member.device_id) && (
                          <View style={styles.percentageContainer}>
                            <Text style={styles.dollarAmountText}>
                              ${editingExpenseAmount && editingOwersPercentages[member.device_id] 
                                ? ((parseFloat(editingExpenseAmount) * editingOwersPercentages[member.device_id]) / 100).toFixed(2)
                                : '0.00'}
                            </Text>
                            <Text style={styles.percentageText}>
                              {editingOwersPercentages[member.device_id] || 0}%
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      
                      {editingSelectedOwers.has(member.device_id) && (
                        <View style={styles.sliderWithLockContainer}>
                          <View style={styles.sliderOnlyContainer}>
                            <Slider
                              style={styles.slider}
                              minimumValue={0}
                              maximumValue={(() => {
                                // Calculate max value based on locked percentages
                                const allOwers = Array.from(editingSelectedOwers);
                                const lockedTotal = allOwers
                                  .filter(id => editingLockedPercentages.has(id))
                                  .reduce((sum, id) => sum + (editingOwersPercentages[id] || 0), 0);
                                const maxAvailable = 100 - lockedTotal;
                                const currentValue = editingOwersPercentages[member.device_id] || 0;
                                // Allow current value plus whatever is available
                                return Math.min(100, maxAvailable + currentValue);
                              })()}
                              value={editingOwersPercentages[member.device_id] || 0}
                              onValueChange={(value) => {
                                const allOwers = Array.from(editingSelectedOwers);
                                const unlockedCount = allOwers.filter(id => !editingLockedPercentages.has(id)).length;
                                if (!editingLockedPercentages.has(member.device_id) && unlockedCount > 1) {
                                  // Use the same logic as add expense
                                  const newPercentages = { ...editingOwersPercentages };
                                  const otherOwers = allOwers.filter(id => id !== member.device_id && !editingLockedPercentages.has(id));
                                  
                                  // Set the new percentage for this user
                                  newPercentages[member.device_id] = Math.max(0, Math.min(100, Math.round(value)));
                                  
                                  // Calculate how much percentage is already locked
                                  const lockedTotal = Array.from(editingLockedPercentages).reduce((sum, id) => {
                                    return sum + (newPercentages[id] || 0);
                                  }, 0);
                                  
                                  // Calculate remaining percentage to distribute (excluding locked and current user)
                                  const remaining = 100 - newPercentages[member.device_id] - lockedTotal;
                                  
                                  if (otherOwers.length > 0 && remaining >= 0) {
                                    // Distribute remaining percentage equally among unlocked others
                                    const equalShare = Math.floor(remaining / otherOwers.length);
                                    const remainder = remaining % otherOwers.length;
                                    
                                    otherOwers.forEach((id, index) => {
                                      newPercentages[id] = equalShare + (index < remainder ? 1 : 0);
                                    });
                                  }
                                  
                                  setEditingOwersPercentages(newPercentages);
                                }
                              }}
                              disabled={editingLockedPercentages.has(member.device_id) || Array.from(editingSelectedOwers).filter(id => !editingLockedPercentages.has(id)).length === 1}
                              minimumTrackTintColor={
                                editingLockedPercentages.has(member.device_id) || Array.from(editingSelectedOwers).filter(id => !editingLockedPercentages.has(id)).length === 1 
                                  ? "#6b7280" 
                                  : "#10b981"
                              }
                              maximumTrackTintColor="#3a3a3a"
                              thumbStyle={[
                                styles.sliderThumbStyle,
                                (editingLockedPercentages.has(member.device_id) || Array.from(editingSelectedOwers).filter(id => !editingLockedPercentages.has(id)).length === 1) && styles.sliderThumbLocked
                              ]}
                              trackStyle={styles.sliderTrackStyle}
                            />
                          </View>
                          <View style={styles.lockButtonSquare}>
                            <TouchableOpacity
                              style={[
                                styles.lockButton,
                                editingLockedPercentages.has(member.device_id) && styles.lockButtonActive
                              ]}
                              onPress={() => {
                                const newLocked = new Set(editingLockedPercentages);
                                if (newLocked.has(member.device_id)) {
                                  newLocked.delete(member.device_id);
                                } else {
                                  newLocked.add(member.device_id);
                                }
                                setEditingLockedPercentages(newLocked);
                              }}
                            >
                              <Ionicons 
                                name={editingLockedPercentages.has(member.device_id) ? "lock-closed" : "lock-open"} 
                                size={16} 
                                color={editingLockedPercentages.has(member.device_id) ? "#10b981" : "#9ca3af"} 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowExpenseModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveExpenseEdit}>
                <Text style={styles.modalSaveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// Add Expense Modal Component (matching AddItemModal from checklist)
function AddExpenseModal({
  visible,
  onClose,
  newExpenseDescription,
  setNewExpenseDescription,
  newExpenseAmount,
  setNewExpenseAmount,
  onAddExpense,
  members,
  selectedPayers,
  setSelectedPayers,
  selectedOwers,
  setSelectedOwers,
  owersPercentages,
  setOwersPercentages,
  lockedPercentages,
  setLockedPercentages,
  payersPercentages,
  setPayersPercentages,
  lockedPayersPercentages,
  setLockedPayersPercentages,
  onUpdatePercentage,
  onTogglePercentageLock,
  onUpdatePayerPercentage,
  onTogglePayerPercentageLock,
  onToggleOwer,
  onTogglePayer,
}: {
  visible: boolean;
  onClose: () => void;
  newExpenseDescription: string;
  setNewExpenseDescription: (description: string) => void;
  newExpenseAmount: string;
  setNewExpenseAmount: (amount: string) => void;
  onAddExpense: () => void;
  members: GroupMember[];
  selectedPayers: Set<string>;
  setSelectedPayers: (payers: Set<string>) => void;
  selectedOwers: Set<string>;
  setSelectedOwers: (owers: Set<string>) => void;
  owersPercentages: {[key: string]: number};
  setOwersPercentages: (percentages: {[key: string]: number}) => void;
  lockedPercentages: Set<string>;
  setLockedPercentages: (locked: Set<string>) => void;
  payersPercentages: {[key: string]: number};
  setPayersPercentages: (percentages: {[key: string]: number}) => void;
  lockedPayersPercentages: Set<string>;
  setLockedPayersPercentages: (locked: Set<string>) => void;
  onUpdatePercentage: (deviceId: string, newPercentage: number) => void;
  onTogglePercentageLock: (deviceId: string) => void;
  onUpdatePayerPercentage: (deviceId: string, newPercentage: number) => void;
  onTogglePayerPercentageLock: (deviceId: string) => void;
  onToggleOwer: (deviceId: string) => void;
  onTogglePayer: (deviceId: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalBackButton}>
            <Ionicons name="chevron-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Expense</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Expense Description</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Dinner at restaurant"
              placeholderTextColor="#9ca3af"
              value={newExpenseDescription}
              onChangeText={setNewExpenseDescription}
            />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Total Amount</Text>
            <TextInput
              style={styles.textInput}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              value={newExpenseAmount}
              onChangeText={setNewExpenseAmount}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Who Paid?</Text>
            <View style={styles.memberList}>
              {members.map(member => (
                <View key={`payer-${member.device_id}`}>
                  <TouchableOpacity
                    style={[
                      styles.memberOption,
                      selectedPayers.has(member.device_id) && styles.memberOptionSelected
                    ]}
                    onPress={() => onTogglePayer(member.device_id)}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={[
                      styles.memberName,
                      selectedPayers.has(member.device_id) && styles.memberNameSelected
                    ]}>
                      {member.username}
                    </Text>
                    {selectedPayers.has(member.device_id) && (
                      <View style={styles.percentageContainer}>
                        <Text style={styles.dollarAmountText}>
                          ${((parseFloat(newExpenseAmount || '0') * (payersPercentages[member.device_id] || 0)) / 100).toFixed(2)}
                        </Text>
                        <Text style={styles.percentageText}>
                          {payersPercentages[member.device_id] || 0}%
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  {selectedPayers.has(member.device_id) && (
                    <View style={styles.sliderWithLockContainer}>
                      <View style={styles.sliderOnlyContainer}>
                        <Slider
                          style={styles.slider}
                          minimumValue={0}
                          maximumValue={(() => {
                            // Calculate max value based on locked percentages
                            const allPayers = Array.from(selectedPayers);
                            const lockedTotal = allPayers
                              .filter(id => lockedPayersPercentages.has(id))
                              .reduce((sum, id) => sum + (payersPercentages[id] || 0), 0);
                            const maxAvailable = 100 - lockedTotal;
                            const currentValue = payersPercentages[member.device_id] || 0;
                            // Allow current value plus whatever is available
                            return Math.min(100, maxAvailable + currentValue);
                          })()}
                          value={payersPercentages[member.device_id] || 0}
                          onValueChange={(value) => {
                            const allPayers = Array.from(selectedPayers);
                            const unlockedCount = allPayers.filter(id => !lockedPayersPercentages.has(id)).length;
                            if (!lockedPayersPercentages.has(member.device_id) && unlockedCount > 1) {
                              // Calculate max allowed based on locked percentages
                              const lockedTotal = allPayers
                                .filter(id => lockedPayersPercentages.has(id))
                                .reduce((sum, id) => sum + (payersPercentages[id] || 0), 0);
                              const maxAvailable = 100 - lockedTotal;
                              const constrainedValue = Math.min(Math.round(value), maxAvailable);
                              onUpdatePayerPercentage(member.device_id, constrainedValue);
                            }
                          }}
                          disabled={lockedPayersPercentages.has(member.device_id) || Array.from(selectedPayers).filter(id => !lockedPayersPercentages.has(id)).length === 1}
                          minimumTrackTintColor={
                            lockedPayersPercentages.has(member.device_id) || Array.from(selectedPayers).filter(id => !lockedPayersPercentages.has(id)).length === 1 
                              ? "#6b7280" 
                              : "#10b981"
                          }
                          maximumTrackTintColor="#3a3a3a"
                          thumbStyle={[
                            styles.sliderThumbStyle,
                            (lockedPayersPercentages.has(member.device_id) || Array.from(selectedPayers).filter(id => !lockedPayersPercentages.has(id)).length === 1) && styles.sliderThumbLocked
                          ]}
                          trackStyle={styles.sliderTrackStyle}
                        />
                      </View>
                      <View style={styles.lockButtonSquare}>
                        <TouchableOpacity
                          style={[
                            styles.lockButton,
                            lockedPayersPercentages.has(member.device_id) && styles.lockButtonActive
                          ]}
                          onPress={() => onTogglePayerPercentageLock(member.device_id)}
                        >
                          <Ionicons 
                            name={lockedPayersPercentages.has(member.device_id) ? "lock-closed" : "lock-open"} 
                            size={16} 
                            color={lockedPayersPercentages.has(member.device_id) ? "#10b981" : "#9ca3af"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.inputLabel}>Split Between</Text>
            <View style={styles.memberList}>
              {members.map(member => (
                <View key={`ower-${member.device_id}`}>
                  <TouchableOpacity
                    style={[
                      styles.memberOption,
                      selectedOwers.has(member.device_id) && styles.memberOptionSelected
                    ]}
                    onPress={() => onToggleOwer(member.device_id)}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={[
                      styles.memberName,
                      selectedOwers.has(member.device_id) && styles.memberNameSelected
                    ]}>
                      {member.username}
                    </Text>
                    {selectedOwers.has(member.device_id) && (
                      <View style={styles.percentageContainer}>
                        <Text style={styles.dollarAmountText}>
                          ${((parseFloat(newExpenseAmount || '0') * (owersPercentages[member.device_id] || 0)) / 100).toFixed(2)}
                        </Text>
                        <Text style={styles.percentageText}>
                          {owersPercentages[member.device_id] || 0}%
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  {selectedOwers.has(member.device_id) && (
                    <View style={styles.sliderWithLockContainer}>
                      <View style={styles.sliderOnlyContainer}>
                        <Slider
                          style={styles.slider}
                          minimumValue={0}
                          maximumValue={(() => {
                            // Calculate max value based on locked percentages
                            const allOwers = Array.from(selectedOwers);
                            const lockedTotal = allOwers
                              .filter(id => lockedPercentages.has(id))
                              .reduce((sum, id) => sum + (owersPercentages[id] || 0), 0);
                            const maxAvailable = 100 - lockedTotal;
                            const currentValue = owersPercentages[member.device_id] || 0;
                            // Allow current value plus whatever is available
                            return Math.min(100, maxAvailable + currentValue);
                          })()}
                          value={owersPercentages[member.device_id] || 0}
                          onValueChange={(value) => {
                            const allOwers = Array.from(selectedOwers);
                            const unlockedCount = allOwers.filter(id => !lockedPercentages.has(id)).length;
                            if (!lockedPercentages.has(member.device_id) && unlockedCount > 1) {
                              // Calculate max allowed based on locked percentages
                              const lockedTotal = allOwers
                                .filter(id => lockedPercentages.has(id))
                                .reduce((sum, id) => sum + (owersPercentages[id] || 0), 0);
                              const maxAvailable = 100 - lockedTotal;
                              const constrainedValue = Math.min(Math.round(value), maxAvailable);
                              onUpdatePercentage(member.device_id, constrainedValue);
                            }
                          }}
                          disabled={lockedPercentages.has(member.device_id) || Array.from(selectedOwers).filter(id => !lockedPercentages.has(id)).length === 1}
                          minimumTrackTintColor={
                            lockedPercentages.has(member.device_id) || Array.from(selectedOwers).filter(id => !lockedPercentages.has(id)).length === 1 
                              ? "#6b7280" 
                              : "#10b981"
                          }
                          maximumTrackTintColor="#3a3a3a"
                          thumbStyle={[
                            styles.sliderThumbStyle,
                            (lockedPercentages.has(member.device_id) || Array.from(selectedOwers).filter(id => !lockedPercentages.has(id)).length === 1) && styles.sliderThumbLocked
                          ]}
                          trackStyle={styles.sliderTrackStyle}
                        />
                      </View>
                      <View style={styles.lockButtonSquare}>
                        <TouchableOpacity
                          style={[
                            styles.lockButton,
                            lockedPercentages.has(member.device_id) && styles.lockButtonActive
                          ]}
                          onPress={() => onTogglePercentageLock(member.device_id)}
                        >
                          <Ionicons 
                            name={lockedPercentages.has(member.device_id) ? "lock-closed" : "lock-open"} 
                            size={16} 
                            color={lockedPercentages.has(member.device_id) ? "#10b981" : "#9ca3af"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSaveButton} onPress={onAddExpense}>
            <Text style={styles.modalSaveButtonText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Styles copied and adapted from ChecklistBlock
const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  expenseBlock: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  addExpenseHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  addExpenseHeaderButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  netTotalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'flex-end',
  },
  netTotalTextOwed: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  netTotalTextOwes: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
  netTotalTextSettled: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginBottom: 16,
  },
  expenseContent: {
    minHeight: 120,
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
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  columnHeaderText: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '600',
    textAlign: 'center',
  },
  headerPayersSection: {
    width: 60,
    alignItems: 'center',
  },
  headerOwersSection: {
    width: 60,
    alignItems: 'center',
    marginLeft: 8,
  },
  headerDescriptionSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerAmountSection: {
    width: 60,
    alignItems: 'center',
  },
  headerAddedBySection: {
    width: 50,
    alignItems: 'center',
  },
  headerDeleteSection: {
    width: 24,
  },
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
  payersSection: {
    width: 60,
  },
  owersSection: {
    width: 60,
    marginLeft: 8,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: '#4a4a4a',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    position: 'relative',
  },
  payerAvatar: {
    backgroundColor: '#10b981',
  },
  owerAvatar: {
    backgroundColor: '#ef4444',
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
  descriptionSection: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  amountSection: {
    width: 60,
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
  },
  addedBySection: {
    width: 50,
  },
  addedByText: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  deleteSection: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal Styles (copied from checklist)
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBackButton: {
    padding: 8,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  modalHeaderSpacer: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
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
  memberList: {
    gap: 12,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  memberOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  memberName: {
    fontSize: 14,
    color: '#e5e7eb',
    flex: 1,
  },
  memberNameSelected: {
    color: '#ffffff',
    fontWeight: '500',
  },
  percentageText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  sliderFullWidthContainer: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sliderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabels: {
    flex: 1,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  dollarAmount: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '400',
  },
  slider: {
    width: '100%',
    height: 20,
  },
  sliderThumbStyle: {
    backgroundColor: '#10b981',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  sliderTrackStyle: {
    height: 6,
    borderRadius: 3,
  },
  calculatedAmountText: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  lockButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  lockButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
  },
  sliderThumbLocked: {
    backgroundColor: '#6b7280',
  },
  sliderInfo: {
    marginBottom: 16,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  sliderPercentage: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  sliderContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  sliderAmountText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    marginBottom: 8,
  },
  sliderWithLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dollarAmountText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  sliderWithLockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  sliderOnlyContainer: {
    flex: 1,
    height: 40,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockButtonSquare: {
    width: 40,
    height: 40,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  viewAllButtonText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '500',
    marginLeft: 6,
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderStyle: 'dashed',
  },
  addExpenseButtonText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
    marginLeft: 8,
  },
  expenseDetailText: {
    fontSize: 16,
    color: '#ffffff',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  expenseDetailAmount: {
    fontSize: 20,
    color: '#10b981',
    fontWeight: '600',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  participantDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 12,
  },
  participantRole: {
    alignItems: 'flex-end',
  },
  participantRoleText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  payerAvatar: {
    backgroundColor: '#10b981',
  },
  owerAvatar: {
    backgroundColor: '#ef4444',
  },
  createdByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  createdByText: {
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 12,
    flex: 1,
  },
  createdDateText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  youOweText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '500',
    marginTop: 2,
  },
  owesYouText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '500',
    marginTop: 2,
  },
  splitDetailsContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  splitDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  splitDetailLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  splitDetailValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  // New Expense Block Styles
  expenseItemContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventNameRow: {
    marginTop: -4,
    marginBottom: 8,
  },
  eventNameText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '400',
  },
  titleRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButtonTitleRow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBreak: {
    height: 1,
    backgroundColor: '#3a3a3a',
    marginBottom: 8,
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  participantsColumn: {
    flex: 1,
    marginRight: 16,
  },
  owersWithButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  owersLabelAndAvatars: {
    flex: 1,
  },
  paymentButtonColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentStatusButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  paymentStatusButtonCompleted: {
    backgroundColor: '#f59e0b',
  },
  paymentStatusButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  paymentStatusButtonTextCompleted: {
    color: '#ffffff',
  },
  amountColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 100,
  },
  bottomInfoRow: {
    alignItems: 'center',
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    textAlign: 'right',
    marginBottom: 4,
  },
  userAmountContainer: {
    alignItems: 'flex-end',
  },
  userAmountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  userStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  userOwesText: {
    color: '#ef4444',
  },
  userOwedText: {
    color: '#10b981',
  },
  userEvenText: {
    color: '#9ca3af',
  },
  userPercentageText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  addedByNewSection: {
    alignItems: 'flex-end',
  },
  addedByNewText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  deleteNewSection: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
  },
  participantsSection: {
    marginBottom: 8,
  },
  participantLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 6,
  },
  participantAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseItemNew: {
    width: '100%',
    marginBottom: 0,
  },
  participantsListColumn: {
    flex: 1,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  payerAvatar: {
    backgroundColor: '#10b981',
  },
  owerAvatar: {
    backgroundColor: '#ef4444',
  },
  participantAvatarText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
  },
  participantName: {
    fontSize: 11,
    color: '#e5e7eb',
    fontWeight: '500',
    marginRight: 8,
    minWidth: 60,
  },
  participantAmount: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    flex: 1,
  },
  headerUserAmountContainer: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerUserStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerUserPercentageText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  // New UI Layout Styles
  totalAmountTopRight: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    textAlign: 'right',
  },
  contentRowNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  userOwesContainer: {
    flex: 1,
  },
  userDebtText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  userOwesText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  userOwedText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  deleteButtonBottomLeft: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});