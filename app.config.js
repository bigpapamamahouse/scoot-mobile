module.exports = {
  expo: {
    name: "ScooterBooter",
    slug: "scooterbooter-mobile",
    scheme: "scooterbooter",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.scooterbooter.scoot",
      buildNumber: "1",
      infoPlist: {
        NSCameraUsageDescription: "This app uses the camera to take photos for creating posts.",
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to select photos for posts."
      },
      entitlements: {
        "aps-environment": "production"
      },
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      package: "com.scooterbooter.app"
    },
    extra: {
      eas: {
        projectId: "200cf867-218b-460c-8e41-3a7f31411cb4"
      }
    }
  }
};
