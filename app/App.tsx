import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/AuthContext';
import {DialogProvider} from './src/dialog';
import RootNavigator from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <DialogProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </DialogProvider>
    </SafeAreaProvider>
  );
}
