import { sql } from '../lib/db';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const groups = await sql`SELECT * FROM groups ORDER BY created_at DESC`;
      return res.status(200).json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description } = req.body;
      
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Group name is required' });
      }

      const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Create group
      const [group] = await sql`
        INSERT INTO groups (id, name, description)
        VALUES (${groupId}, ${name.trim()}, ${description || null})
        RETURNING *
      `;

      // Create default invite
      await sql`
        INSERT INTO invites (id, group_id, invite_code, created_by)
        VALUES (${`invite_${Date.now()}`}, ${groupId}, ${inviteCode}, 'creator')
      `;

      return res.status(201).json({ 
        ...group, 
        invite_code: inviteCode 
      });
    } catch (error) {
      console.error('Error creating group:', error);
      return res.status(500).json({ error: 'Failed to create group' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}