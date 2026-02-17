import { useState, useEffect } from 'react';
import { DeviceIdManager } from '@/utils/deviceId';

const ADMIN_DEVICE_ID = process.env.EXPO_PUBLIC_ADMIN_DEVICE_ID || process.env.NEXT_PUBLIC_ADMIN_DEVICE_ID || '';

export function useIsAdmin(): { isAdmin: boolean; adminLoading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

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

  return { isAdmin, adminLoading };
}
