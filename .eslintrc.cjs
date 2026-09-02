const { base, typescript } = require('./.eslintrc.base.cjs')

module.exports = {
  root: true,
  ...base,
  overrides: [
    {
      ...typescript,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
  ignorePatterns: [
    'node_modules',
    '*.min.js',
    'dist',
    'dist_dev',
    'build',
    // 汽水音乐官方安全组件（第三方压缩资源，不参与 lint）
    'src/main/modules/qishui/auth-assets',
  ],
}
