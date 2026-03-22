import { registerRootComponent } from 'expo';

// Register GPS background task before any React code (required for expo-task-manager)
import './src/services/gpsBackgroundTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
