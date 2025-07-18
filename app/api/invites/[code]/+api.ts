import { sql } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  try {
    const { code } = params;

    // Find invite and associated group
    const [invite] = await sql`
      SELECT i.*, g.name as group_name, g.description as group_description, g.member_count
      FROM invites i
      JOIN groups g ON i.group_id = g.id
      WHERE i.invite_code = ${code}
    `;

    if (!invite) {
      return Response.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Check if invite is expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return Response.json({ error: 'Invite has expired' }, { status: 410 });
    }

    // Check if invite has reached max uses
    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      return Response.json({ error: 'Invite has reached maximum uses' }, { status: 410 });
    }

    return Response.json({
      group_id: invite.group_id,
      group_name: invite.group_name,
      group_description: invite.group_description,
      member_count: invite.member_count,
      invite_id: invite.id
    });
  } catch (error) {
    console.error('Error processing invite:', error);
    return Response.json({ error: 'Failed to process invite' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { code: string } }) {
  try {
    const { code } = params;

    // Find and validate invite
    const [invite] = await sql`
      SELECT i.*, g.id as group_id
      FROM invites i
      JOIN groups g ON i.group_id = g.id
      WHERE i.invite_code = ${code}
    `;

    if (!invite) {
      return Response.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Update invite usage count
    await sql`
      UPDATE invites 
      SET uses_count = uses_count + 1 
      WHERE id = ${invite.id}
    `;

    // Update group member count
    await sql`
      UPDATE groups 
      SET member_count = member_count + 1 
      WHERE id = ${invite.group_id}
    `;

    return Response.json({ 
      success: true, 
      group_id: invite.group_id,
      message: 'Successfully joined group'
    });
  } catch (error) {
    console.error('Error joining group:', error);
    return Response.json({ error: 'Failed to join group' }, { status: 500 });
  }
}