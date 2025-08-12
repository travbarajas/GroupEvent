import { Platform } from 'react-native';
import Constants from 'expo-constants';

export class PlatformDetector {
  /**
   * Checks if the app is running in a web browser (vs native mobile app)
   */
  static isWebBrowser(): boolean {
    return Platform.OS === 'web';
  }

  /**
   * Checks if the app is running as a native mobile app
   */
  static isNativeApp(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  /**
   * Gets a user-friendly platform description
   */
  static getPlatformDescription(): string {
    if (Platform.OS === 'web') {
      // Try to detect which browser/webview
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      
      if (userAgent.includes('Snapchat')) {
        return 'Snapchat Browser';
      } else if (userAgent.includes('Instagram')) {
        return 'Instagram Browser';
      } else if (userAgent.includes('FBAN') || userAgent.includes('FBAV')) {
        return 'Facebook Browser';
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        return 'Safari';
      } else if (userAgent.includes('Chrome')) {
        return 'Chrome';
      } else if (userAgent.includes('Firefox')) {
        return 'Firefox';
      }
      
      return 'Web Browser';
    } else if (Platform.OS === 'ios') {
      return 'iOS App';
    } else if (Platform.OS === 'android') {
      return 'Android App';
    }
    
    return 'Unknown Platform';
  }

  /**
   * Gets appropriate app store URL based on platform
   */
  static getAppStoreUrl(): string {
    if (Platform.OS === 'ios') {
      // TODO: Replace with actual App Store URL when app is published
      return 'https://apps.apple.com/app/groupevent/id123456789';
    } else if (Platform.OS === 'android') {
      // TODO: Replace with actual Google Play URL when app is published  
      return 'https://play.google.com/store/apps/details?id=com.groupevent';
    }
    
    // For web users, detect platform and show appropriate store
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      return 'https://apps.apple.com/app/groupevent/id123456789';
    } else {
      return 'https://play.google.com/store/apps/details?id=com.groupevent';
    }
  }

  /**
   * Gets appropriate download message for browser users
   */
  static getDownloadMessage(): string {
    const platform = this.getPlatformDescription();
    return `You're using ${platform}. For the best experience and to create groups, download the GroupEvent app!`;
  }
}