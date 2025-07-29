import { useState, useEffect, useRef, useCallback } from 'react';
import PartySocket from 'partysocket';
import { DeviceIdManager } from '../utils/deviceId';

interface Message {
  id: string;
  message: string;
  username: string;
  device_id: string;
  userColor: string;
  timestamp: string;
  type: 'message' | 'typing' | 'user_joined' | 'user_left';
}

interface TypingUser {
  device_id: string;
  username: string;
  isTyping: boolean;
}

interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isConnecting: boolean;
  typingUsers: TypingUser[];
  error: string | null;
}

interface UseChatOptions {
  roomType: 'group' | 'event';
  roomId: string;
  enabled?: boolean;
}

export function useChat({ roomType, roomId, enabled = true }: UseChatOptions) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isConnected: false,
    isConnecting: false,
    typingUsers: [],
    error: null,
  });

  const socketRef = useRef<PartySocket | null>(null);
  const mountedRef = useRef(true);
  const deviceIdRef = useRef<string>('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize chat connection
  const initializeChat = useCallback(async () => {
    if (!enabled || !roomId) return;

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));

      // Get device ID
      const deviceId = await DeviceIdManager.getDeviceId();
      deviceIdRef.current = deviceId;

      // Get PartyKit token
      const tokenResponse = await fetch('https://group-event.vercel.app/api/partykit/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: deviceId,
          room_type: roomType,
          room_id: roomId,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get PartyKit token');
      }

      const tokenData = await tokenResponse.json();

      // Connect to PartyKit
      const partyKitHost = process.env.EXPO_PUBLIC_PARTYKIT_HOST || 'groupevent-chat.travbarajas.partykit.dev';
      const roomName = `${roomType}-${roomId}`;

      const socket = new PartySocket({
        host: partyKitHost,
        room: roomName,
        query: {
          device_id: deviceId,
          username: tokenData.user.username,
          userColor: tokenData.user.userColor,
          token: tokenData.token,
        },
      });

      socket.addEventListener('open', () => {
        if (mountedRef.current) {
          setState(prev => ({ 
            ...prev, 
            isConnected: true, 
            isConnecting: false,
            error: null 
          }));
        }
      });

      socket.addEventListener('message', (event) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message' || data.type === 'user_joined' || data.type === 'user_left') {
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, data],
            }));
          } else if (data.type === 'typing') {
            setState(prev => {
              const newTypingUsers = prev.typingUsers.filter(
                user => user.device_id !== data.device_id
              );
              
              if (data.isTyping) {
                newTypingUsers.push({
                  device_id: data.device_id,
                  username: data.username,
                  isTyping: true,
                });
              }
              
              return {
                ...prev,
                typingUsers: newTypingUsers,
              };
            });
          }
        } catch (error) {
          console.error('Error parsing PartyKit message:', error);
        }
      });

      socket.addEventListener('error', (error) => {
        if (mountedRef.current) {
          setState(prev => ({ 
            ...prev, 
            error: 'Connection error',
            isConnecting: false 
          }));
        }
      });

      socket.addEventListener('close', () => {
        if (mountedRef.current) {
          setState(prev => ({ 
            ...prev, 
            isConnected: false,
            isConnecting: false 
          }));
        }
      });

      socketRef.current = socket;

      // Fetch initial message history from database
      await fetchMessageHistory(deviceId);

    } catch (error) {
      console.error('Failed to initialize chat:', error);
      if (mountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Connection failed',
          isConnecting: false 
        }));
      }
    }
  }, [roomType, roomId, enabled]);

  // Fetch message history from database
  const fetchMessageHistory = async (deviceId: string) => {
    try {
      const response = await fetch(
        `https://group-event.vercel.app/api/groups/${roomId}/chat?device_id=${deviceId}&limit=50`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (mountedRef.current && data.messages) {
          setState(prev => ({
            ...prev,
            messages: data.messages,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch message history:', error);
    }
  };

  // Send message
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || !socketRef.current || !state.isConnected) {
      return false;
    }

    try {
      // Send to database via API (which will also notify PartyKit)
      const response = await fetch(`https://group-event.vercel.app/api/groups/${roomId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          device_id: deviceIdRef.current,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }, [roomId, state.isConnected]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!socketRef.current || !state.isConnected) return;

    socketRef.current.send(JSON.stringify({
      type: 'typing',
      isTyping,
    }));

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 3000);
    }
  }, [state.isConnected]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Initialize when enabled/roomId changes
  useEffect(() => {
    if (enabled && roomId) {
      initializeChat();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [enabled, roomId, initializeChat]);

  return {
    ...state,
    sendMessage,
    sendTyping,
    reconnect: initializeChat,
  };
}