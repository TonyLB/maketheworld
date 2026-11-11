//
// Assembles an imagination ask's draft instructions from two parts: the ask's own part (its Role, examples and Task, with one `{{core}}`
// line) and a version of the shared core (AGENT.imagination.planning.md, step 1). Each part gets its own hash, by the probe's `textHash`,
// so a draft's notes can say which part changed and so what it costs to test. Run from the command line through `assembleDraftCli.ts`.
//
import { textHash } from '../textHash'

export const CORE_SLOT = '{{core}}'

export type AssembledDraft = {
    instructions: string
    hashes: { ask: string, core: string, instructions: string }
}

/** A part as read from its file, without one trailing newline: the probe's instructions are sent without it. */
const asPart = (text: string): string => text.replace(/\n$/, '')

/** The instructions, with the core in the ask's one slot, and the hashes of each; or a refusal when the ask hasn't exactly one slot. */
export const assembleDraft = (askText: string, coreText: string): AssembledDraft | string => {
    const ask = asPart(askText)
    const core = asPart(coreText)
    const slots = ask.split(CORE_SLOT).length - 1
    if (slots !== 1) {
        return `the ask's part must have exactly one ${CORE_SLOT} line, and has ${slots}`
    }
    const instructions = ask.replace(CORE_SLOT, core)
    return { instructions, hashes: { ask: textHash(ask), core: textHash(core), instructions: textHash(instructions) } }
}
