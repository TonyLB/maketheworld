//
// Assembles a CompositionProbe payload from each live piece's draft (calibration AGENT.md, "Composition probe"), each draft put together as
// the piece probe's are (`assembleDraft`), with its hashes. The payload is checked as the event's handler checks it, so one the Lambda would
// refuse is refused here. Run from the command line through `assembleChainCli.ts`.
//
import { assembleDraft, type AssembledDraft } from '../pieceProbe/assembleDraft'
import { prepareCompositionProbe, type CompositionProbeEvent } from './handleCompositionProbe'

export const ASSEMBLE_CHAIN_USAGE = 'usage: npm run assemble-chain -- <out.json> --piece <name> <ask.txt> <core.txt | -> [--piece ...] [--options <piece> JSON] [--mocks judge] [--cases A,B] [--repeats N] [--model M]'

/** A live piece's draft as named on the command line; a core of `-` is a draft with no core. */
export type DraftPaths = { piece: string; ask: string; core: string }

export type AssembledChain = { out: string; payload: CompositionProbeEvent; drafts: (DraftPaths & { draft: AssembledDraft })[] }

type Asked = { drafts: DraftPaths[]; options: Record<string, unknown>; mocks?: string; cases?: string; repeats?: string; model?: string }

/** How many values each flag takes. */
const ARITY: Record<string, number> = { '--piece': 3, '--options': 2, '--mocks': 1, '--cases': 1, '--repeats': 1, '--model': 1 }

const readOptions = (text: string): { value: unknown } | string => {
    try {
        return { value: JSON.parse(text) }
    } catch {
        return `--options is not JSON: ${text}`
    }
}

/** The flags after the output path, read in order, or a refusal. */
const readFlags = (args: readonly string[], asked: Asked = { drafts: [], options: {} }): Asked | string => {
    if (args.length === 0) {
        return asked
    }
    const [flag, ...rest] = args
    const arity = Object.keys(ARITY).includes(flag) ? ARITY[flag] : undefined
    const values = rest.slice(0, arity)
    if (arity === undefined || values.length < arity || values.some((value) => value.startsWith('--'))) {
        return arity === undefined ? `${flag} isn't a flag` : `${flag} takes ${arity} value${arity === 1 ? '' : 's'}`
    }
    const [first, second, third] = values
    const after = rest.slice(arity)
    if (flag === '--piece') {
        return asked.drafts.some(({ piece }) => piece === first) ? `--piece ${first} is given twice` : readFlags(after, { ...asked, drafts: [...asked.drafts, { piece: first, ask: second, core: third }] })
    }
    if (flag === '--options') {
        const options = readOptions(second)
        return typeof options === 'string' ? options : readFlags(after, { ...asked, options: { ...asked.options, [first]: options.value } })
    }
    return readFlags(after, { ...asked, [flag.slice(2)]: first })
}

/** The payload a command line asks for, with each draft's hashes, or a refusal. `read` gives a file's text. */
export const assembleChain = (args: readonly string[], read: (path: string) => string): AssembledChain | string => {
    const [out, ...flags] = args
    if (!out || out.startsWith('--')) {
        return ASSEMBLE_CHAIN_USAGE
    }
    const asked = readFlags(flags)
    if (typeof asked === 'string') {
        return `${asked}\n${ASSEMBLE_CHAIN_USAGE}`
    }
    const stray = Object.keys(asked.options).find((name) => !asked.drafts.some(({ piece }) => piece === name))
    if (stray !== undefined) {
        return `--options names ${stray}, which no --piece does`
    }
    const assembled = asked.drafts.map((paths) => ({ paths, draft: assembleDraft(read(paths.ask), paths.core === '-' ? undefined : read(paths.core)) }))
    const refused = assembled.flatMap(({ paths, draft }) => (typeof draft === 'string' ? [`${paths.ask}: ${draft}`] : []))
    if (refused.length > 0) {
        return refused[0]
    }
    const drafts = assembled.flatMap(({ paths, draft }) => (typeof draft === 'string' ? [] : [{ ...paths, draft }]))
    const payload: CompositionProbeEvent = {
        type: 'CompositionProbe',
        pieces: Object.fromEntries(drafts.map(({ piece, draft: { instructions } }) => [
            piece, { instructions, ...(piece in asked.options ? { options: asked.options[piece] } : {}) },
        ])),
        mocks: asked.mocks === undefined ? [] : asked.mocks.split(','),
        repeats: Number(asked.repeats ?? 3),
        model: asked.model ?? 'NovaMicro',
        ...(asked.cases === undefined ? {} : { cases: asked.cases.split(',') }),
    }
    const prepared = prepareCompositionProbe(payload)
    return typeof prepared === 'string' ? prepared : { out, payload, drafts }
}
