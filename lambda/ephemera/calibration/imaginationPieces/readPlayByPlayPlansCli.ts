//
// Prints the plans a playByPlay batch's replies build (`playByPlayPlansText`), for reading against its rubric. From lambda/ephemera:
//
//   npm run read-plans -- <results.json>
//
import { readFileSync } from 'fs'
import { playByPlayPlansText } from './playByPlay'

const [resultsPath] = process.argv.slice(2)
if (!resultsPath) {
    console.error('usage: npm run read-plans -- <results.json>')
    process.exit(1)
}
const results = JSON.parse(readFileSync(resultsPath, 'utf8'))
// The saved response's body is a JSON string or an object, depending on how it was saved; a bare body is read as it is.
const body = typeof results.body === 'string' ? JSON.parse(results.body) : results.body ?? results
if (!Array.isArray(body.read)) {
    console.error(`${resultsPath}: no "read" groups; is this a playByPlay response?`)
    process.exit(1)
}
console.log(playByPlayPlansText(body.read))
