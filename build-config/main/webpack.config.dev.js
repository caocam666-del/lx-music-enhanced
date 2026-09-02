const path = require('path')
const { merge } = require('webpack-merge')
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const baseConfig = require('./webpack.config.base')


module.exports = merge(baseConfig, {
  mode: 'development',
  entry: {
    main: path.join(__dirname, '../../src/main/index-dev.ts'),
    // 'dbService.worker': path.join(__dirname, '../../src/main/worker/dbService/index.ts'),
  },
  output: {
    path: path.join(__dirname, '../../dist_dev'),
  },
  devtool: 'eval-source-map',
  plugins: [
    // Luminous Harmonic: 汽水扫码登录安全组件静态资源 (dev 输出目录为 dist_dev)
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, '../../src/main/modules/qishui/auth-assets'),
          to: path.join(__dirname, '../../dist_dev/qishui-auth'),
        },
      ],
    }),

    new webpack.DefinePlugin({
      'process.env.NODE_ENV': '"development"',
      webpackStaticPath: `"${path.join(__dirname, '../../src/static').replace(/\\/g, '\\\\')}"`,
      webpackUserApiPath: `"${path.join(__dirname, '../../src/main/modules/userApi').replace(/\\/g, '\\\\')}"`,
    }),
  ],
  performance: {
    maxEntrypointSize: 1024 * 1024 * 50,
    maxAssetSize: 1024 * 1024 * 30,
  },
})
