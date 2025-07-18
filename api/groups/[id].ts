import { sql } from '../lib/db';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const { id } = req.query;

      // Get group with its invite code
      const [group] = await sql`
        SELECT g.*, i.invite_code
        FROM groups g
        LEFT JOIN invites i ON g.id = i.group_id
        WHERE g.id = ${id as string}
        LIMIT 1
      `;

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      return res.status(200).json(group);
    } catch (error) {
      console.error('Error fetching group:', error);
      return res.status(500).json({ error: 'Failed to fetch group' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}