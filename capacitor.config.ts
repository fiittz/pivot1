import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ie.balnce.app",
  appName: "Balnce",
  webDir: "dist",
  server: {
    // Enable live reload during development (comment out for production builds)
    // url: "http://YOUR_LOCAL_IP:8080",
    // cleartext: true,
    androidScheme: "https",
  },
  plugins: {
    App: {
      // Deep link handling for password reset and magic links
      // Requires Associated Domains (iOS) and App Links (Android) setup
    },
    Keyboard: {
      resize: "body",
      scrollAssist: true,
      scrollPadding: false,
    },
    StatusBar: {
      style: "light",
    },
  },
};

export default config;
