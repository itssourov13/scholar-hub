// Metro config for the self-contained mobile app.
//
// `@scholarhub/shared` lives outside this project (../../packages/shared) and is
// symlinked into node_modules via a `link:` dependency. Metro follows the
// symlink but only *watches* folders it's told about, so we add the shared
// package to `watchFolders` — otherwise edits to shared types wouldn't trigger
// a reload. The web app keeps its own isolated tooling; nothing here touches it.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, "../../packages/shared");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];

// Resolve dependencies from this project's node_modules first; symlinked
// packages with no deps of their own don't need anything more. (Metro follows
// symlinks by default in SDK 57, so no extra resolver flags are needed.)
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

module.exports = withNativeWind(config, { input: "./global.css" });
