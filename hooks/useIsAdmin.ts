import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { DeviceIdManager } from '@/utils/deviceId';

const ADMIN_DEVICE_ID = process.env.EXPO_PUBLIC_ADMIN_DEVICE_ID || process.env.NEXT_PUBLIC_ADMIN_DEVICE_ID || '';
const API_BASE = 'https://group-event.vercel.app/api';

// Persists across screen navigations for the session
let sessionVerified = false;

export function useIsAdmin(): {
  isAdmin: boolean;
  adminLoading: boolean;
  passwordVerified: boolean;
  verifyPassword: (pw: string) => Promise<boolean>;
} {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [passwordVerified, setPasswordVerified] = useState(sessionVerified);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        // On web, skip device ID check — password gate is the auth layer
        if (Platform.OS === 'web') {
          setIsAdmin(true);
          return;
        }
        const deviceId = await DeviceIdManager.getDeviceId();
        if (!ADMIN_DEVICE_ID) {
          setIsAdmin(false);
          return;
        }
        setIsAdmin(deviceId === ADMIN_DEVICE_ID);
      } finally {
        setAdminLoading(false);
      }
    };
    checkAdmin();
  }, []);

  const verifyPassword = async (pw: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          sessionVerified = true;
          setPasswordVerified(true);
          return true;
        }
      }
    } catch {
      // Network error — fail closed
    }
    return false;
  };

  return { isAdmin, adminLoading, passwordVerified, verifyPassword };
}
