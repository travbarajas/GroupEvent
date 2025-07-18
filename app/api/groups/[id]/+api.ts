import { sql } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Get group with its invite code
    const [group] = await sql`
      SELECT g.*, i.invite_code
      FROM groups g
      LEFT JOIN invites i ON g.id = i.group_id
      WHERE g.id = ${id}
      LIMIT 1
    `;

    if (!group) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    return Response.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    return Response.json({ error: 'Failed to fetch group' }, { status: 500 });
  }
}