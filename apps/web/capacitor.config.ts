import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.assaanelectronics.app',
  appName: 'Assaan Electronics',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
