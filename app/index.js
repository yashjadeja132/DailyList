/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// messages that arrive while the app is closed are shown by Android itself
setBackgroundMessageHandler(getMessaging(), async () => {});

AppRegistry.registerComponent(appName, () => App);
