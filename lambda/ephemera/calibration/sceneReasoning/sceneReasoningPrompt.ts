//
// The scene-reasoning probe's prompt (sceneProjection SP-8): one fixed frame around the scene and the question. Its
// grounding and open-answer wording were tuned against both Nova models in the SP-7 batches, one run per wording; the
// first production prompt to read the scene should start from them, but none of it is settled. Later batches (2026-11-03,
// below and on OPEN_ANSWER_FORMAT) showed single runs do not repeat and found faults the frame itself may cause.
//
import type { SceneQuestion } from '../../dataSource/positions/ludicCache/sceneFixtures'

const ref = (handle: string): string => `[${handle}]`

/**
 * The question in words: its own `asked` wording if it has one, else words for its type, naming things by handle.
 * "Directly" alone, or a "(not inside or on anything else)" aside, drew whole chains or "none" from Nova Micro in every
 * format; asking for the nearest thing and excluding what is on or in that did not.
 */
export const questionText = (question: SceneQuestion): string => {
    if (question.asked !== undefined) {
        return question.asked
    }
    switch (question.type) {
        case 'directContents':
            return question.subject === undefined
                ? 'What is in the room? List only what sits directly in it, not things on or in those.'
                : `What is on or in ${ref(question.subject)}? List only what sits directly on or in it, not things on or in those.`
        case 'placedOn': return `What is ${ref(question.subject)} in or on? Name only the nearest thing, not what that thing is in or on.`
        case 'chainOut': return `Starting with the nearest thing ${ref(question.subject)} is in or on, list every place out to the room, in order.`
        case 'whereIs': return `Where is every part of ${ref(question.subject)}?`
        case 'movesWith': return `If I pick up ${ref(question.subject)}, what else comes with it?`
        case 'held': return 'What am I holding?'
        case 'relatedTo': return `What is ${ref(question.subject)} ${question.label}?`
        case 'relatedFrom': return `What is ${question.label} ${ref(question.target)}?`
        case 'securedTo': return `What is secured to ${ref(question.target)}?`
        case 'associatedWith': return `What is ${ref(question.subject)} associated with, or what is associated with it?`
        case 'howMany': return `How many things are called "${question.name}"?`
        case 'open': return question.asked
    }
}

const ANSWER_FORMAT = [
    'Answer with only the answer, no explanation.',
    'Name each thing by its handle in square brackets, separated by commas, for example: [a1], [b2].',
    'For the room itself write "room"; for what I hold write "held".',
    'If the answer is nothing, write "none". If the answer is a count, write only the number.',
].join(' ')

const NOTATION = 'Write any move in the (move X to On Y) or (move X to In Y) notation above, and anything else in any notation you like.'
const NAME_BY_HANDLE = 'Name each thing by its handle in square brackets, for example [a1].'

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
 * `headings` (Constraints, Blockers, Opportunities), `plain` (no scaffold) and `candidates` (a candidate list, with its own stop) were
 * retired 2026-11-03 (user): the headings never beat the plain control and cost the most output; `plain` assumed a missing candle
 * into the scene; `candidates` padded and over-blocked a feasible pour. Their findings stay in the scene-projection planning
 * file ("Frame and answer-format findings"); `abstain` is `plain` plus the stop rule `candidates` showed was useful.
 */
export type AnswerFormat = 'abstain' | 'twoRegisters'

/** How an `open` question asks to be answered; `twoRegisters` is the default. */
export const answerFormats: readonly AnswerFormat[] = ['abstain', 'twoRegisters']

/**
 * What an `open` question uses when the probe names none: `twoRegisters` (user, 2026-11-03). It fixed the pour (the fiction
 * judges feasibility, the edits record only what changed) where `abstain`, the earlier default and the cheapest by output,
 * fixated on the glued teapot. `abstain` stays selectable as the comparison.
 */
export const defaultAnswerFormat: AnswerFormat = 'twoRegisters'

export const isAnswerFormat = (value: unknown): value is AnswerFormat => answerFormats.includes(value as AnswerFormat)

const OPEN_ANSWER_FORMATS: Record<AnswerFormat, string> = {
    abstain: ABSTAIN_ANSWER_FORMAT,
    twoRegisters: TWO_REGISTERS_ANSWER_FORMAT,
}

/**
 * How a move works (user's wording, 2026-11-03, SP-10): the first piece of an operation vocabulary, kept to broad strokes,
 * to bridge the fiction (things placed to move together) and the records (a subtree moves, its old host only loses it).
 * Added after the first multi-register batch (teaTable, "pick up [cup1]") showed the saucer coming with the cup in 10 of
 * 12 answers: the direction of "on" was reversed. The example avoids the fixtures' domain (tableware), as the grounding's
 * examples do. Batches before this paragraph are not comparable with batches after it.
 *
 * Reworded the same day (direction audit): "placed to move together" was mutual, and "on or in X ... on or in Y" crossed two
 * relations in one sentence, so the paragraph now says what is on or in X goes with X "but not the other way round". The
 * grounding's "how things are connected" went at the same time (models reasoned "because they are directly connected").
 * Reworded again (blocker ladder, user, 2026-11-03): "Never move its contents separately" contradicted pouring, which moves the tea alone, and the
 * ladder batch showed invented operators (`pour`) and a redundant move of the tea after its cup, so the paragraph now says what a move
 * stands for (any action ending in a new place: pick up, set down, pour) and that one move carries the contents.
 * Tried and taken out (2026-11-03): "To get only part of what it holds out, move that part: to tip a fish out of a bucket onto the dock...".
 * With it, three pours all fixated on the glued teapot (one invented a mug) and one pick-up lifted the saucer and table; the example's
 * bucket, or "what it holds" (the teapot holds tea too), are the suspects, not separated.
 * Then rewritten as two registers (user, 2026-11-03): the world paragraph speaks of results, not actions ("different actions with the same result
 * are the same change"), kept to the recording side ("once you know what would happen") so it grants no feasibility, and the records
 * paragraph speaks only of the graph. Its far-domain example (a crate, a shed, a cart) avoids the fixtures' tableware.
 * Left out on purpose (user, 2026-11-03): how to move a thing and not its contents (move the contents to the thing's host first).
 * No run has needed it, and it describes the end state the model reached by mistake (the tea left on the saucer); parked.
 */
