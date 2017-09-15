const path = require('path');

const folders = {
  hid : path.resolve('.', './node_modules/node-hid/build/Release')
};

module.exports = {
  entry : './src/api.js',
  target : 'node',
  output : {
    path : __dirname,
    filename : './lib/index.js',
    libraryTarget : 'umd'
  },
  module : {
    rules : [ {
      test : /\HID.node$/,
      include : folders.hid,
      use : {
        loader : 'file-loader',
        options : {
          name : 'build/Release/[name].[ext]',
          useRelativePath : false,
        }
      }
    } ]
  },
  node : {
    fs : 'empty'
  }
}
