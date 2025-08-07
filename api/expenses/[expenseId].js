const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { expenseId } = req.query;
  
  if (req.method === 'PUT') {
    try {
      const { description, total_amount, participants } = req.body;
      
      if (!description || !total_amount || !participants || participants.length === 0) {
        return res.status(400).json({ error: 'description, total_amount, and participants are required' });
      }

      // Start transaction
      await sql`BEGIN`;
      
      try {
        // Update main expense
        const [updatedExpense] = await sql`
          UPDATE group_expenses 
          SET description = ${description}, total_amount = ${total_amount}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${expenseId}
          RETURNING *
        `;

        if (!updatedExpense) {
          await sql`ROLLBACK`;
          return res.status(404).json({ error: 'Expense not found' });
        }

        // Delete existing participants
        await sql`
          DELETE FROM expense_participants WHERE expense_id = ${expenseId}
        `;

        // Insert updated participants
        for (const participant of participants) {
          await sql`
            INSERT INTO expense_participants (id, expense_id, member_device_id, role, individual_amount, payment_status)
            VALUES (gen_random_uuid(), ${expenseId}, ${participant.member_device_id}, ${participant.role}, ${participant.individual_amount}, ${participant.payment_status || 'pending'})
          `;
        }

        await sql`COMMIT`;
        
        return res.status(200).json({ 
          success: true, 
          message: 'Expense updated successfully' 
        });
      } catch (transactionError) {
        await sql`ROLLBACK`;
        throw transactionError;
      }

    } catch (error) {
      console.error('Error updating expense:', error);
      return res.status(500).json({ 
        error: 'Failed to update expense',
        details: error.message 
      });
    }
  }
  
  if (req.method === 'DELETE') {
    try {
      // Start transaction
      await sql`BEGIN`;
      
      try {
        // Check if expense exists
        const [expense] = await sql`
          SELECT * FROM group_expenses WHERE id = ${expenseId}
        `;

        if (!expense) {
          await sql`ROLLBACK`;
          return res.status(404).json({ error: 'Expense not found' });
        }

        // Delete participants first (foreign key constraint)
        await sql`
          DELETE FROM expense_participants WHERE expense_id = ${expenseId}
        `;

        // Delete expense
        await sql`
          DELETE FROM group_expenses WHERE id = ${expenseId}
        `;

        await sql`COMMIT`;
        
        return res.status(200).json({ 
          success: true, 
          message: 'Expense deleted successfully' 
        });
      } catch (transactionError) {
        await sql`ROLLBACK`;
        throw transactionError;
      }

    } catch (error) {
      console.error('Error deleting expense:', error);
      return res.status(500).json({ 
        error: 'Failed to delete expense',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};