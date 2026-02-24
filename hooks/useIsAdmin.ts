import { useState, useEffect } from 'react';
import { DeviceIdManager } from '@/utils/deviceId';

const ADMIN_DEVICE_ID = process.env.EXPO_PUBLIC_ADMIN_DEVICE_ID || process.env.NEXT_PUBLIC_ADMIN_DEVICE_ID || '';
const ADMIN_PASSWORD = process.env.EXPO_PUBLIC_ADMIN_PASSWORD || '';

// Persists across screen navigations for the session
let sessionVerified = false;

export function useIsAdmin(): {
  isAdmin: boolean;
  adminLoading: boolean;
  passwordVerified: boolean;
  verifyPassword: (pw: string) => boolean;
} {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [passwordVerified, setPasswordVerified] = useState(sessionVerified);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
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

  const verifyPassword = (pw: string): boolean => {
    if (pw === ADMIN_PASSWORD) {
      sessionVerified = true;
      setPasswordVerified(true);
      return true;
    }
    return false;
  };

  return { isAdmin, adminLoading, passwordVerified, verifyPassword };
}
