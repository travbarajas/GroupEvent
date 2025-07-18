import { sql } from '@/lib/db';

interface Group {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  try {
    const groups = await sql`SELECT * FROM groups ORDER BY created_at DESC`;
    return Response.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return Response.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, description } = await request.json();
    
    if (!name || name.trim().length === 0) {
      return Response.json({ error: 'Group name is required' }, { status: 400 });
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

    return Response.json({ 
      ...group, 
      invite_code: inviteCode 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating group:', error);
    return Response.json({ error: 'Failed to create group' }, { status: 500 });
  }
}