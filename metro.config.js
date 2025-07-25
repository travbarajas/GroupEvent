const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver for lodash modules
config.resolver.alias = {
  ...config.resolver.alias,
  'lodash/isEmpty': 'lodash.isempty',
  'lodash/isEqual': 'lodash.isequal',
  'lodash/padStart': 'lodash.padstart',
};

module.exports = config;