import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.circuitsafari.clone',
  appName: 'Circuit Simulator',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    minSdkVersion: 26, // Android 8.0
  }
};

export default config;
