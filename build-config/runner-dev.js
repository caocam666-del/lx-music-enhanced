process.env.NODE_ENV = 'development'

const fs = require('fs')
const chalk = require('chalk')
const electron = require('electron')
const path = require('path')
const projectRoot = path.join(__dirname, '..')
const projectTemp = path.join(projectRoot, '.tmp')
fs.mkdirSync(projectTemp, { recursive: true })
process.env.TEMP = projectTemp
process.env.TMP = projectTemp
process.env.npm_config_cache = path.join(projectRoot, '.npm-cache')
process.env.ELECTRON_CACHE = path.join(projectRoot, '.electron-cache')
// const { say } = require('cfonts')
const { spawn } = require('child_process')
const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpackHotMiddleware = require('webpack-hot-middleware')

const mainConfig = require('./main/webpack.config.dev')
const rendererConfig = require('./renderer/webpack.config.dev')
const rendererLyricConfig = require('./renderer-lyric/webpack.config.dev')
const rendererScriptConfig = require('./renderer-scripts/webpack.config.dev')
const { Arch } = require('electron-builder')
const replaceLib = require('./build-before-pack')
const treeKill = require('tree-kill')
const { debounce } = require('./utils')

let electronProcess = null
let hotMiddlewareRenderer
let hotMiddlewareRendererLyric


function startRenderer() {
  return new Promise((resolve, reject) => {
    // rendererConfig.entry.renderer = [path.join(__dirname, 'dev-client')].concat(rendererConfig.entry.renderer)
    // rendererConfig.mode = 'development'
    const compiler = webpack(rendererConfig)
    hotMiddlewareRenderer = webpackHotMiddleware(compiler, {
      log: false,
      heartbeat: 2500,
    })

    compiler.hooks.compilation.tap('compilation', compilation => {
      // console.log(Object.keys(compilation.hooks))
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('html-webpack-plugin-after-emit', (data, cb) => {
        hotMiddlewareRenderer.publish({ action: 'reload' })
        cb()
      })
    })

    // compiler.hooks.done.tap('done', stats => {
    //   // logStats('Renderer', 'Compile done')
    //   // logStats('Renderer', stats)
    // })

    const server = new WebpackDevServer({
      port: 9080,
      hot: true,
      historyApiFallback: true,
      static: {
        directory: path.join(__dirname, '../src/common/theme/images'),
        publicPath: '/theme_images',
      },
      client: {
        logging: 'warn',
        // Luminous Harmonic: 关掉 dev-server 的红屏 overlay.
        // 原因: Vue3 的 errorHandler 无法阻止 Vue 内部 throw (Vue 内部固定 re-throw),
        // 这些 throw 走 webpack-dev-server 的 runtimeError 通道, 会让 client 强制渲染
        // "Uncaught runtime errors:" 红屏盖在 App 上, 用户根本看不到 App.
        // 关掉后, 错误仍在 console [swallowKnownCrash] 处打印, App 完全可用,
        // 不再因为一条历史 parentNode 错就废了整页.
        overlay: false,
      },
      setupMiddlewares(middlewares, devServer) {
        devServer.app.use(hotMiddlewareRenderer)
        setImmediate(() => {
          devServer.middleware.waitUntilValid(resolve)
        })

        return middlewares
      },
    }, compiler)

    server.start()
  })
}

function startRendererLyric() {
  return new Promise((resolve, reject) => {
    // rendererConfig.entry.renderer = [path.join(__dirname, 'dev-client')].concat(rendererConfig.entry.renderer)
    // rendererConfig.mode = 'development'
    const compiler = webpack(rendererLyricConfig)
    hotMiddlewareRendererLyric = webpackHotMiddleware(compiler, {
      log: false,
      heartbeat: 2500,
    })

    compiler.hooks.compilation.tap('compilation', compilation => {
      // console.log(Object.keys(compilation.hooks))
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('html-webpack-plugin-after-emit', (data, cb) => {
        hotMiddlewareRendererLyric.publish({ action: 'reload' })
        cb()
      })
    })

    // compiler.hooks.done.tap('done', stats => {
    //   // logStats('Renderer', 'Compile done')
    //   // logStats('Renderer', stats)
    // })

    const server = new WebpackDevServer({
      port: 9081,
      hot: true,
      historyApiFallback: true,
      // static: {
      //   directory: path.join(__dirname, '../'),
      // },
      client: {
        logging: 'warn',
        // Luminous Harmonic: 同步关掉 renderer-lyric 窗口的 overlay, 理由同 9080.
        overlay: false,
      },
      setupMiddlewares(middlewares, devServer) {
        devServer.app.use(hotMiddlewareRenderer)
        setImmediate(() => {
          devServer.middleware.waitUntilValid(resolve)
        })
        return middlewares
      },
    }, compiler)

    server.start()
  })
}

