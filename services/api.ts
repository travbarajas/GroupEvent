import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DeviceIdManager } from '@/utils/deviceId';

// Configuration
const API_BASE_URL = 'https://group-event.vercel.app/api';  // Always use production for now

// Types
export interface Group {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  createdAt: string;
  memberCount: number;
  members?: Member[];
}

// Legacy event structure (keep as-is for existing events)
export interface LegacyEvent {
  id: string;
  custom_name: string;
  original_event_data: {
    name: string;
    description: string;
    date: string;
    time: string;
    location?: string;
    [key: string]: any; // Allow other fields
  };
  created_by_device_id: string;
  created_by_username: string;
  created_at: string;
}

// New improved event structure
export interface Event {
  // Core identifiers
  id: string;
  group_id: string;
  custom_name: string;
  
  // Event details (separate fields for easy access)
  name: string;
  description: string;
  
  // Time & Location
  date: string;           // ISO date string
  time: string;           // Time string  
  timezone?: string;      // For proper time handling
  location?: string;
  venue_name?: string;
  
  // Pricing
  price?: number;         // Numeric for easy calculations
  currency?: string;      // USD, EUR, etc.
  is_free: boolean;
  
  // Categorization
  category?: string;      // dinner, concert, sports, etc.
  tags?: string[];        // searchable tags
  
  // Attendance & Social
  max_attendees?: number;
  min_attendees?: number;
  attendance_required: boolean;
  
  // Metadata
  created_by_device_id: string;
  created_by_username: string;
  created_at: string;
  updated_at: string;
  
  // Keep original for reference/migration
  original_event_data?: any;
  
  // Schema version for handling both types
  schema_version: 'legacy' | 'v2';
}

export interface Member {
  id: string;
  name: string;
  avatar: string;
  deviceId: string;
  groupId: string;
  joinedAt: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  creatorId: string;
}

export interface JoinGroupRequest {
  name: string;
  avatar?: string;
  deviceId: string;
}


