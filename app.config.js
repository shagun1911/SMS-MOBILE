const appJson = require("./app.json");

/**
 * Embeds EXPO_PUBLIC_GOOGLE_MAPS_API_KEY into AndroidManifest at prebuild time.
 * Set it in `.env` locally and in EAS project secrets for cloud builds.
 */
module.exports = () => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  return {
    expo: {
      ...appJson.expo,
      android: {
        ...appJson.expo.android,
        config: {
          ...(appJson.expo.android?.config ?? {}),
          googleMaps: {
            apiKey,
          },
        },
      },
    },
  };
};
