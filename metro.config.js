const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for SQLite WASM files
config.resolver.assetExts.push('wasm');
config.resolver.sourceExts.push('wasm');

// Add platform-specific extensions
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;

