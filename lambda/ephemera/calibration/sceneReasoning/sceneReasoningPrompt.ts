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

/**
 * For an `open` question: reasoning wanted, and the changes in whatever notation the reader likes. The headings are our
 * own chain of reasoning, offered rather than required, ahead of the answer so the answer can draw on them (user,
 * 2026-11-02: in place of a model's built-in reasoning, which Nova Micro lacks). A noted blocker must be solved or
 * stand (user, 2026-11-02): Nova 2 Lite listed the glue, then poured anyway, the teapot "fixed but functional" or
 * assumed to have "a spout that can reach".
 *
 * 2026-11-03: the changes line asks for the `(move X to On/In Y)` notation (MOVING, below) for any move; the first batch under MOVING
 * had every answer write its changes in prose, so the notation was untested. Batches before this edit are not comparable.
 *
 * Suspected faults, untested (Nova Micro on `teaTable`, 2026-11-03), so this wording is a hypothesis, not a finding:
 * - Asked to pour [tea1] into [saucer1], Micro filed "[cup1] is on [saucer1]" under Constraints or Blockers in every
 *   failing answer, then could not get past it ("already in place", "an intermediary container") and answered no. The
 *   Constraints gloss "what the scene fixes in place" invites listing every placement as fixed, and solve-or-stand then
 *   lets an unsolved one stand. The grounding's chair (moved unless secured) separates placing from securing; this gloss
 *   undoes it. Candidate fix: say a thing merely on or in another is not fixed.
 * - Micro also edited the scene as a tree, not a world: lifting [cup1] left "[tea1] on [saucer1] directly", as a node's
 *   child is reparented when the node is removed (and elsewhere "place [tea1] on the floor"; Lite: "[cup1] is no longer
 *   on [saucer1] but still in it"). Suspects: every substance gets its own handled line, the outline layout reads as data,
 *   and "name each thing by its handle ... list the changes" asks for a state diff. Asking for "the tea in [cup1]"
 *   instead of [tea1] answered correctly in one run.
 * - An instruction inside `asked` ("say in plain words, without handles, what you would physically do") was ignored in
 *   both repeats: this frame, which comes after the question, wins. Test a frame change by changing the frame.
 */
const HEADINGS_ANSWER_FORMAT = [
    'Think it through first, under any of these headings that help, with short notes under each:',
    '"Constraints" (what the scene fixes in place), "Blockers" (what stands in the way of what is asked),',
    '"Opportunities" (what the scene offers that could serve it).',
    'Each constraint or blocker you note must be solved, with what is here, or else it stands: do not wave one away as maybe unimportant.',
    'Then answer: explain briefly, then list the changes it would cause, if any, as short steps. Write any move in the (move X to On Y) or (move X to In Y) notation above, and anything else in any notation you like.',
    'Name each thing by its handle in square brackets, for example [a1].',
].join(' ')

const NOTATION = 'Write any move in the (move X to On Y) or (move X to In Y) notation above, and anything else in any notation you like.'
const NAME_BY_HANDLE = 'Name each thing by its handle in square brackets, for example [a1].'

/** No scaffold: the control the headings were never compared against (user, 2026-11-03). */
const PLAIN_ANSWER_FORMAT = [
    `Explain briefly, then list the changes it would cause, if any, as short steps. ${NOTATION}`,
    NAME_BY_HANDLE,
].join(' ')

/**
 * Constraints and blockers per candidate (user, 2026-11-03), so each is relative to a way of doing the thing, not a restating of
 * the scene. Zero is a first-class outcome in two separate cases: no candidate at all (the request names what is not here, or
 * cannot be done with anything here) and every candidate blocked (what would have to change first), so a nonsense request is
 * neither "solved" with invented means nor forced into a list. "No candidate" with a reason mirrors the pipeline's Abstain.
 */
