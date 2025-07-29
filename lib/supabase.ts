import { createClient } from '@supabase/supabase-js';

// Supabase client configuration - ONLY for realtime features
// All data storage remains in Neon database

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file');
}

// Create Supabase client with realtime-only configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  auth: {
    // We're not using Supabase auth, disable auto-refresh
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    // We're not using Supabase database, only realtime
    schema: 'public',
  },
});

// Channel name helpers
export const getGroupChannelName = (groupId: string) => `group-${groupId}`;
export const getEventChannelName = (eventId: string) => `event-${eventId}`;

// Message broadcast helpers
export const broadcastMessage = async (channelName: string, message: any) => {
  try {
    const channel = supabase.channel(channelName);
    await channel.send({
      type: 'broadcast',
      event: 'new-message',
      payload: message,
    });
    return true;
  } catch (error) {
    console.error('Failed to broadcast message:', error);
    return false;
  }
};

// Connection status helper
export const getRealtimeStatus = () => {
  return supabase.realtime.isConnected();
};