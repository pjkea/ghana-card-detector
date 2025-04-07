const path = require('path');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'GhanaCardDetector',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'demo'),
    },
    compress: true,
    port: 9000,
  },
  // External dependencies (will not be bundled)
  externals: {
    '@tensorflow/tfjs': {
      commonjs: '@tensorflow/tfjs',
      commonjs2: '@tensorflow/tfjs',
      amd: '@tensorflow/tfjs',
      root: 'tf',
    },
    '@tensorflow/tfjs-tflite': {
      commonjs: '@tensorflow/tfjs-tflite',
      commonjs2: '@tensorflow/tfjs-tflite',
      amd: '@tensorflow/tfjs-tflite',
      root: 'tflite',
    },
  },
};