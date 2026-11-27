//
// Grades the split from saved batches (`triageCombine.ts`): the branch-only arm's results, paired by cell and repeat with a grounding
// batch's: the grounding alone (`triageGrounding`), or a whole triage batch, read for its grounding. The grounding batches' piece is read from
// their results, and must be one for all. Prints each pair, then the bar's counts as JSON. From lambda/ephemera:
//
//   npm run combine-triage -- <triageBranch results.json>... --grounding <triageGrounding or triage results.json>...
//
import { readFileSync } from 'fs'
import type { PieceCall } from '../pieceProbe/runPieceProbe'
import { combinedSummary, combinedText, combineTriage, type GroundingPiece } from './triageCombine'

const USAGE = 'usage: npm run combine-triage -- <triageBranch results.json>... --grounding <triageGrounding or triage results.json>...'

const args = process.argv.slice(2)
const split = args.indexOf('--grounding')
const branchPaths = split === -1 ? [] : args.slice(0, split)
const groundingPaths = split === -1 ? [] : args.slice(split + 1)
if (branchPaths.length === 0 || groundingPaths.length === 0) {
    console.error(USAGE)
    process.exit(1)
}

/** A saved response's calls, its piece checked against those allowed. The body is a JSON string or an object, depending on how it was saved. */
const callsOf = (path: string, allowed: readonly string[]): { piece: string; calls: PieceCall[] } => {
    const results = JSON.parse(readFileSync(path, 'utf8'))
    const body = typeof results.body === 'string' ? JSON.parse(results.body) : results.body ?? results
    if (!allowed.includes(body.piece)) {
        console.error(`${path}: piece ${JSON.stringify(body.piece)}, where ${allowed.join(' or ')} is expected`)
        process.exit(1)
    }
    if (!Array.isArray(body.read)) {
        console.error(`${path}: no "read"`)
        process.exit(1)
    }
    return { piece: body.piece, calls: body.read }
}

const branchCalls = branchPaths.flatMap((path) => callsOf(path, ['triageBranch']).calls)
const groundings = groundingPaths.map((path) => callsOf(path, ['triageGrounding', 'triage']))
const groundingPieces = [...new Set(groundings.map(({ piece }) => piece))]
if (groundingPieces.length !== 1) {
    console.error(`the grounding batches are from ${groundingPieces.join(' and ')}: give batches of one piece`)
    process.exit(1)
}
const groundingCalls = groundings.flatMap(({ calls }) => calls)
// Building a fixture's scene logs, so its console output is dropped and the pairs written straight to stdout.
console.log = () => {}
console.info = () => {}
combineTriage(branchCalls, groundingCalls, groundingPieces[0] as GroundingPiece).then((pairs) => {
    process.stdout.write(`${combinedText(pairs)}\n\n${JSON.stringify(combinedSummary(pairs), null, 2)}\n`)
}).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
