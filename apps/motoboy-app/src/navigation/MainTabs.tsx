import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';

import { GanhosScreen } from '../screens/historico/GanhosScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { PerfilScreen } from '../screens/perfil/PerfilScreen';
import { theme } from '../theme/theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarLabelStyle: { fontFamily: theme.fonts.bodyMedium, fontSize: 12 },
        tabBarIcon: () => null,
      }}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Ganhos" component={GanhosScreen} options={{ title: 'Ganhos' }} />
      <Tab.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}
