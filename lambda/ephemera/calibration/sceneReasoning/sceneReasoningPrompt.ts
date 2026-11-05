//
// The scene-reasoning probe's prompt (sceneProjection SP-8): the frame is composed from the layer modules in
// `dataSource/actions/sceneProse/frame/` (lifted out of this folder, Slice 6, with no wording change); what stays here is the
// probe's own part, the typed question wording and the reading-question answer format its match flag depends on. The frame's
// wording was tuned against both Nova models in the SP-7 batches, one run per wording, and none of it is settled. Later batches
// (2026-11-03, in the frame modules) showed single runs do not repeat and found faults the frame itself may cause.
//
import type { SceneQuestion } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { GROUNDING, composeJudgePrompt, OPEN_ANSWER_FORMATS, defaultAnswerFormat, scenePrompt, type AnswerFormat } from '../../dataSource/actions/sceneProse/frame'

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
 * The one frame: the scene text and the question differ, and an `open` question's answer format when the probe varies it. The `judge`
 * answer format is the judge prompt (`frameJudge.ts`), which wants the `judge` scene format and a request in the player's words.
 */
export const probePrompt = (sceneText: string, question: SceneQuestion, answerFormat: AnswerFormat = defaultAnswerFormat): string => (
    question.type === 'open' && answerFormat === 'judge'
        ? composeJudgePrompt({ sceneText, request: questionText(question) })
        : controlPrompt(sceneText, question, answerFormat)
)

const controlPrompt = (sceneText: string, question: SceneQuestion, answerFormat: AnswerFormat): string => scenePrompt({
    frame: GROUNDING,
    sceneText,
    question: questionText(question),
    answer: question.type === 'open' ? OPEN_ANSWER_FORMATS[answerFormat] : ANSWER_FORMAT,
})