const MOVING = 'Moving things. Once you know what would happen, the records keep only what is different afterwards, and for a move that is where things are. A crate carried to the shed, or dragged there, or pushed there, leaves the same result: the crate is in the shed, and what was in or on the crate is in the shed with it, but the cart it stood on has not moved. Different actions with the same result are the same change.\n\nIn the records, (move X to On Y) or (move X to In Y) records that X is now on or in Y, using the same "on" and "in" the scene\'s lines use. For the room write In room, and for what you hold write held. What was on or in X stays on or in it, and what X left only loses X. So once you have worked out where things end up, write one move for each thing whose own place changed, not for the things carried along with it.'

/**
 * The grounding (user, 2026-11-02): the scene is what has been established and wins over general
 * knowledge, which fills in what things are like and what can be done with them. Without it Nova Micro answered "can you
 * pour tea" from what teapots are usually like and picked up a teapot the scene records as secured. The examples match no
 * fixture, so they teach the precedence without giving away a rubric's answer, and stay off tableware: "a lid can be
 * lifted" had Nova Micro lifting lids on teaTable's teapot and saucer, neither of which the scene gives a lid. The
 * register is a puzzle-solver's, not everyday life's (user, 2026-11-02): asked what someone could "reasonably" do, both
 * Nova models held to the teapot as the way to pour, past a glue that blocked it, and never offered the cup's tea.
 * A closing line "A thing on or in another moves with it." was dropped (2026-11-03, reopened SP-7) to test whether it
 * caused D's ancestor-chain answers to "what is X in or on". Without it the chains went away on teaTable and stayed on
 * sideboard (SP-7 batches 8 and 9), so it is not their cause; restore it if lifting questions show it was needed.
 *
 * Reworked 2026-11-03 (user), after the render comparison under `abstain` over-moved things the request never touched (the
 * saucer, the glued teapot, to "clear the table") and invented operators. Cause suspected in this block, not a belief of
 * the model's: it assumed a blocker ("when the obvious way is blocked", "if what someone wants is blocked, say what
 * blocks it") and never said "nothing blocks it" is a result. A negative added to that would not have worked, so the
 * procedure is now an ordered, all-positive ladder: the simplest steps, checked step by step (a blocker belongs to a step,
 * not to a thing, and is the scene's or the world's: a tie, or a motorcycle that cannot fit a shoebox); then freeing what
 * stops a step; only then the puzzle-solver's inventive paths. "Stop at the first step that gives an answer" and "give the
 * steps you take, not this order" guard against the model writing every rung out, as `headings` and `candidates` did.
 * The precedence line is by register: the scene is authoritative about what is here and how it is placed, the world about
 * what follows from that, and the records' layout is notation, not a rule about what moves (suspected: "the scene wins"
 * made a misread graph outrank correct physics). The ladder, the precedence line and the MOVING edit went in together, so
 * their shares are not separable. Batches before this edit are not comparable with batches after it.
 */
const GROUNDING = [
    'You are the reasoner for a game world, working as a game master would. The scene below is what has been established about this place: what is here, where each thing is placed (for example on or in something, or held), and what other relations it has to another thing, such as being tied or glued to it. Everything it records is true, and nothing that isn\'t recorded is present.',
    '',
    'Beyond that, use what you know about the world: what things are like and what they could physically be used for. The scene tells you what is here and how it is placed; it is true. What follows from that, what goes with what and what a thing can be used for, comes from how things are in the world. Where your knowledge and the scene disagree about what is here or how it is placed, the scene wins. The records are the way to write it down, and their layout is not a rule about what moves. A chair can usually be moved, but one secured to the floor stays until it is freed.',
    '',
    'To work out how to do what someone asks, go in this order, and stop at the first step that gives an answer.',
    '1. Take the simplest way to do it: the steps, using only the things the request involves. For each step, ask whether anything stops it: something the scene records, such as being tied or glued, or something about the things themselves, such as a motorcycle that cannot fit in a shoebox. If nothing stops any step, those steps are your answer.',
    '2. If something stops a step, ask whether freeing or removing that one thing, and then taking the same steps, works. If so, that is your answer.',
    '3. If not, think like a player solving a puzzle: the obstacle may suggest another way, using anything here for anything it could do, not only what it is usually for. If you find one, that is your answer; if there is none, say what would have to change first.',
    'When you give the steps, give the steps you take, not this order.',
    '',
    MOVING,
].join('\n')

/** The one frame: the scene text and the question differ, and an `open` question's answer format when the probe varies it. */
export const probePrompt = (sceneText: string, question: SceneQuestion, answerFormat: AnswerFormat = defaultAnswerFormat): string => [
    GROUNDING,
    '',
    'The scene, as I (the player) perceive it. Things are named by handles in square brackets.',
    '',
    sceneText,
    '',
    `Question: ${questionText(question)}`,
    question.type === 'open' ? OPEN_ANSWER_FORMATS[answerFormat] : ANSWER_FORMAT,
].join('\n')
