import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { EntregaScreen } from '../screens/home/EntregaScreen';
import { theme } from '../theme/theme';
import { AuthNavigator } from './AuthNavigator';
import { MainTabs } from './MainTabs';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

function AppStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="Entrega"
        component={EntregaScreen}
        options={{
          title: 'Entrega',
          presentation: 'fullScreenModal',
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator(): React.JSX.Element {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }
  return isAuthenticated ? <AppStack /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
});
