import type * as Party from "partykit/server";

interface Message {
  id: string;
  message: string;
  username: string;
  device_id: string;
  userColor: string;
  timestamp: string;
  type: 'message' | 'typing' | 'user_joined' | 'user_left';
}

interface ConnectionInfo {
  device_id: string;
  username: string;
  userColor: string;
  room_type: 'group' | 'event';
  room_id: string;
}

export default class ChatServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Extract room info from room ID (format: "group-123" or "event-456")
    const roomId = this.room.id;
    const [roomType, roomIdNum] = roomId.split('-');
    
    if (!roomType || !roomIdNum || !['group', 'event'].includes(roomType)) {
      conn.close(1008, 'Invalid room format');
      return;
    }

    console.log(`New connection to ${roomType}-${roomIdNum}`);

    // Get connection info from query params
    const url = new URL(ctx.request.url);
    const device_id = url.searchParams.get('device_id');
    const username = url.searchParams.get('username');
    const userColor = url.searchParams.get('userColor');
    const token = url.searchParams.get('token');

    if (!device_id || !token) {
      conn.close(1008, 'Missing authentication');
      return;
    }

    // Verify token by calling your Vercel API
    try {
      const verifyResponse = await fetch(`${process.env.VERCEL_URL || 'https://group-event.vercel.app'}/api/partykit/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          device_id,
          room_type: roomType,
          room_id: roomIdNum,
        }),
      });

      if (!verifyResponse.ok) {
        conn.close(1008, 'Authentication failed');
        return;
      }

      const verifyData = await verifyResponse.json();
      if (!verifyData.valid) {
        conn.close(1008, 'Invalid token or permissions');
        return;
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      conn.close(1008, 'Authentication error');
      return;
    }

    // Store connection info
    const connectionInfo: ConnectionInfo = {
      device_id: device_id,
      username: username || 'Anonymous',
      userColor: userColor || '#60a5fa',
      room_type: roomType as 'group' | 'event',
      room_id: roomIdNum,
    };

    // Store in connection tags for easy access
    conn.setState(connectionInfo);

    // Notify other users that someone joined
    const joinMessage: Message = {
      id: `join_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      message: `${connectionInfo.username} joined the chat`,
      username: 'System',
      device_id: 'system',
      userColor: '#9ca3af',
      timestamp: new Date().toISOString(),
      type: 'user_joined',
    };

    this.room.broadcast(JSON.stringify(joinMessage), [conn.id]);
  }

  async onMessage(message: string, sender: Party.Connection) {
    const connectionInfo = sender.state as ConnectionInfo;
    
    if (!connectionInfo) {
      sender.close(1008, 'Invalid connection state');
      return;
    }

    try {
      const data = JSON.parse(message);
      
      if (data.type === 'typing') {
        // Broadcast typing indicator to others (not back to sender)
        const typingMessage = {
          type: 'typing',
          device_id: connectionInfo.device_id,
          username: connectionInfo.username,
          isTyping: data.isTyping,
          timestamp: new Date().toISOString(),
        };
        
        this.room.broadcast(JSON.stringify(typingMessage), [sender.id]);
        return;
      }

      if (data.type === 'message') {
        // This is a chat message - it should already be saved to the database
        // by your Vercel API, so we just broadcast it to all connected clients
        const chatMessage: Message = {
          id: data.id,
          message: data.message,
          username: connectionInfo.username,
          device_id: connectionInfo.device_id,
          userColor: connectionInfo.userColor,
          timestamp: data.timestamp,
          type: 'message',
        };

        // Broadcast to all connections in the room
        this.room.broadcast(JSON.stringify(chatMessage));
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
      }));
    }
  }

  async onClose(connection: Party.Connection) {
    const connectionInfo = connection.state as ConnectionInfo;
    
    if (connectionInfo) {
      // Notify other users that someone left
      const leaveMessage: Message = {
        id: `leave_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        message: `${connectionInfo.username} left the chat`,
        username: 'System',
        device_id: 'system',
        userColor: '#9ca3af',
        timestamp: new Date().toISOString(),
        type: 'user_left',
      };

      this.room.broadcast(JSON.stringify(leaveMessage));
    }
  }

  async onError(connection: Party.Connection, error: Error) {
    console.error('PartyKit connection error:', error);
  }
}

ChatServer satisfies Party.Worker;