/**
 * Config dinâmica do Expo.
 *
 * O que muda em relação a um app.json fixo: o app **reconhece sozinho** o
 * arquivo do Firebase assim que ele for colocado na raiz do projeto —
 * `google-services.json` (Android) e/ou `GoogleService-Info.plist` (iOS).
 * Sem esses arquivos o app compila igual (o push nativo só não funciona no
 * build standalone). Ver FIREBASE-SETUP.md.
 */
const fs = require('fs');
const path = require('path');

const hasAndroidFirebase = fs.existsSync(path.join(__dirname, 'google-services.json'));
const hasIosFirebase = fs.existsSync(path.join(__dirname, 'GoogleService-Info.plist'));

const BRAND = '#1f6f5c';
const DARK = '#141513';

module.exports = () => ({
  expo: {
    name: 'Leeva Motoboy',
    slug: 'leeva-motoboy',
    scheme: 'leevamotoboy',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    backgroundColor: DARK,
    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: false,
      bundleIdentifier: 'br.com.leeva.motoboy',
      ...(hasIosFirebase ? { googleServicesFile: './GoogleService-Info.plist' } : {}),
      infoPlist: {
        UIBackgroundModes: ['location'],
        NSLocationWhenInUseUsageDescription:
          'O Leeva usa sua localização para te oferecer entregas próximas e mostrar sua posição durante a entrega.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Durante uma entrega, o Leeva continua enviando sua localização mesmo com o app em segundo plano, para o restaurante e o cliente acompanharem.',
      },
    },

    android: {
      package: 'br.com.leeva.motoboy',
      versionCode: 1,
      ...(hasAndroidFirebase ? { googleServicesFile: './google-services.json' } : {}),
      adaptiveIcon: {
        backgroundColor: BRAND,
        foregroundImage: './assets/adaptive-icon.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
        'WAKE_LOCK',
      ],
    },

    plugins: [
      'expo-font',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: DARK,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/android-icon-monochrome.png',
          color: BRAND,
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Durante uma entrega, o Leeva continua enviando sua localização em segundo plano para o restaurante e o cliente acompanharem.',
          locationWhenInUsePermission: 'O Leeva usa sua localização para te oferecer entregas próximas.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
    ],

    extra: {
      // ID do projeto EAS (conta Expo do dono). Ligado via `eas init`.
      eas: {
        projectId: '5c851aad-66e2-4c2c-8f3f-c2fd80b620d9',
      },
      // usado por src/lib/push.ts para saber se o push nativo está viável
      firebaseConfigured: hasAndroidFirebase || hasIosFirebase,
    },
  },
});
