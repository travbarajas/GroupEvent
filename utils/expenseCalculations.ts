export interface ExpenseParticipant {
  member_device_id: string;
  role: 'payer' | 'ower';
  individual_amount: number;
  payment_status: 'pending' | 'sent' | 'completed';
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  total_amount: number;
  created_by_device_id: string;
  created_at: string;
  updated_at: string;
  participants: ExpenseParticipant[];
}

export interface DebtDetail {
  expenseId: string;
  expenseName: string;
  fromUser?: string;
  toUser?: string;
  amount: number;
}

export interface UserBalance {
  netBalance: number;
  totalOwed: number;
  totalOwing: number;
  detailedDebts: DebtDetail[];
  detailedCredits: DebtDetail[];
}

export interface SimplifiedDebt {
  from: string;
  to: string;
  amount: number;
}

export const calculateUserBalances = (expenses: Expense[], userId: string): UserBalance => {
  let totalOwed = 0;
  let totalOwing = 0;
  const detailedDebts: DebtDetail[] = [];
  const detailedCredits: DebtDetail[] = [];
  
  expenses.forEach(expense => {
    const userPaidAmount = expense.participants
      .filter(p => p.role === 'payer' && p.member_device_id === userId)
      .reduce((sum, p) => sum + parseFloat(p.individual_amount.toString()), 0);
    
    const userOwesAmount = expense.participants
      .filter(p => p.role === 'ower' && p.member_device_id === userId)
      .reduce((sum, p) => sum + parseFloat(p.individual_amount.toString()), 0);
    
    if (userPaidAmount > 0) {
      // User paid, calculate who owes them
      const totalPaid = expense.participants
        .filter(p => p.role === 'payer')
        .reduce((sum, p) => sum + parseFloat(p.individual_amount.toString()), 0);
      
      const payerShare = userPaidAmount / totalPaid;
      
      expense.participants
        .filter(p => p.role === 'ower')
        .forEach(ower => {
          const owedAmount = parseFloat(ower.individual_amount.toString()) * payerShare;
          totalOwed += owedAmount;
          detailedCredits.push({
            expenseId: expense.id,
            expenseName: expense.description,
            fromUser: ower.member_device_id,
            amount: owedAmount
          });
        });
    }
    
    if (userOwesAmount > 0) {
      // User owes, calculate who they owe
      const totalOwedAmount = expense.participants
        .filter(p => p.role === 'ower')
        .reduce((sum, p) => sum + parseFloat(p.individual_amount.toString()), 0);
      
      const owerShare = userOwesAmount / totalOwedAmount;
      
      expense.participants
        .filter(p => p.role === 'payer')
        .forEach(payer => {
          const owingAmount = parseFloat(payer.individual_amount.toString()) * owerShare;
          totalOwing += owingAmount;
          detailedDebts.push({
            expenseId: expense.id,
            expenseName: expense.description,
            toUser: payer.member_device_id,
            amount: owingAmount
          });
        });
    }
  });
  
  return {
    netBalance: totalOwed - totalOwing,
    totalOwed,
    totalOwing,
    detailedDebts,
    detailedCredits
  };
};

export const simplifyDebts = (debts: DebtDetail[], credits: DebtDetail[]): SimplifiedDebt[] => {
  // Create a net balance map for each user pair
  const netBalances: { [key: string]: number } = {};
  
  debts.forEach(debt => {
    if (debt.toUser) {
      const key = `${debt.fromUser}-${debt.toUser}`;
      netBalances[key] = (netBalances[key] || 0) - debt.amount;
    }
  });
  
  credits.forEach(credit => {
    if (credit.fromUser) {
      const key = `${credit.fromUser}-${credit.toUser}`;
      netBalances[key] = (netBalances[key] || 0) + credit.amount;
    }
  });
  
  // Convert to simplified list
  const simplified: SimplifiedDebt[] = [];
  Object.entries(netBalances).forEach(([key, amount]) => {
    if (Math.abs(amount) > 0.01) { // Ignore tiny amounts
      const [user1, user2] = key.split('-');
      simplified.push({
        from: amount < 0 ? user1 : user2,
        to: amount < 0 ? user2 : user1,
        amount: Math.abs(amount)
      });
    }
  });
  
  return simplified;
};

// Helper functions for component logic
export const roundToTwo = (num: number): number => Math.round(num * 100) / 100;

export const validatePercentages = (splits: { [key: string]: number }): boolean => {
  const sum = Object.values(splits).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 100) < 0.01; // Allow tiny rounding errors
};