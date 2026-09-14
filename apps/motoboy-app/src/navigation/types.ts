import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Inicio: undefined;
  Ganhos: undefined;
  Carteira: undefined;
  Perfil: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Entrega: undefined;
  Documentos: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends AppStackParamList {}
  }
}
