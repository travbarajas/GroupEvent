import { useState, useEffect } from 'react';
import { DeviceIdManager } from '@/utils/deviceId';

const ADMIN_DEVICE_ID = process.env.EXPO_PUBLIC_ADMIN_DEVICE_ID || process.env.NEXT_PUBLIC_ADMIN_DEVICE_ID || '';

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const deviceId = await DeviceIdManager.getDeviceId();
      console.log('🔑 Your device ID:', deviceId);
      if (!ADMIN_DEVICE_ID) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(deviceId === ADMIN_DEVICE_ID);
    };
    checkAdmin();
  }, []);

  return isAdmin;
}
