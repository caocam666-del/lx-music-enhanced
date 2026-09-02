const Module = require('module');
console.log('builtin has electron:', Module.builtinModules.includes('electron'));
console.log('process.versions.electron:', process.versions.electron);
try {
  const e = require('electron');
  console.log('typeof e =', typeof e, '| app?', !!e.app, '| ipcRenderer?', !!e.ipcRenderer);
  console.log('e keys sample:', e && Object.keys(e).slice(0, 8));
} catch (err) {
  console.log('require electron ERR:', err.message);
}
try {
  console.log('resolve electron =>', require.resolve('electron'));
} catch (err) {
  console.log('resolve ERR:', err.message);
}
process.exit(0);
