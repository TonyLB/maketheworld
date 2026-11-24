//
// Prints a CompositionProbe response's chains hop by hop, for reading against a rubric (chainsText.ts). From lambda/ephemera:
//
//   npm run read-chains -- <results.json> [--prompts]
//
// `--prompts` adds each live hop's rendered text.
//
import { readFileSync } from 'fs'
import { chainsText, readChains } from './chainsText'

const args = process.argv.slice(2)
const [resultsPath, ...others] = args.filter((arg) => arg !== '--prompts')
if (!resultsPath || others.length > 0) {
    console.error('usage: npm run read-chains -- <results.json> [--prompts]')
    process.exit(1)
}
const groups = readChains(JSON.parse(readFileSync(resultsPath, 'utf8')))
if (typeof groups === 'string') {
    console.error(`${resultsPath}: ${groups}`)
    process.exit(1)
}
process.stdout.write(`${chainsText(groups, { prompts: args.includes('--prompts') })}\n`)
