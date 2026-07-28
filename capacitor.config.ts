import type { CapacitorConfig } from '@capacitor/cli'

    const config: CapacitorConfig = {
    appId: 'ma.shgps.app',
    appName: 'SHGPS',
    webDir: 'dist',
    server: {
      androidScheme: 'https',
    },
    plugins: {
      SplashScreen: {
        launchShowDuration: 2000,
        backgroundColor: '#0F2044',
        showSpinner: false,
        splashFullScreen: true,
        splashImmersive: true,
      },
      StatusBar: {
        style: 'Dark',
        backgroundColor: '#0F2044',
      },
    },
    }

    export default config
    