import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';

// registra a task de localização em segundo plano (precisa ser no topo,
// antes do App renderizar) — ver src/lib/backgroundLocation.ts
import './src/lib/backgroundLocation';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
