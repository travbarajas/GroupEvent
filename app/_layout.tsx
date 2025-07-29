import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';


import { useColorScheme } from '@/hooks/useColorScheme';
import { GroupsProvider } from '@/contexts/GroupsContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GroupsProvider>
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
          <Stack.Screen name="+not-found" />
        </Stack>
      </ThemeProvider>
    </GroupsProvider>
  );
}