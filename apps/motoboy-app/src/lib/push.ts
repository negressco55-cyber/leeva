/**
 * Notificações push nativas via Expo. Pega o Expo push token e manda para
 * o backend (POST /api/push/expo), que guarda em push_subscriptions com
 * kind='expo'. O envio real sai pelo Expo Push Service.
 *
 * Em Expo Go o token funciona para testes; no APK/AAB standalone precisa
 * do google-services.json (FCM) configurado no EAS.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerExpoPush } from '../api/motoboy';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let lastToken: string | null = null;

export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('ofertas', {
        name: 'Ofertas de entrega',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250],
      });
    }

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResp.data;
    if (token && token !== lastToken) {
      lastToken = token;
      await registerExpoPush(token).catch(() => {});
    }
  } catch {
    /* push é opcional — não derruba o app */
  }
}
