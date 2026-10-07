import type { ParseSkeleton } from './parse/parseToken'
import { CommandAttempt } from '../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../commandAttempt/action'
import { objectSpanRef, type Change } from './plan/planStep'

/**
 * Test-only stand-in for the LLM Plan fallback, which is not built: peer relations have no
 * deterministic parse, so no template produces their ungrounded attempt. The producers
 * (compileAttemptsFromSkeleton, grounding, Expansion) still take one as input, so their tests
 * build it here from the skeleton's spans, with the relation stated by the test.
 */
export const peerRelationFixture = (
    command: string,
    skeleton: ParseSkeleton,
    relation: { primitive: 'establishRelation' | 'dissolveRelation'; relationKind: 'Custom'; relationLabel: string }
): CommandAttempt => {
    const [, subject, , target] = skeleton
    if (subject?.type !== 'objectSpan' || target?.type !== 'objectSpan') {
        throw new Error('peerRelationFixture needs a V OBJECTSPAN PREP OBJECTSPAN skeleton')
    }
    const change = {
        kind: 'change',
        subject: objectSpanRef(subject.span, subject.stableRefKey),
        target: objectSpanRef(target.span, target.stableRefKey),
        ...relation,
    } as Change
    return CommandAttempt.create(command, [new PositionAttemptAction(mintActionId(), [], change)])
}
