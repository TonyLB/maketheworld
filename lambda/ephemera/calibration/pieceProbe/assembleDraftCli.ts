//
// Writes a PieceProbe payload from an ask's part and a core version, and prints each part's hash (assembleDraft.ts). From lambda/ephemera:
//
//   npm run assemble-draft -- <ask.txt> <core.txt> <out.json> --piece <name> [--repeats N] [--cells A,B] [--model M]
//
import { readFileSync, writeFileSync } from 'fs'
import { assembleDraft } from './assembleDraft'

const USAGE = 'usage: npm run assemble-draft -- <ask.txt> <core.txt> <out.json> --piece <name> [--repeats N] [--cells A,B] [--model M]'

function fail(message: string): never {
    console.error(message)
    process.exit(1)
}

const [askPath, corePath, outPath, ...rest] = process.argv.slice(2)
if (!askPath || !corePath || !outPath) {
    fail(USAGE)
}
const flags: Record<string, string | undefined> = Object.fromEntries(
    rest.flatMap((arg, index) => (arg.startsWith('--') ? [[arg.slice(2), rest[index + 1]]] : [])),
)
const piece = flags.piece ?? fail(`--piece is required\n${USAGE}`)

const assembled = assembleDraft(readFileSync(askPath, 'utf8'), readFileSync(corePath, 'utf8'))
if (typeof assembled === 'string') {
    fail(`${askPath}: ${assembled}`)
}
const { instructions, hashes } = assembled

const payload = {
    type: 'PieceProbe',
    piece,
    instructions,
    repeats: Number(flags.repeats ?? 3),
    model: flags.model ?? 'NovaMicro',
    ...(flags.cells ? { cells: flags.cells.split(',') } : {}),
}
writeFileSync(outPath, JSON.stringify(payload, null, 2))

console.log(`ask          ${hashes.ask}  ${askPath}`)
console.log(`core         ${hashes.core}  ${corePath}`)
console.log(`instructions ${hashes.instructions}  ${instructions.length} chars`)
console.log(`payload      ${outPath}`)
