import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';

import { useColorScheme } from '@/hooks/useColorScheme';
import { GroupsProvider } from '@/contexts/GroupsContext';
import { NewsletterProvider } from '@/contexts/NewsletterContext';
import { ApiService } from '@/services/api';

// How notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

async function registerForPushNotifications() {
  if (Platform.OS === 'web') return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await ApiService.registerPushToken(tokenData.data);
  } catch (err) {
    console.log('Push token registration failed:', err);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen immediately since no fonts to load
    SplashScreen.hideAsync();
    registerForPushNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GroupsProvider>
        <NewsletterProvider>
          <ThemeProvider value={DarkTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="group/[id]" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen 
            name="event/[id]" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen 
            name="events-search" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen 
            name="event-detail" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen 
            name="group-selection" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen 
            name="calendar" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen 
            name="date-events" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen 
            name="create-event" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen 
            name="group-chat" 
            options={{ 
              headerShown: false,
              presentation: 'card'
            }} 
          />
          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
      </NewsletterProvider>
    </GroupsProvider>
    </GestureHandlerRootView>
  );
}