function startRendererScripts() {
  return new Promise((resolve, reject) => {
    // mainConfig.entry.main = [path.join(__dirname, '../src/main/index.dev.js')].concat(mainConfig.entry.main)
    // mainConfig.mode = 'development'
    const compiler = webpack(rendererScriptConfig)

    compiler.watch({}, (err, stats) => {
      if (err) {
        console.log(err)
        return
      }
      resolve()
    })
  })
}

function startMain() {
  let firstRun = true
  return new Promise((resolve, reject) => {
    // mainConfig.entry.main = [path.join(__dirname, '../src/main/index.dev.js')].concat(mainConfig.entry.main)
    // mainConfig.mode = 'development'
    const runElectronDelay = debounce(startElectron, 200)
    const compiler = webpack(mainConfig)

    compiler.hooks.watchRun.tapAsync('watch-run', (compilation, done) => {
      hotMiddlewareRenderer.publish({ action: 'compiling' })
      hotMiddlewareRendererLyric.publish({ action: 'compiling' })
      done()
    })

    compiler.watch({}, (err, stats) => {
      if (err) {
        console.log(err)
        reject(err)
        return
      }

      // logStats('Main', stats)
      if (electronProcess) {
        electronProcess.removeAllListeners()
        treeKill(electronProcess.pid)
      }
      if (firstRun) {
        firstRun = false
        resolve()
      } else runElectronDelay()
    })
  })
}

function startElectron() {
  let args = [
    '--inspect=5858',
    // 'NODE_ENV=development',
    path.join(__dirname, '../dist_dev/main.cjs'),
  ]

  // detect yarn or npm and process commandline args accordingly
  if (process.env.npm_execpath && process.env.npm_execpath.endsWith('yarn.js')) {
    args = args.concat(process.argv.slice(3))
  } else if (process.env.npm_execpath && process.env.npm_execpath.endsWith('npm-cli.js')) {
    args = args.concat(process.argv.slice(2))
  }

  // WorkBuddy / VS Code are themselves Electron apps. Their integrated terminal
  // (and therefore `npm run dev`) inherits ELECTRON_RUN_AS_NODE=1 from the
  // parent Electron process. That env var makes the spawned Electron binary boot
  // in pure-Node mode, so `require('electron')` returns the exe PATH STRING
  // instead of the API object -> `electron-is-dev` throws
  // "Not running in an Electron environment!". Strip it so Electron runs normally.
  const electronEnv = { ...process.env }
  delete electronEnv.ELECTRON_RUN_AS_NODE

  electronProcess = spawn(electron, args, { env: electronEnv })

  electronProcess.stdout.on('data', data => {
    electronLog(data, 'blue')
  })
  electronProcess.stderr.on('data', data => {
    electronLog(data, 'red')
  })

  electronProcess.on('close', () => {
    process.exit()
  })
}

const logs = [
  'Manifest version 2 is deprecated, and support will be removed in 2023',
  '"Extension server error: Operation failed: Permission denied", source: devtools://devtools/bundled',

  // https://github.com/electron/electron/issues/32133
  '"Electron sandbox_bundle.js script failed to run"',
  '"TypeError: object null is not iterable (cannot read property Symbol(Symbol.iterator))",',
]
function electronLog(data, color) {
  let log = data.toString()
  if (/[0-9A-z]+/.test(log)) {
    // 抑制某些无关的报错日志
    if (color == 'red' && typeof log === 'string' && logs.some(l => log.includes(l))) return

    console.log(chalk[color](log))
  }
}

function init() {
  const Spinnies = require('spinnies')
  const spinners = new Spinnies({ color: 'blue' })
  spinners.add('main', { text: 'main compiling' })
  spinners.add('renderer', { text: 'renderer compiling' })
  spinners.add('renderer-lyric', { text: 'renderer-lyric compiling' })
  spinners.add('renderer-scripts', { text: 'renderer-scripts compiling' })
  function handleSuccess(name) {
    spinners.succeed(name, { text: name + ' compile success!' })
  }
  function handleFail(name) {
    spinners.fail(name, { text: name + ' compile fail!' })
  }
  replaceLib({ electronPlatformName: process.platform, arch: Arch[process.arch] })

  Promise.all([
    startRenderer().then(() => handleSuccess('renderer')).catch((err) => {
      console.error(err.message)
      return handleFail('renderer')
    }),
    startRendererLyric().then(() => handleSuccess('renderer-lyric')).catch((err) => {
      console.error(err.message)
      return handleFail('renderer-lyric')
    }),
    startRendererScripts().then(() => handleSuccess('renderer-scripts')).catch((err) => {
      console.error(err.message)
      return handleFail('renderer-scripts')
    }),
    startMain().then(() => handleSuccess('main')).catch(() => handleFail('main')),
  ]).then(startElectron).catch(err => {
    console.error(err)
  })
}

init()
