import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PositionProvider } from './src/context/PositionContext';
import { RideProvider } from './src/context/RideContext';
import { registerForPush } from './src/lib/push';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OfertaOverlay } from './src/screens/home/OfertaOverlay';
import { theme } from './src/theme/theme';

function PushBootstrap(): null {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated) void registerForPush();
  }, [isAuthenticated]);
  return null;
}

export default function App(): React.JSX.Element {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <PositionProvider>
            <RideProvider>
              <NavigationContainer>
                <RootNavigator />
                <OfertaOverlay />
              </NavigationContainer>
              <PushBootstrap />
            </RideProvider>
          </PositionProvider>
        </AuthProvider>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
});
