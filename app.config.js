module.exports = {
  expo: {
    name: "ScooterBooter",
    slug: "scooterbooter-mobile",
    scheme: "scooterbooter",
    version: "0.4.2",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#a78bfa"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.scooterbooter.scoot",
      appleTeamId: "Z4F43AS99A",
      buildNumber: "6",
      infoPlist: {
        NSCameraUsageDescription: "This app uses the camera to take photos for creating posts.",
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to select photos for posts."
      },
      entitlements: {
        "aps-environment": "production",
        "com.apple.security.application-groups": ["group.com.scooterbooter.scoot"]
      },
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      package: "com.scooterbooter.app"
    },
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "15.1",
            useFrameworks: "static"
          }
        }
      ],
      "react-native-compressor",
      [
        "expo-share-intent",
        {
          iosAppGroupIdentifier: "group.com.scooterbooter.scoot",
          iosActivationRules: {
            NSExtensionActivationSupportsWebURLWithMaxCount: 1,
            NSExtensionActivationSupportsText: true
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "200cf867-218b-460c-8e41-3a7f31411cb4"
      }
    }
  }
};
