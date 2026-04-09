export default {
  expo: {
    name: "DrowsyGuard",
    slug: "drowsyguard",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "drowsyguard",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
    },

    android: {
      googleServicesFile: "./google-services.json",
      package: "com.mdhoraji.drowsyguard",

      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },

      minSdkVersion: 26,

      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#064e3b",
      },

      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,

      intentFilters: [
        {
          action: "VIEW",
          data: [{ scheme: "drowsyguard" }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],

      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
      ],
    },

    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 26,
          },
        },
      ],
      [
        "react-native-vision-camera",
        {
          enableFrameProcessors: true,
        },
      ],
      "expo-router",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#064e3b",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#064e3b",
          dark: {
            backgroundColor: "#022c22",
          },
        },
      ],
      "expo-web-browser",
      "expo-audio",
      "expo-video",
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      router: {},
      eas: {
        projectId: "8a051455-fefd-4363-a224-3789ae6bf654",
      },
    },

    owner: "m.dhoraji11",
  },
};
