//
// Writes a CompositionProbe payload from each live piece's draft, and prints each part's hash (assembleChain.ts). From lambda/ephemera:
//
//   npm run assemble-chain -- <out.json> --piece <name> <ask.txt> <core.txt | -> [--piece ...] [--options <piece> JSON] [--mocks judge]
//       [--cases A,B] [--repeats N] [--model M]
//
// `-` for a core assembles a draft with no core. `--mocks` names the pieces each case's own mock stands in for. Repeats default to 3.
//
import { readFileSync, writeFileSync } from 'fs'
import { assembleChain } from './assembleChain'

const assembled = assembleChain(process.argv.slice(2), (path) => readFileSync(path, 'utf8'))
if (typeof assembled === 'string') {
    console.error(assembled)
    process.exit(1)
}
const { out, payload, drafts } = assembled
writeFileSync(out, JSON.stringify(payload, null, 2))

drafts.forEach(({ piece, ask, core, draft: { instructions, hashes } }) => {
    console.log(piece)
    console.log(`  ask          ${hashes.ask}  ${ask}`)
    console.log(`  core         ${hashes.core}  ${core === '-' ? '(no core)' : core}`)
    console.log(`  instructions ${hashes.instructions}  ${instructions.length} chars`)
})
console.log(`payload        ${out}`)
