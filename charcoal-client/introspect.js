const fs = require('fs')
const { exec } = require('child_process')

const args = process.argv.slice(2)

if (!args.length) {
    console.error('No stack name provided')
    process.exit(1)
}

const argument = args[0]

//
// For some reason, running the command through node results in UTF-8 output, while running it at the command line results in UTF-16LE.
// Not gonna complain!
//
const command = `aws cloudformation describe-stacks --output json --query "Stacks[0].Outputs" --stack-name ${argument} > src/config.json"`

exec(command, (error) => {
    if (error) {
        console.error(error)
        process.exit(1)
    }
    // let content = fs.readFileSync('src/rawConfig.json', { encoding: 'utf16le' })
    // fs.writeFileSync('src/config.json', content, { encoding: 'utf8' })
})

