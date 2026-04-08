// Native Firebase modules do not exist in Expo Go.
// Guard this import so app still boots in environments without RN Firebase.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messaging = require("@react-native-firebase/messaging").default;
  if (messaging) {
    // Register early so background/killed delivery behaves consistently.
    messaging().setBackgroundMessageHandler(async () => {});
  }
} catch {
  // Ignore in Expo Go / missing native module builds.
}

import "expo-router/entry";
