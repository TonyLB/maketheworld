//
// Prints the consequence census of one or more `playByPlay` batches, read together (`planCensus`). From lambda/ephemera:
//
//   npm run plan-census -- <results.json> [<results.json> ...] [--list]
//
// `--list` adds every reply's consequences, under its cell.
//
import { readFileSync } from 'fs'
import type { ReadGroup } from '../pieceProbe/readPiece'
import { censusText, readGroups } from './planCensus'

const args = process.argv.slice(2)
const list = args.includes('--list')
const paths = args.filter((arg) => arg !== '--list')
if (paths.length === 0) {
    console.error('usage: npm run plan-census -- <results.json> [<results.json> ...] [--list]')
    process.exit(1)
}
const groupsOf = (path: string): ReadGroup[] => {
    const results = JSON.parse(readFileSync(path, 'utf8'))
    // As read-plans: the saved body is a JSON string or an object; a bare body is read as it is.
    const body = typeof results.body === 'string' ? JSON.parse(results.body) : results.body ?? results
    if (body.piece !== 'playByPlay' || !Array.isArray(body.read)) {
        console.error(`${path}: not a playByPlay batch with "read" groups`)
        process.exit(1)
    }
    return body.read
}
process.stdout.write(`${censusText(paths.flatMap((path) => readGroups(groupsOf(path))), { list })}\n`)
