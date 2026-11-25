import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.wird.app',
  appName: 'الورد',
  webDir: 'out',
  server: {
    url: 'https://wird-app-six.vercel.app',
    cleartext: true,
    allowNavigation: ['wird-app-six.vercel.app'],
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
