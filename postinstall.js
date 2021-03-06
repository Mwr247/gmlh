const fs = require('fs');
const path = require('path');

const modules = [
    'socket.io-client/dist/socket.io.js',
    'pixi.js/dist/pixi.min.js',
    'pixi-filters/dist/pixi-filters.js',
    'pixi-viewport/dist/viewport.js'
];

console.log('Postinstall: Copying modules');

// Create modules if non-existent
fs.mkdir('web/modules', {recursive: true}, error => {
    // Copy necessary node_modules to web folder
    modules.forEach(mod => {
        fs.copyFile('node_modules/' + mod, 'web/modules/' + path.basename(mod), err => {
            if (err) {throw err;}
        });
    });
});
