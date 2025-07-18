import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'device_id';

export class DeviceIdManager {
  private static deviceId: string | null = null;

  static async getDeviceId(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      
      if (!deviceId) {
        // Generate new device ID
        deviceId = this.generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      
      this.deviceId = deviceId;
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      const fallbackId = this.generateDeviceId();
      this.deviceId = fallbackId;
      return fallbackId;
    }
  }

  private static generateDeviceId(): string {
    return `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}