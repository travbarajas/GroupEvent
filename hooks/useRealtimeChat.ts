import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, getGroupChannelName, getEventChannelName } from '../lib/supabase';
import { DeviceIdManager } from '../utils/deviceId';

interface Message {
  id: string;
  message: string;
  username: string;
  device_id: string;
  userColor: string;
  timestamp: string;
}

interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseRealtimeChatOptions {
  roomType: 'group' | 'event';
  roomId: string;
  enabled?: boolean;
}

export function useRealtimeChat({ roomType, roomId, enabled = true }: UseRealtimeChatOptions) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isConnected: false,
    isLoading: false,
    error: null,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);
  const deviceIdRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Get channel name based on room type
  const channelName = roomType === 'group' 
    ? getGroupChannelName(roomId) 
    : getEventChannelName(roomId);

  // Fetch message history from Neon database
  const fetchMessageHistory = useCallback(async (deviceId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const endpoint = roomType === 'group' 
        ? `https://group-event.vercel.app/api/groups/${roomId}/chat`
        : `https://group-event.vercel.app/api/events/${roomId}/messages`;

      const response = await fetch(
        `${endpoint}?device_id=${deviceId}&limit=50`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (mountedRef.current && data.messages) {
          setState(prev => ({
            ...prev,
            messages: data.messages,
            isLoading: false,
            error: null,
          }));
        }
      } else {
        throw new Error('Failed to fetch message history');
      }
    } catch (error) {
      console.error('Failed to fetch message history:', error);
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: 'Failed to load messages',
          isLoading: false,
        }));
      }
    }
  }, [roomType, roomId]);

  // Auto-reconnect when there's an error
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && enabled && roomId) {
        // Auto-reconnecting chat
        initializeConnection();
      }
    }, 5000); // Retry every 5 seconds
  }, [enabled, roomId]);

  // Initialize realtime connection
  const initializeConnection = useCallback(async () => {
    if (!enabled || !roomId) return;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      // Get device ID
      const deviceId = await DeviceIdManager.getDeviceId();
      deviceIdRef.current = deviceId;

      // Fetch initial message history
      await fetchMessageHistory(deviceId);

      // Create Supabase realtime channel
      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false }, // Don't receive our own messages
        },
      });

      // Listen for new messages
      channel.on('broadcast', { event: 'new-message' }, (payload) => {
        if (!mountedRef.current) return;

        const newMessage = payload.payload as Message;
        
        // Don't add our own messages (they're already added optimistically)
        if (newMessage.device_id === deviceIdRef.current) return;

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, newMessage],
        }));
      });

      // Handle connection status changes
      channel.on('system', {}, (payload) => {
        if (!mountedRef.current) return;

        if (payload.event === 'SYSTEM' && payload.status === 'ok') {
          setState(prev => ({ ...prev, isConnected: true, error: null }));
        }
      });

      // Subscribe to channel
      const subscription = await channel.subscribe((status) => {
        if (!mountedRef.current) return;

        // Realtime connection status updated
        
        if (status === 'SUBSCRIBED') {
          setState(prev => ({ ...prev, isConnected: true, error: null }));
        } else if (status === 'CHANNEL_ERROR') {
          setState(prev => ({ 
            ...prev, 
            isConnected: false, 
            error: 'Connection error' 
          }));
          scheduleReconnect(); // Auto-reconnect on error
        } else if (status === 'TIMED_OUT') {
          setState(prev => ({ 
            ...prev, 
            isConnected: false, 
            error: 'Connection timed out' 
          }));
          scheduleReconnect(); // Auto-reconnect on timeout
        }
      });

      channelRef.current = channel;

    } catch (error) {
      console.error('Failed to initialize realtime connection:', error);
      if (mountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Connection failed',
          isConnected: false,
          isLoading: false 
        }));
        scheduleReconnect(); // Auto-reconnect on initialization error
      }
    }
  }, [enabled, roomId, channelName, fetchMessageHistory, scheduleReconnect]);

  // Send message function
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || !deviceIdRef.current) {
      return false;
    }

    try {
      // Send to API endpoint (which will save to Neon and broadcast via Supabase)
      const endpoint = roomType === 'group' 
        ? `https://group-event.vercel.app/api/groups/${roomId}/chat`
        : `https://group-event.vercel.app/api/events/${roomId}/messages`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          device_id: deviceIdRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Optimistically add our own message to the UI
        if (data.message && mountedRef.current) {
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, data.message],
          }));
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }, [roomType, roomId]);

  // Reconnect function
  const reconnect = useCallback(async () => {
    // Clean up existing connection
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    // Reinitialize
    await initializeConnection();
  }, [initializeConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Initialize connection when parameters change
  useEffect(() => {
    if (enabled && roomId) {
      initializeConnection();
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, roomId, initializeConnection]);

  // Handle app state changes (foreground/background) - simple reconnect for short backgrounds
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      // Chat - App state changed
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - checking chat connection
        
        // Simple reconnect check for short backgrounds (page-level refresh handles long ones)
        if (enabled && roomId && mountedRef.current) {
          setTimeout(() => {
            if (mountedRef.current && !state.isConnected) {
              // Chat appears disconnected - attempting simple reconnect
              initializeConnection();
            }
          }, 1000);
        }
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [enabled, roomId, initializeConnection, state.isConnected]);

  return {
    messages: state.messages,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    reconnect,
    refresh: () => deviceIdRef.current && fetchMessageHistory(deviceIdRef.current),
  };
}