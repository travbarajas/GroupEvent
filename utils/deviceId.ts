import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { HttpClient } from '@/utils/httpClient';

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
          await HttpClient.request('/devices/register', {
            method: 'POST',
            body: JSON.stringify({
              device_id: deviceId,
              fingerprint: fingerprint
            })
          });
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
      const existingDevice = await HttpClient.request<{ device_id: string } | null>(`/devices/fingerprint/${encodeURIComponent(fingerprint)}`)
        .catch(() => null); // Return null if not found (404) rather than throwing
      
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
        // Screen dimensions (most reliable - same across all browsers on device)
        `screen:${screenWidth}x${screenHeight}`,
        // Platform info (stable)
        `platform:${Platform.OS}`,
        `version:${Platform.Version}`,
        // Timezone (consistent across browsers)
        `tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
        // Device name from Constants (if available)
        `device:${Constants.deviceName || Constants.platform?.ios?.model || Constants.platform?.android?.model || 'unknown'}`,
        // Language (with safe fallback)
        `lang:${this.getLanguage()}`,
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

  private static getLanguage(): string {
    try {
      // Try multiple ways to get language in React Native
      if (typeof navigator !== 'undefined' && navigator.language) {
        return navigator.language;
      }
      
      // Fallback to Intl API
      return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
    } catch (error) {
      return 'en-US';
    }
  }

  private static generateDeviceId(): string {
    return `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Method to manually link devices (future enhancement)
  static async linkDeviceToUser(username: string, pin: string): Promise<boolean> {
    try {
      const deviceId = await this.getDeviceId();
      const fingerprint = await this.getDeviceFingerprint();
      
      await HttpClient.request('/devices/link', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId,
          fingerprint: fingerprint,
          username: username,
          pin: pin
        })
      });
      return true;
    } catch (error) {
      console.error('Error linking device to user:', error);
      return false;
    }
  }
}