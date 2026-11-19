//
// Prints the plans a batch's replies build, for reading against its rubric: `playByPlay`'s plans, or the plans `consequences`' changes
// merge into (`plansText`). The piece is the response's own `piece`. From lambda/ephemera:
//
//   npm run read-plans -- <results.json>
//
import { readFileSync } from 'fs'
import type { ReadGroup } from '../pieceProbe/readPiece'
import { consequencesPlansText } from './consequences'
import { playByPlayPlansText } from './playByPlay'

const PLANS_TEXT: Record<string, (groups: readonly ReadGroup[], options?: unknown) => Promise<string>> = { playByPlay: playByPlayPlansText, consequences: consequencesPlansText }

const [resultsPath] = process.argv.slice(2)
if (!resultsPath) {
    console.error('usage: npm run read-plans -- <results.json>')
    process.exit(1)
}
const results = JSON.parse(readFileSync(resultsPath, 'utf8'))
// The saved response's body is a JSON string or an object, depending on how it was saved; a bare body is read as it is.
const body = typeof results.body === 'string' ? JSON.parse(results.body) : results.body ?? results
const text = PLANS_TEXT[body.piece]
if (text === undefined) {
    console.error(`${resultsPath}: piece ${JSON.stringify(body.piece)} gives no plans; read-plans reads ${Object.keys(PLANS_TEXT).join(', ')}`)
    process.exit(1)
}
if (!Array.isArray(body.read)) {
    console.error(`${resultsPath}: no "read" groups`)
    process.exit(1)
}
// Each cell is rendered with the batch's own options, so the contract reads the prompt the batch was shown. Building a fixture's scene
// logs, so its console output is dropped and the plans written straight to stdout.
console.log = () => {}
console.info = () => {}
text(body.read, body.options).then((printed) => process.stdout.write(`${printed}\n`)).catch((error: unknown) => {
    console.error(`${resultsPath}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
})
