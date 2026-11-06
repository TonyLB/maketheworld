/**
 * The prompt frame for an LLM that reads a scene (sceneProjection Slice 6): layer modules plus a composer. The probe in
 * `calibration/sceneReasoning/` composes its prompt from these; so will the first reader on a production path.
 */
import { LADDER, PRECEDENCE } from './frameFiction'
import { MOVING } from './frameGraph'
import { READING } from './frameReading'
import { composeFrame } from './composeFrame'

export { composeFrame, scenePrompt } from './composeFrame'
export { LADDER, PRECEDENCE } from './frameFiction'
export { MOVING, NOTATION } from './frameGraph'
export { NAME_BY_HANDLE, READING, SCENE_INTRO } from './frameReading'
export { answerFormats, defaultAnswerFormat, isAnswerFormat, isTriageLabel, OPEN_ANSWER_FORMATS, TRIAGE_LABELS, type AnswerFormat, type TriageLabel } from './answerFormats'

/** The grounding as the probe has used it: reading, the fiction's precedence and ladder, then the graph's `MOVING`. */
export const GROUNDING = composeFrame({ reading: READING, fiction: [PRECEDENCE, LADDER].join('\n\n'), graph: MOVING })
export { composeJudgePrompt, IMPROVISING, isJudgeLabel, JUDGE_INSTRUCTIONS, JUDGE_LABELS, JUDGE_RECAP, JUDGE_ROLE, JUDGE_TASK, READING_PLAYER_INTENT, READING_THE_SCENE, withJudgeRecap, type JudgeLabel } from './frameJudge'