const CANDIDATES_ANSWER_FORMAT = [
    'First decide what is being asked, and list the candidate ways to do it using only what is here.',
    'There may be none: if what is asked names something that is not here, or cannot be done with anything here, write "No candidate" and say why in one sentence, and stop.',
    'Otherwise, for each candidate, note under "Constraints" any fact in the scene that limits what can be done with a thing it uses, and under "Blockers" any constraint that actually stands in the way of this candidate.',
    'A blocker must be solved, with what is here, or else that candidate is blocked and you move to another.',
    'If every candidate is blocked, say what would have to change first, and stop.',
    'Otherwise choose the best candidate and answer: explain briefly, then list the changes it would cause as short steps.',
    NOTATION,
    NAME_BY_HANDLE,
].join(' ')

/**
 * `plain` with only candidates' stopping rule (user and I, 2026-11-03): the nonsense batches had `plain` assume a lighter,
 * a match and a candle into the scene ("for the sake of this exercise") while `candidates` checked and answered "No
 * candidate"; `candidates` as a whole padded and over-blocked a feasible pour. So this keeps the check and the stop and
 * drops the candidate list, to see whether the stop is what helped.
 */
const ABSTAIN_ANSWER_FORMAT = [
    'First check that everything the request names is in the scene, and that it can be done with what is here.',
    'If it names something that is not here, or cannot be done with anything here, write "No candidate", say why in one sentence, and stop; do not assume it into existence.',
    `Otherwise, explain briefly, then list the changes it would cause, if any, as short steps. ${NOTATION}`,
    NAME_BY_HANDLE,
].join(' ')

export type AnswerFormat = 'headings' | 'plain' | 'candidates' | 'abstain'

/** How an `open` question asks to be answered; `headings` is the original, `abstain` the default. */
export const answerFormats: readonly AnswerFormat[] = ['headings', 'plain', 'candidates', 'abstain']

/**
 * What an `open` question uses when the probe names none: `abstain` (user, 2026-11-03), the cheapest by output and the only
 * one of the four to stop on a request for something not here without padding or over-blocking a feasible one. Single
 * samples, so the others stay selectable until SP-10 decides which survive.
 */
export const defaultAnswerFormat: AnswerFormat = 'abstain'

export const isAnswerFormat = (value: unknown): value is AnswerFormat => answerFormats.includes(value as AnswerFormat)

const OPEN_ANSWER_FORMATS: Record<AnswerFormat, string> = {
    headings: HEADINGS_ANSWER_FORMAT,
    plain: PLAIN_ANSWER_FORMAT,
    candidates: CANDIDATES_ANSWER_FORMAT,
    abstain: ABSTAIN_ANSWER_FORMAT,
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
 */
const MOVING = 'Moving things. In the records, (move X to On Y) or (move X to In Y) puts X on or in Y, using the same "on" and "in" the scene\'s lines use. For the room write In room, and for what you hold write held. Whatever is on or in X goes with X, all the way down, but not the other way round: whatever X was on or in stays where it was, and only loses X. In the world this is simply how things go: a thing carries whatever sits on or in it. A fish in a bucket goes wherever the bucket goes, but picking up the bucket does not pick up the dock it stood on. So to carry something, move only the thing you pick up. Never move its contents separately, and never expect what it was resting on to come along.'

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
 */
const GROUNDING = [
    'You are the reasoner for a game world, working as a game master would. The scene below is what has been established about this place: what is here, where each thing is placed (for example on or in something, or held), and what other relations it has to another thing, such as being tied or glued to it. Everything it records is true, and nothing that isn\'t recorded is present.',
    '',
    'Beyond that, use what you know about the world: what things are like and what they could physically be used for. Think like a player solving a puzzle, not necessarily like someone going about their daily life: anything here can be used for anything it could do, not only what it is usually for, and when the obvious way is blocked, look for another way with what is here before saying what would have to change. Where your general knowledge and the scene disagree, the scene wins. A chair can usually be moved, but one secured to the floor stays until it is freed. If what someone wants is blocked, say what blocks it and what would have to change first.',
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
