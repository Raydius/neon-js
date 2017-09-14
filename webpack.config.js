

module.exports = {
  entry: './src/api.js',
  externals : {
    'node-hid' : 'require("node-hid")',
    'ledger-node-js-api' : 'require("ledger-node-js-api")'
  },
  target: 'node',
  output: {
      path: __dirname,
      filename: './lib/index.js',
      libraryTarget: 'umd'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env'],
            plugins: [require('babel-plugin-transform-object-rest-spread')]
          }
        }
      }
    ]
  },
  node: {
    fs: 'empty'
  }
}
