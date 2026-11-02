//
// The format probe's prompt (sceneProjection SP-8): one fixed frame around the scene and the question, shared by every
// format, so the probe compares the representation of nesting alone.
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
 */
const OPEN_ANSWER_FORMAT = [
    'Think it through first, under any of these headings that help, with short notes under each:',
    '"Constraints" (what the scene fixes in place), "Blockers" (what stands in the way of what is asked),',
    '"Opportunities" (what the scene offers that could serve it).',
    'Each constraint or blocker you note must be solved, with what is here, or else it stands: do not wave one away as maybe unimportant.',
    'Then answer: explain briefly, then list the changes it would cause, if any, as short steps in any notation you like.',
    'Name each thing by its handle in square brackets, for example [a1].',
].join(' ')

/**
 * The grounding every format shares (user, 2026-11-02): the scene is what has been established and wins over general
 * knowledge, which fills in what things are like and what can be done with them. Without it Nova Micro answered "can you
 * pour tea" from what teapots are usually like and picked up a teapot the scene records as secured. The examples match no
 * fixture, so they teach the precedence without giving away a rubric's answer, and stay off tableware: "a lid can be
 * lifted" had Nova Micro lifting lids on teaTable's teapot and saucer, neither of which the scene gives a lid. The
 * register is a puzzle-solver's, not everyday life's (user, 2026-11-02): asked what someone could "reasonably" do, both
 * Nova models held to the teapot as the way to pour, past a glue that blocked it, and never offered the cup's tea.
 */
const GROUNDING = [
    'You are the reasoner for a game world, working as a game master would. The scene below is what has been established about this place: what is here, where each thing is placed, and how things are connected. Everything it records is true, and nothing that isn\'t recorded is present.',
    '',
    'Beyond that, use what you know about the world: what things are like and what they could physically be used for. Think like a player solving a puzzle, not necessarily like someone going about their daily life: anything here can be used for anything it could do, not only what it is usually for, and when the obvious way is blocked, look for another way with what is here before saying what would have to change. Where your general knowledge and the scene disagree, the scene wins. A chair can usually be moved, but one secured to the floor stays until it is freed. If what someone wants is blocked, say what blocks it and what would have to change first.',
    '',
    'A thing on or in another moves with it.',
].join('\n')

/** The one frame every format shares: the scene text differs, nothing else does. */
export const probePrompt = (sceneText: string, question: SceneQuestion): string => [
    GROUNDING,
    '',
    'The scene, as I (the player) perceive it. Things are named by handles in square brackets.',
    '',
    sceneText,
    '',
    `Question: ${questionText(question)}`,
    question.type === 'open' ? OPEN_ANSWER_FORMAT : ANSWER_FORMAT,
].join('\n')
