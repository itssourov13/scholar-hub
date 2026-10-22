// Keep Expo's SDK 57 default Metro configuration and NativeWind transform.
// SDK 52+ automatically detects pnpm monorepos and symlinked workspace packages.
// Manually overriding watchFolders/nodeModulesPaths here made Metro derive the
// repository root as the entry resolver root, breaking expo-router/entry export.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
