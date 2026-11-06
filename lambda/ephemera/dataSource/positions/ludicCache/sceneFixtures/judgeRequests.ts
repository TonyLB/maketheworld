/**
 * The judge probe's requests (judgePrompt plan, Slice 4): a named set of requests in the player's words, each with the label
 * it should draw, written and agreed **before** a batch runs. The label is the verdict. `tolerate` names the other labels that are border
 * cases rather than failures (the plan grades by what an error costs: a wrong `simple` is never tolerated, since it has no
 * recovery). `mentions` and `avoids` are reading aids, not verdicts: lexical, so the reader decides what they flag.
 */
import type { JudgeLabel } from '../../../actions/sceneProse/frame'

export type JudgeRequest = {
    /** In the player's words, naming things by handle: `I want to pick up [table1].` */
    request: string
    expect: JudgeLabel
    /** Labels that are border cases for this request. `simple` is only valid here when it is the expected label. */
    tolerate?: readonly JudgeLabel[]
    /** Reading aid: the obstacle line or answer sentence should contain one of these (case-insensitive). */
    mentions?: readonly string[]
    /** Reading aid: the obstacle line and answer sentence should contain none of these, e.g. a prescribed fix. */
    avoids?: readonly string[]
    /** Why the request is in the set. */
    note?: string
}
