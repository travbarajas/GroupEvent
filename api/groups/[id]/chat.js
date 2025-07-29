const { neon } = require('@neondatabase/serverless');
const { createClient } = require('@supabase/supabase-js');

const sql = neon(process.env.DATABASE_URL);

// Initialize Supabase client for realtime broadcasting
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'POST') {
    try {
      const { id: groupId } = req.query;
      const { message, device_id } = req.body;
      
      console.log('POST /chat - groupId:', groupId, 'device_id:', device_id);
      
      if (!message || !device_id) {
        return res.status(400).json({ error: 'message and device_id are required' });
      }

      // Verify user is member of this group
      const membershipResult = await sql`
        SELECT m.username, m.color 
        FROM members m 
        WHERE m.group_id = ${groupId} AND m.device_id = ${device_id}
      `;

      console.log('Membership check result:', membershipResult);
      
      if (!membershipResult || membershipResult.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }
      
      const membership = membershipResult[0];

      // Create group_chats table if it doesn't exist
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS group_chats (
            id VARCHAR(255) PRIMARY KEY,
            group_id VARCHAR(255) NOT NULL,
            device_id VARCHAR(255) NOT NULL,
            username VARCHAR(255),
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
          )
        `;
      } catch (error) {
        console.log('Table creation error:', error.message);
      }

      // Save message to database
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const [savedMessage] = await sql`
        INSERT INTO group_chats (id, group_id, device_id, username, message)
        VALUES (${messageId}, ${groupId}, ${device_id}, ${membership.username || 'Unknown'}, ${message})
        RETURNING *
      `;

      const messageData = {
        id: savedMessage.id,
        message: savedMessage.message,
        username: savedMessage.username,
        device_id: savedMessage.device_id,
        userColor: membership.color || '#60a5fa',
        timestamp: savedMessage.created_at
      };

      // Broadcast message via Supabase Realtime
      if (supabase) {
        try {
          const channelName = `group-${groupId}`;
          const channel = supabase.channel(channelName);
          
          await channel.send({
            type: 'broadcast',
            event: 'new-message',
            payload: messageData,
          });
          
          console.log('Message broadcasted via Supabase to channel:', channelName);
        } catch (supabaseError) {
          console.error('Failed to broadcast via Supabase:', supabaseError);
          // Don't fail the entire request if Supabase is down
        }
      }

      return res.status(201).json({
        success: true,
        message: messageData
      });

    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { id: groupId } = req.query;
      const { device_id, lastMessageId, limit = '50' } = req.query;

      console.log('GET /chat - groupId:', groupId, 'device_id:', device_id, 'lastMessageId:', lastMessageId);

      if (!device_id) {
        return res.status(400).json({ error: 'device_id is required' });
      }

      // Verify user is member of this group
      const membershipResult = await sql`
        SELECT 1 FROM members WHERE group_id = ${groupId} AND device_id = ${device_id}
      `;

      console.log('GET Membership check result:', membershipResult);

      if (!membershipResult || membershipResult.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Get messages newer than lastMessageId if provided, otherwise get recent messages
      try {
        let messages;
        const messageLimit = Math.min(parseInt(limit), 100); // Cap at 100 messages

        if (lastMessageId) {
          // Get messages newer than the last seen message
          messages = await sql`
            SELECT c.*, m.color as user_color
            FROM group_chats c
            LEFT JOIN members m ON c.device_id = m.device_id AND m.group_id = ${groupId}
            WHERE c.group_id = ${groupId} 
              AND c.created_at > (
                SELECT created_at FROM group_chats WHERE id = ${lastMessageId}
              )
            ORDER BY c.created_at ASC
            LIMIT ${messageLimit}
          `;
        } else {
          // Get initial batch of recent messages
          messages = await sql`
            SELECT c.*, m.color as user_color
            FROM group_chats c
            LEFT JOIN members m ON c.device_id = m.device_id AND m.group_id = ${groupId}
            WHERE c.group_id = ${groupId}
            ORDER BY c.created_at DESC
            LIMIT ${messageLimit}
          `;
          
          // Reverse to show oldest first for initial load
          messages = messages.reverse();
        }

        // Format messages for frontend
        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          message: msg.message,
          username: msg.username,
          device_id: msg.device_id,
          userColor: msg.user_color || '#60a5fa',
          timestamp: msg.created_at
        }));

        return res.status(200).json({
          messages: formattedMessages,
          hasMore: messages.length === messageLimit
        });
      } catch (error) {
        // Table doesn't exist yet, return empty messages
        return res.status(200).json({ 
          messages: [],
          hasMore: false 
        });
      }

    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};