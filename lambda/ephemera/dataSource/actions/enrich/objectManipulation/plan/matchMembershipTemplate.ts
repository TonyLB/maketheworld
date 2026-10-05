import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import type { ManipulationVerbClass } from '../../../baseClasses'
import { CommandAttempt } from '../../../commandAttempt'
import { PositionAttemptAction } from '../../../commandAttempt/action'
import { planMembershipDesiredResult } from '../proposeMembershipCandidates'

export type MembershipTemplateMatchResult =
    | { type: 'matched'; attempt: CommandAttempt; verbClass: ManipulationVerbClass }
    | { type: 'noMatch' }

function isTextToken(token: ParseToken): token is TextToken {
    return token.type === 'text'
}

/**
 * Matches a membership command by its leading verb: `take`/`get` acquire, `drop` releases.
 * Runs after the relational and look templates, which claim the same leading verbs at their
 * own token counts (`take X off Y` is relational). The span is the first object span, or empty
 * when the command has none; the producer still reads every object span from the skeleton.
 */
export function matchMembershipTemplate(skeleton: ParseSkeleton, command: string): MembershipTemplateMatchResult {
    const [firstToken] = skeleton
    if (!firstToken || !isTextToken(firstToken)) {
        return { type: 'noMatch' }
    }
    const leadingVerb = firstToken.text.trim().toLowerCase()
    const verbClass: ManipulationVerbClass | undefined =
        leadingVerb === 'take' || leadingVerb === 'get' ? 'acquire'
            : leadingVerb === 'drop' ? 'release'
                : undefined
    if (!verbClass) {
        return { type: 'noMatch' }
    }
    const spanToken = skeleton.find((token) => token.type === 'objectSpan')
    const span = spanToken?.type === 'objectSpan' ? spanToken.span : ''
    const operationKind = verbClass === 'acquire' ? 'takeHold' : 'drop'
    return {
        type: 'matched',
        verbClass,
        attempt: CommandAttempt.create(command, [
            new PositionAttemptAction([], planMembershipDesiredResult(operationKind, span)),
        ]),
    }
}
