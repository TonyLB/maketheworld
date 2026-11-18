//
// Assembles an imagination ask's draft instructions from two parts: the ask's own part (its Role, examples and Task, with one `{{core}}`
// line) and a version of the shared core (AGENT.imagination.planning.md, step 1). Each part gets its own hash, by the probe's `textHash`,
// so a draft's notes can say which part changed and so what it costs to test. Run from the command line through `assembleDraftCli.ts`.
// A draft with no core (AGENT.actionPlan.planning.md, step 4a: the explicit render needs no reading guide) is an ask with no slot, and its
// core hash is `none`.
//
import { textHash } from '../textHash'

export const CORE_SLOT = '{{core}}'

export type AssembledDraft = {
    instructions: string
    hashes: { ask: string, core: string, instructions: string }
}

/** A part as read from its file, without one trailing newline: the probe's instructions are sent without it. */
const asPart = (text: string): string => text.replace(/\n$/, '')

/** The core hash of a draft with no core. */
export const NO_CORE = 'none'

/**
 * The instructions, with the core in the ask's one slot, and the hashes of each; or a refusal when the ask hasn't exactly one slot. With
 * no core, the ask is the instructions, and is refused if it has a slot.
 */
export const assembleDraft = (askText: string, coreText: string | undefined): AssembledDraft | string => {
    const ask = asPart(askText)
    const slots = ask.split(CORE_SLOT).length - 1
    if (coreText === undefined) {
        return slots === 0
            ? { instructions: ask, hashes: { ask: textHash(ask), core: NO_CORE, instructions: textHash(ask) } }
            : `with no core, the ask's part must have no ${CORE_SLOT} line, and has ${slots}`
    }
    const core = asPart(coreText)
    if (slots !== 1) {
        return `the ask's part must have exactly one ${CORE_SLOT} line, and has ${slots}`
    }
    const instructions = ask.replace(CORE_SLOT, core)
    return { instructions, hashes: { ask: textHash(ask), core: textHash(core), instructions: textHash(instructions) } }
}
