const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force Metro to resolve these specific packages to the root node_modules
// Using absolute paths with path.resolve ensures Windows compatibility
config.resolver.extraNodeModules = {
  'react': path.resolve(__dirname, 'node_modules', 'react'),
  'react-native': path.resolve(__dirname, 'node_modules', 'react-native'),
  '@react-native': path.resolve(__dirname, 'node_modules', '@react-native'),
};

// Ensure we look in the root node_modules first
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
