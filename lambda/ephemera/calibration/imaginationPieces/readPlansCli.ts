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

const PLANS_TEXT: Record<string, (groups: readonly ReadGroup[]) => string> = { playByPlay: playByPlayPlansText, consequences: consequencesPlansText }

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
console.log(text(body.read))
