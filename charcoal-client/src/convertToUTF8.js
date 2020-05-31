const fs = require('fs')

let content = fs.readFileSync('src/rawConfig.json', { encoding: 'utf16le' })
fs.writeFileSync('src/config.json', content, { encoding: 'utf8' })
