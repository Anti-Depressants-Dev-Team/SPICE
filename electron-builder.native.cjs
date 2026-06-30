const { build: baseBuild } = require("./package.json");

module.exports = {
  ...baseBuild,
  appId: "com.spice.native",
  productName: "Spice Native",
  artifactName: "Spice-Native-${version}-${arch}.${ext}",
  directories: {
    output: "dist-native",
  },
  extraResources: [
    {
      from: "native-runtime",
      to: "native-runtime",
      filter: ["**/*"],
    },
  ],
};
