/**
 * The judge's job input (sceneProjection Slice 6): the question a `CommandAttempt` asks of the scene, to sit beneath the scene
 * text in `scenePrompt`. It replaces CA-1's six-section `renderProse` (SP-11): the player's words and the actions with their
 * facilitating actions become the question, the referents become handles, and the scene carries the rest. Challenges and the
 * result are left out on purpose: a detected challenge pre-answers what the judge is asked to find, and the result is what the
 * judge produces.
 *
 * `describe()` supplies each action's wording and names things by short name, which is ambiguous in a scene with two cups. So
 * the handle is added beside the name, found by the referent's `groundedId` in the handle table that came back with the scene
 * (`SceneResult.handles`), never by matching names. A thing the table does not hold comes back as `unmapped`, not as a guess.
 * The table is per thing, so the part of an object a referent means (`view`) is not carried: a half-held rope reads as the rope.
 * Given the fill's skeleton, the primary action is worded from it instead: the player's own words with each span replaced by its
 * handle ("put [table1] in [cup1]"), which keeps their verb and needs no key beside it. A facilitating action has no words in
 * the command, so it keeps its description and handle clause. Without a skeleton every action is worded the same way.
 * The oracle's future place is late in the pipeline, over graph-legal candidates (CA-6), where the attempt, the table and the
 * skeleton are all in scope. The wording is the minimum and provisional.
 */
import type { CommandAttempt } from '../commandAttempt'
import { NavigateAttemptAction } from '../commandAttempt/action'
import { objectSpansIn } from '../commandAttempt/referent'
import { skeletonWithSpanNames, type ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import type { SceneHandleTable } from '../../positions/ludicCache/sceneModel'

export type UnmappedReferent = { span: string; shortName?: string; id?: string }

export type AttemptQuestion =
    | { kind: 'question'; text: string }
    | { kind: 'unmapped'; referents: UnmappedReferent[] }

/**
 * `judge` words it as the judge prompt's `Request`: no closing `Could I?`, and "I want to" without a colon, so
 * it reads as a sentence after `Request: `. The default is the planning frame's, unchanged.
 */
export type AttemptQuestionStyle = 'question' | 'judge'

export const attemptQuestion = (attempt: CommandAttempt, handles: SceneHandleTable, skeleton?: ParseSkeleton, style: AttemptQuestionStyle = 'question'): AttemptQuestion => {
    const handleById = new Map(handles.map(({ id, handle }) => [id as string, handle]))
    const unmapped: UnmappedReferent[] = []
    const handleOfKey: Record<string, string> = {}
    const lines = attempt.actions().map((action) => {
        const description = action.describe()
        if (description === undefined) {
            throw new Error(`attemptQuestion: action '${action.id}' has no description`)
        }
        const seen = new Set<string>()
        // An exit is named by its description and listed in the scene's exits; it is no thing with a handle.
        const clauses = (action instanceof NavigateAttemptAction ? [] : action.referents()).flatMap((referent) => objectSpansIn(referent)).flatMap((span) => {
            const handle = span.groundedId === undefined ? undefined : handleById.get(span.groundedId)
            if (handle === undefined) {
                const entry: UnmappedReferent = { span: span.span, ...(span.shortName !== undefined ? { shortName: span.shortName } : {}), ...(span.groundedId !== undefined ? { id: span.groundedId } : {}) }
                if (!unmapped.some((held) => (entry.id ?? entry.span) === (held.id ?? held.span))) {
                    unmapped.push(entry)
                }
                return []
            }
            if (span.stableRefKey !== undefined) {
                handleOfKey[span.stableRefKey] = `[${handle}]`
            }
            if (seen.has(handle)) {
                return []
            }
            seen.add(handle)
            return [`[${handle}] = ${span.shortName ?? span.span}`]
        })
        return clauses.length > 0 ? `- ${description} (${clauses.join(', ')})` : `- ${description}`
    })
    if (unmapped.length > 0) {
        return { kind: 'unmapped', referents: unmapped }
    }
    if (skeleton === undefined) {
        return { kind: 'question', text: [`I said: "${attempt.words}".`, 'To do that I would:', ...lines, ...(style === 'judge' ? [] : ['Could I?'])].join('\n') }
    }
    const facilitating = lines.slice(0, -1)
    return {
        kind: 'question',
        text: [
            `I want to${style === 'judge' ? '' : ':'} ${skeletonWithSpanNames(skeleton, handleOfKey)}.`,
            ...(facilitating.length > 0 ? ['To do that I would first:', ...facilitating] : []),
            ...(style === 'judge' ? [] : ['Could I?']),
        ].join('\n'),
    }
}
