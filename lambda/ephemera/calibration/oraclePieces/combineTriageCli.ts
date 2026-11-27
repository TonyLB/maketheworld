//
// Grades the split from saved batches (`triageCombine.ts`): the branch-only arm's results, paired by cell and repeat with a whole triage
// batch's, read for its grounding. Prints each pair, then the bar's counts as JSON. From lambda/ephemera:
//
//   npm run combine-triage -- <triageBranch results.json>... --grounding <triage results.json>...
//
import { readFileSync } from 'fs'
import type { PieceCall } from '../pieceProbe/runPieceProbe'
import { combinedSummary, combinedText, combineTriage } from './triageCombine'

const USAGE = 'usage: npm run combine-triage -- <triageBranch results.json>... --grounding <triage results.json>...'

const args = process.argv.slice(2)
const split = args.indexOf('--grounding')
const branchPaths = split === -1 ? [] : args.slice(0, split)
const groundingPaths = split === -1 ? [] : args.slice(split + 1)
if (branchPaths.length === 0 || groundingPaths.length === 0) {
    console.error(USAGE)
    process.exit(1)
}

/** A saved response's calls, its piece checked. The body is a JSON string or an object, depending on how it was saved. */
const callsOf = (path: string, piece: string): PieceCall[] => {
    const results = JSON.parse(readFileSync(path, 'utf8'))
    const body = typeof results.body === 'string' ? JSON.parse(results.body) : results.body ?? results
    if (body.piece !== piece) {
        console.error(`${path}: piece ${JSON.stringify(body.piece)}, where ${piece} is expected`)
        process.exit(1)
    }
    if (!Array.isArray(body.read)) {
        console.error(`${path}: no "read"`)
        process.exit(1)
    }
    return body.read
}

const branchCalls = branchPaths.flatMap((path) => callsOf(path, 'triageBranch'))
const groundingCalls = groundingPaths.flatMap((path) => callsOf(path, 'triage'))
// Building a fixture's scene logs, so its console output is dropped and the pairs written straight to stdout.
console.log = () => {}
console.info = () => {}
combineTriage(branchCalls, groundingCalls).then((pairs) => {
    process.stdout.write(`${combinedText(pairs)}\n\n${JSON.stringify(combinedSummary(pairs), null, 2)}\n`)
}).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
