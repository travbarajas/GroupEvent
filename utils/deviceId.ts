import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import { ApiService } from '@/services/api';

const DEVICE_ID_KEY = 'device_id';
const FINGERPRINT_KEY = 'device_fingerprint';

export class DeviceIdManager {
  private static deviceId: string | null = null;
  private static fingerprint: string | null = null;

  static async getDeviceId(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    try {
      // First, try to sync across browsers using fingerprint
      const syncedDeviceId = await this.syncDeviceAcrossBrowsers();
      if (syncedDeviceId) {
        this.deviceId = syncedDeviceId;
        return syncedDeviceId;
      }

      // Fallback to local storage
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      
      if (!deviceId) {
        // Generate new device ID and register it
        deviceId = this.generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        
        // Register this device with backend
        const fingerprint = await this.getDeviceFingerprint();
        try {
          await ApiService.registerDevice(deviceId, fingerprint);
        } catch (error) {
          console.log('Could not register device with backend:', error);
        }
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

  private static async syncDeviceAcrossBrowsers(): Promise<string | null> {
    try {
      const fingerprint = await this.getDeviceFingerprint();
      
      // Check if this fingerprint already exists in our backend
      const existingDevice = await ApiService.findDeviceByFingerprint(fingerprint);
      
      if (existingDevice) {
        console.log('Found existing device for this fingerprint, syncing...');
        // Update local storage with the existing device ID
        await AsyncStorage.setItem(DEVICE_ID_KEY, existingDevice.device_id);
        return existingDevice.device_id;
      }
      
      return null;
    } catch (error) {
      console.log('Could not sync device across browsers:', error);
      return null;
    }
  }

  private static async getDeviceFingerprint(): Promise<string> {
    if (this.fingerprint) {
      return this.fingerprint;
    }

    try {
      // Check if we have a cached fingerprint
      const cached = await AsyncStorage.getItem(FINGERPRINT_KEY);
      if (cached) {
        this.fingerprint = cached;
        return cached;
      }

      // Generate comprehensive device fingerprint
      const { width, height } = Dimensions.get('window');
      const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');
      
      const fingerprintComponents = [
        // Screen dimensions (consistent across browsers on same device)
        `screen:${screenWidth}x${screenHeight}`,
        `window:${width}x${height}`,
        // Platform info
        `platform:${Platform.OS}`,
        `version:${Platform.Version}`,
        // Timezone (consistent across browsers)
        `tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
        // Language
        `lang:${navigator.language || 'unknown'}`,
        // User agent partial (for distinguishing devices, not browsers)
        `ua:${this.extractDeviceFromUA(navigator.userAgent)}`,
      ];

      // Create hash-like fingerprint
      const rawFingerprint = fingerprintComponents.join('|');
      const fingerprint = btoa(rawFingerprint)
        .replace(/[+/=]/g, '') // Remove special chars
        .substring(0, 20); // Limit length
      
      // Cache the fingerprint
      await AsyncStorage.setItem(FINGERPRINT_KEY, fingerprint);
      this.fingerprint = fingerprint;
      
      return fingerprint;
    } catch (error) {
      console.error('Error generating fingerprint:', error);
      // Fallback fingerprint
      const fallback = `fallback_${Platform.OS}_${Date.now()}`;
      this.fingerprint = fallback;
      return fallback;
    }
  }

  private static extractDeviceFromUA(userAgent: string): string {
    // Extract device-specific info, not browser-specific
    if (Platform.OS === 'ios') {
      // Extract iPhone/iPad model
      const match = userAgent.match(/(iPhone|iPad)[^;)]*|OS [\d_]+/);
      return match ? match[0] : 'ios_device';
    } else if (Platform.OS === 'android') {
      // Extract Android device info
      const match = userAgent.match(/Android [\d.]+|[^)]*\)/);
      return match ? match[0] : 'android_device';
    }
    return 'unknown_device';
  }

  private static generateDeviceId(): string {
    return `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Method to manually link devices (future enhancement)
  static async linkDeviceToUser(username: string, pin: string): Promise<boolean> {
    try {
      const deviceId = await this.getDeviceId();
      const fingerprint = await this.getDeviceFingerprint();
      
      return await ApiService.linkDeviceToUser(deviceId, fingerprint, username, pin);
    } catch (error) {
      console.error('Error linking device to user:', error);
      return false;
    }
  }
}