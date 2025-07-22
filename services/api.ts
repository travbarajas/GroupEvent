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

  // Events endpoints
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