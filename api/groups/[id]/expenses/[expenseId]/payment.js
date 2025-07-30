const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'PUT') {
    try {
      const { id: groupId, expenseId } = req.query;
      const { device_id, participant_id, payment_status } = req.body;
      
      if (!device_id || !participant_id || !payment_status) {
        return res.status(400).json({ error: 'device_id, participant_id, and payment_status are required' });
      }

      if (!['pending', 'sent', 'completed'].includes(payment_status)) {
        return res.status(400).json({ error: 'Invalid payment_status' });
      }

      // Check if user is a member of this group
      const [membership] = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Check if expense exists and belongs to this group
      const [expense] = await sql`
        SELECT 1 FROM group_expenses WHERE id = ${expenseId} AND group_id = ${groupId}
      `;

      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      // Update payment status
      const [updatedParticipant] = await sql`
        UPDATE expense_participants 
        SET payment_status = ${payment_status}, updated_at = NOW()
        WHERE expense_id = ${expenseId} AND member_device_id = ${participant_id} AND role = 'ower'
        RETURNING *
      `;

      if (!updatedParticipant) {
        return res.status(404).json({ error: 'Participant not found or not an ower' });
      }
      
      return res.status(200).json({ success: true, participant: updatedParticipant });

    } catch (error) {
      console.error('Error updating payment status:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};