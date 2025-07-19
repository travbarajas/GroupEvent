import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DeviceIdManager } from '@/utils/deviceId';

// Configuration
const API_BASE_URL = 'https://group-event.vercel.app/api';  // Always use production for now



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

  static async leaveGroup(groupId: string): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request(`/groups/${groupId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ device_id })
    });
  }


  // Events endpoints (placeholder for later)
  static async getGroupEvents(groupId: string): Promise<{ events: any[] }> {
    return this.request(`/groups/${groupId}/events`);
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

  // Username endpoint
  static async updateUsername(username: string): Promise<any> {
    const device_id = await DeviceIdManager.getDeviceId();
    return this.request('/members/username', {
      method: 'POST',
      body: JSON.stringify({ device_id, username }),
    });
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; timestamp: string; groups: number; members: number }> {
    return this.request('/health');
  }
}

