const appJson = require("./app.json");

module.exports = ({ config }) => {
  const base = appJson?.expo ?? config;
  const androidGoogleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || base?.android?.googleServicesFile;
  const iosGoogleServicesFile =
    process.env.GOOGLE_SERVICES_PLIST || base?.ios?.googleServicesFile;

  return {
    ...base,
    android: {
      ...base.android,
      ...(androidGoogleServicesFile
        ? { googleServicesFile: androidGoogleServicesFile }
        : {}),
    },
    ios: {
      ...base.ios,
      ...(iosGoogleServicesFile
        ? { googleServicesFile: iosGoogleServicesFile }
        : {}),
    },
  };
};
