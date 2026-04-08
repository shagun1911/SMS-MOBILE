import messaging from "@react-native-firebase/messaging";

// Register early so background/killed delivery behaves consistently (notification payloads still show from FCM).
messaging().setBackgroundMessageHandler(async () => {});

import "expo-router/entry";
