const webpack = require('webpack');

const COMMON_CONFIG = {
  mode: 'development',

  entry: {
    app: './app.js'
  },

  output: {
    library: 'App'
  },

  module: {
    rules: [
      {
        // Transpile ES6 to ES5 with babel
        // Remove if your app does not use JSX or you don't need to support old browsers
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: [/node_modules/],
        options: {
          presets: ['@babel/preset-react']
        }
      }
    ]
  }
};

function addDevConfig(config, env) {
  config = require('../webpack.config.local')(config)(env);
  return config;
}

function addProdConfig(config) {
  config.plugins = config.plugins || [];
  config.plugins = config.plugins.concat(
    new webpack.DefinePlugin({
      DATA_URI: JSON.stringify('https://raw.githubusercontent.com/uber-web/loaders.gl/master/')
    })
  );

  return Object.assign(config, {
    mode: 'production'
  });
}

module.exports = env => {
  env = env || {};

  let config = COMMON_CONFIG;

  if (env.local) {
    config = addDevConfig(config, env);
  }

  if (env.prod) {
    config = addProdConfig(config);
  }

  // Enable to debug config
  // console.warn(JSON.stringify(config, null, 2));

  return config;
};