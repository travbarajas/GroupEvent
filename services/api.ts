import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8082/api'  // Local development (Expo dev server)
  : 'https://group-event-zeta.vercel.app/api';  // Production (your Vercel URL)

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

// Device ID management
export class DeviceManager {
  private static DEVICE_ID_KEY = 'device_id';

  static async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(this.DEVICE_ID_KEY);
      
      if (!deviceId) {
        // Generate new device ID
        deviceId = this.generateDeviceId();
        await AsyncStorage.setItem(this.DEVICE_ID_KEY, deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return this.generateDeviceId();
    }
  }

  private static generateDeviceId(): string {
    return `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
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
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getAllGroups(): Promise<any[]> {
    return this.request('/groups');
  }

  static async processInvite(code: string): Promise<any> {
    return this.request(`/invites/${code}`);
  }

  static async joinGroup(code: string): Promise<any> {
    return this.request(`/invites/${code}`, {
      method: 'POST'
    });
  }

  static async getGroup(groupId: string): Promise<any> {
    return this.request(`/groups/${groupId}`);
  }

  // Member endpoints
  static async joinGroup(groupId: string, data: JoinGroupRequest): Promise<{ member: Member }> {
    return this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
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

  // Events endpoints (placeholder for later)
  static async getGroupEvents(groupId: string): Promise<{ events: any[] }> {
    return this.request(`/groups/${groupId}/events`);
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
    const deviceId = await DeviceManager.getDeviceId();
    
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
    const deviceId = await DeviceManager.getDeviceId();
    
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
      const deviceId = await DeviceManager.getDeviceId();
      const { member } = await ApiService.getMemberByDevice(groupId, deviceId);
      return member;
    } catch (error) {
      return null;
    }
  }
}