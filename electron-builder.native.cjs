const { build: baseBuild } = require("./package.json");

const nativePublish = Array.isArray(baseBuild.publish)
  ? baseBuild.publish.map((publisher) => ({
      ...publisher,
      channel: "native",
    }))
  : baseBuild.publish && typeof baseBuild.publish === "object"
    ? {
        ...baseBuild.publish,
        channel: "native",
      }
    : baseBuild.publish;

module.exports = {
  ...baseBuild,
  appId: "com.spice.native",
  productName: "Spice Native",
  executableName: "Spice Native",
  artifactName: "Spice-Native-${version}-${arch}.${ext}",
  publish: nativePublish,
  detectUpdateChannel: false,
  generateUpdatesFilesForAllChannels: false,
  directories: {
    output: "dist-native",
  },
  nsis: {
    ...baseBuild.nsis,
    artifactName: "Spice-Native-Setup-${version}-${arch}.${ext}",
    shortcutName: "Spice Native",
    uninstallDisplayName: "Spice Native",
  },
  extraResources: [
    {
      from: "native-runtime",
      to: "native-runtime",
      filter: ["**/*"],
    },
  ],
};
