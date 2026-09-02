const fs = require('fs');
console.log('fs typeof =', typeof fs, '| readdir?', typeof fs.readdirSync);
console.log('immediate require(electron) typeof =', typeof require('electron'));

const electron = require('electron');
// try to reach internal binding in case the public module is shadowed
try {
  const b = process.electronBinding ? process.electronBinding('app') : null;
  console.log('process.electronBinding(app) ok?', !!b);
} catch (e) { console.log('electronBinding err:', e.message); }

if (electron && typeof electron.app !== 'undefined' && electron.app) {
  electron.app.whenReady().then(() => {
    console.log('inside whenReady require(electron).app?', !!require('electron').app);
    process.exit(0);
  });
} else {
  // fake app isn't available; exit
  process.exit(0);
}
// safety timeout
setTimeout(() => process.exit(0), 8000);
