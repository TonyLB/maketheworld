//
// The job layer of the prompt frame (sceneProjection SP-11): how an open question is answered. Lifted verbatim from the probe's prompt.
//

import { NAME_BY_HANDLE } from './frameReading'
import { NOTATION } from './frameGraph'

/**
 * `plain` (retired) with only candidates' stopping rule (user and I, 2026-11-03): the nonsense batches had `plain` assume a lighter,
 * a match and a candle into the scene ("for the sake of this exercise") while `candidates` checked and answered "No
 * candidate"; `candidates` as a whole padded and over-blocked a feasible pour. So this keeps the check and the stop and
 * drops the candidate list, to see whether the stop is what helped.
 */
const ABSTAIN_ANSWER_FORMAT = [
    'First check that everything the request names is in the scene.',
    'If it names something that is not here, write "No candidate", say why in one sentence, and stop; do not assume it into existence.',
    `Otherwise, work out the way to do it, explain briefly, then list the changes it would cause, if any, as short steps. ${NOTATION}`,
    'If no way works, write "No candidate" and say what would have to change.',
    NAME_BY_HANDLE,
].join(' ')

/**
 * `abstain`'s check and stop, then the answer in two registers (user, 2026-11-03): what is done in the moment (an action, open
 * and in order, where feasibility lives) and what is different afterwards (the net edits that record it, closed and minimal).
 * `abstain` asks for "the changes it would cause ... as short steps", which blends the two: the pour that worked wrote
 * `(move [cup1] to held)`, `(move [tea1] to On floor)`, `(move [cup1] to On [saucer1])`, of which only the middle one is an edit
 * (the cup nets to nothing), and the stray `On table1` set-downs and the redundant tea move after its cup were actions written
 * as edits. Same legend (`MOVING`) as `abstain`, so the two are compared live on one prompt.
 * Revised after 5 pick-ups: the check echoed as the first line (5 of 5), the carried tea was lost in the fiction part (3 of 5), and
 * "What changes" came out as prose (4 of 5). So the check is a condition, the fiction part names what goes along and stays behind,
 * and each change line is notation only.
 * Then revised again after 3 pick-ups and 2 pours: the check and the carried tea held (echo 0 of 3, tea carried 3 of 3), but the
 * notation-only sentence lost the notation (prose edits, 5 of 5) and "what stays behind" brought the glued teapot back into the
 * fiction (4 of 5), while the carried tea became a redundant edit (3 of 3). So: the old edit wording, "what goes along" only, and
 * a clause that a carried thing is recorded by its carrier's move.
 */
const TWO_REGISTERS_ANSWER_FORMAT = [
    'If it names something that is not here, write "No candidate", say why in one sentence, and stop; do not assume it into existence.',
    'If everything the request names is in the scene, answer in two parts, beginning with the first.',
    'What happens: say in plain words, with no notation and in the order it happens, what would be done, using only what is here, and what goes along with it. If no way works, write "No candidate", say what would have to change, and stop.',
    `What changes: then list only what is different afterwards, one line for each thing whose own place changed; what went along with it is already recorded by its move. ${NOTATION}`,
    NAME_BY_HANDLE,
].join(' ')

/**
 * The judge's triage (user, 2026-11-04): a super-fast first check on an attempt. `simple` is judged possible and `impossible` is
 * judged not, with a reason the player would read. `complex` is no judgement at all: this check cannot settle it, so it goes
 * to a more capable judge, of which there is none yet (a pending challenge, the deferred tier, then Abstain; CA-6). The dry run
 * only vouches for the graph edits; whether the action is possible in the fiction is this answer's job, so `simple` has no
 * backstop there. Wording is untuned. The formats differ only in where the reasoning goes: none, one sentence before the label,
 * or one sentence after it only for `impossible`, which stays cheapest on the common path but cannot reason its way to the label.
 */
export const TRIAGE_LABELS = ['simple', 'complex', 'impossible'] as const

export type TriageLabel = typeof TRIAGE_LABELS[number]

export const isTriageLabel = (value: unknown): value is TriageLabel => TRIAGE_LABELS.includes(value as TriageLabel)

const TRIAGE_DEFINITIONS = [
    'Decide whether it can be done in this scene, and answer with one of three words.',
    '"simple": it can be done as stated.',
    '"complex": this needs more working out than a quick check can give.',
    '"impossible": it cannot be done.',
].join(' ')

const TRIAGE_LABEL_ANSWER_FORMAT = [TRIAGE_DEFINITIONS, 'Answer with only that one word.'].join(' ')

const TRIAGE_REASON_ANSWER_FORMAT = [TRIAGE_DEFINITIONS, 'Give one sentence of reason, then on its own line that one word.'].join(' ')

const TRIAGE_WHY_IMPOSSIBLE_ANSWER_FORMAT = [TRIAGE_DEFINITIONS, 'Answer with that word first. Only if it is "impossible", add one sentence saying why.'].join(' ')

/**
 * `headings` (Constraints, Blockers, Opportunities), `plain` (no scaffold) and `candidates` (a candidate list, with its own stop) were
 * retired 2026-11-03 (user): the headings never beat the plain control and cost the most output; `plain` assumed a missing candle
 * into the scene; `candidates` padded and over-blocked a feasible pour. Their findings stay in the scene-projection planning
 * file ("Frame and answer-format findings"); `abstain` is `plain` plus the stop rule `candidates` showed was useful.
 */
export type AnswerFormat = 'abstain' | 'twoRegisters' | 'triageLabel' | 'triageReason' | 'triageWhyImpossible'

/** How an `open` question asks to be answered; `twoRegisters` is the default. */
export const answerFormats: readonly AnswerFormat[] = ['abstain', 'twoRegisters', 'triageLabel', 'triageReason', 'triageWhyImpossible']

/**
 * What an `open` question uses when the probe names none: `twoRegisters` (user, 2026-11-03). It fixed the pour (the fiction
 * judges feasibility, the edits record only what changed) where `abstain`, the earlier default and the cheapest by output,
 * fixated on the glued teapot. `abstain` stays selectable as the comparison.
 */
export const defaultAnswerFormat: AnswerFormat = 'twoRegisters'

export const isAnswerFormat = (value: unknown): value is AnswerFormat => answerFormats.includes(value as AnswerFormat)

export const OPEN_ANSWER_FORMATS: Record<AnswerFormat, string> = {
    abstain: ABSTAIN_ANSWER_FORMAT,
    twoRegisters: TWO_REGISTERS_ANSWER_FORMAT,
    triageLabel: TRIAGE_LABEL_ANSWER_FORMAT,
    triageReason: TRIAGE_REASON_ANSWER_FORMAT,
    triageWhyImpossible: TRIAGE_WHY_IMPOSSIBLE_ANSWER_FORMAT,
}
