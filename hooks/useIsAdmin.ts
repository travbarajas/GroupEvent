import { useState, useEffect } from 'react';
import { DeviceIdManager } from '@/utils/deviceId';

const ADMIN_DEVICE_ID = process.env.EXPO_PUBLIC_ADMIN_DEVICE_ID || '';

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!ADMIN_DEVICE_ID) {
        setIsAdmin(false);
        return;
      }
      const deviceId = await DeviceIdManager.getDeviceId();
      console.log('🔑 Your device ID:', deviceId);
      setIsAdmin(deviceId === ADMIN_DEVICE_ID);
    };
    checkAdmin();
  }, []);

  return isAdmin;
}