// API Service Class
export class ApiService {
  private static async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  // Group endpoints
  static async createGroup(data: { name: string; description?: string }): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify({ ...data, device_id }),
    });
  }

  static async getAllGroups(): Promise<any[]> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups?device_id=${device_id}`);
  }

  static async processInvite(code: string): Promise<any> {
    return this.request(`/invites/${code}`);
  }

  static async joinGroup(code: string): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/invites/${code}`, {
      method: 'POST',
      body: JSON.stringify({ device_id })
    });
  }

  static async getGroup(groupId: string): Promise<any> {
    return this.request(`/groups/${groupId}`);
  }

  static async getGroupProfile(groupId: string): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}?profile=true&device_id=${device_id}`);
  }

  static async getGroupMembers(groupId: string): Promise<any[]> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}/members?device_id=${device_id}`);
  }

  static async leaveGroup(groupId: string): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ device_id })
    });
  }

  static async getMemberByDevice(groupId: string, deviceId: string): Promise<{ member: Member }> {
    return this.request(`/groups/${groupId}/members/device/${deviceId}`);
  }

  static async updateMember(memberId: string, data: { name?: string; avatar?: string }): Promise<{ member: Member }> {
    return this.request(`/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async updateGroupProfile(groupId: string, data: { username?: string; profile_picture?: string }): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, device_id }),
    });
  }

  // Events endpoints (Legacy - for backward compatibility)
  static async getGroupEvents(groupId: string): Promise<{ events: any[] }> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}/members?events=true&device_id=${device_id}`);
  }

  static async saveEventToGroup(groupId: string, customName: string, originalEvent: any): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        device_id,
        custom_name: customName,
        original_event: originalEvent
      })
    });
  }

  // New Event Registry System
  static async getAllEvents(): Promise<{ events: Event[] }> {
    return this.request('/events');
  }

  static async createGlobalEvent(eventData: Partial<Event>): Promise<Event> {
    return this.request('/events', {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  }

  static async getGroupEventsV2(groupId: string): Promise<{ events: any[] }> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}/events-v2?device_id=${device_id}`);
  }

  static async addEventToGroup(groupId: string, eventId: string, customName?: string): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}/events-v2`, {
      method: 'POST',
      body: JSON.stringify({
        device_id,
        event_id: eventId,
        custom_name: customName
      })
    });
  }

  static async createCustomEvent(groupId: string, eventData: {
    name: string;
    description?: string;
    date: Date;
    time?: Date;
    location?: string;
  }): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    
    // Format the date and time to match the expected format
    const formattedDate = eventData.date.toISOString().split('T')[0]; // YYYY-MM-DD
    const formattedTime = eventData.time 
      ? eventData.time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
      : null;
    
    return this.request(`/groups/${groupId}/custom-events`, {
      method: 'POST',
      body: JSON.stringify({
        device_id,
        name: eventData.name,
        description: eventData.description || '',
        date: formattedDate,
        time: formattedTime,
        location: eventData.location || ''
      })
    });
  }

  // Note: Individual event endpoint removed to stay under Vercel function limit
  // Events are fetched through group context instead

  // Permissions endpoint
  static async getPermissions(groupId: string): Promise<{
    is_member: boolean;
    is_creator: boolean;
    role: string;
    permissions: {
      can_invite: boolean;
      can_leave: boolean;
      can_delete_group: boolean;
    };
  }> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}/permissions?device_id=${device_id}`);
  }

  // User profile endpoints (consolidated)
  static async getUserInfo(deviceId: string): Promise<{ username: string | null; has_username: boolean }> {
    return this.request(`/members?action=me&device_id=${deviceId}`);
  }

  static async updateUserProfile(deviceId: string, username: string): Promise<{ success: boolean; message: string }> {
    return this.request('/members?action=username', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, username }),
    });
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; timestamp: string; groups: number; members: number }> {
    return this.request('/health');
  }
}

// Convenience hooks/functions for common operations
export class GroupService {
  // Create group and return the creator's member info
  static async createGroupWithCreator(name: string, description?: string): Promise<{
    group: Group;
    joinLink: string;
    creatorMember: Member;
  }> {
    const deviceId = await DeviceIdManager.getDeviceId();
    
    // Create the group
    const { group, joinLink } = await ApiService.createGroup({
      name,
      description,
      creatorId: deviceId,
    });

    // Join as the creator
    const { member: creatorMember } = await ApiService.joinGroup(group.id, {
      name: 'Group Creator', // Default name, can be changed later
      avatar: 'crown',
      deviceId,
    });

    return { group, joinLink, creatorMember };
  }

  // Check if user is already a member, join if not
  static async joinOrReconnectToGroup(groupId: string, userData?: { name: string; avatar?: string }): Promise<{
    group: Group;
    member: Member;
    isReturningUser: boolean;
  }> {
    const deviceId = await DeviceIdManager.getDeviceId();
    
    try {
      // Try to find existing membership
      const { member } = await ApiService.getMemberByDevice(groupId, deviceId);
      const group = await ApiService.getGroup(groupId);
      
      return {
        group,
        member,
        isReturningUser: true,
      };
    } catch (error) {
      // Not a member yet, need to join
      if (!userData) {
        throw new Error('User data required for new members');
      }
      
      const { member } = await ApiService.joinGroup(groupId, {
        ...userData,
        deviceId,
      });
      
      const group = await ApiService.getGroup(groupId);
      
      return {
        group,
        member,
        isReturningUser: false,
      };
    }
  }

  // Get current user's member info for a group
  static async getCurrentMember(groupId: string): Promise<Member | null> {
    try {
      const deviceId = await DeviceIdManager.getDeviceId();
      const { member } = await ApiService.getMemberByDevice(groupId, deviceId);
      return member;
    } catch (error) {
      return null;
    }
  }

}