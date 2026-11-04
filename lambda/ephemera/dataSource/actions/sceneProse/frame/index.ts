/**
 * The prompt frame for an LLM that reads a scene (sceneProjection Slice 6): layer modules plus a composer. The probe in
 * `calibration/sceneReasoning/` composes its prompt from these; so will the first reader on a production path.
 */
import { LADDER, PRECEDENCE, SECURED_FICTION } from './frameFiction'
import { MOVING, SECURED_GRAPH } from './frameGraph'
import { READING, SECURED_DEFINITION } from './frameReading'
import { composeFrame } from './composeFrame'

export { composeFrame, scenePrompt } from './composeFrame'
export { LADDER, PRECEDENCE, SECURED_FICTION } from './frameFiction'
export { MOVING, NOTATION, SECURED_GRAPH } from './frameGraph'
export { NAME_BY_HANDLE, READING, SCENE_INTRO, SECURED_DEFINITION } from './frameReading'
export { answerFormats, defaultAnswerFormat, isAnswerFormat, isTriageLabel, OPEN_ANSWER_FORMATS, TRIAGE_LABELS, type AnswerFormat, type TriageLabel } from './answerFormats'

/** How to read `secured`, kept as one passage as the user wrote it; each piece lives in its own layer, so a frame can take fewer. */
export const SECURED = [SECURED_DEFINITION, SECURED_FICTION, SECURED_GRAPH].join('\n\n')

/** The grounding as the probe has used it: reading with `SECURED`, the fiction's precedence and ladder, then the graph's `MOVING`. */
export const GROUNDING = composeFrame({ reading: [READING, SECURED].join('\n\n'), fiction: [PRECEDENCE, LADDER].join('\n\n'), graph: MOVING })
