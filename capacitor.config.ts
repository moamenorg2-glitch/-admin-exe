import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zajelexpress.admin',
  appName: 'Zajel Admin',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
