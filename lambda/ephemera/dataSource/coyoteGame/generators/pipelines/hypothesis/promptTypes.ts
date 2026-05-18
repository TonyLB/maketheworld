import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

export type BuildHypothesisPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    /** When false, omit harness-aligned iconic few-shots (harness candidate eval). Default true. */
    includeIconicFewShots?: boolean
}

export type CoyotePromptParts = {
    invariantPrefix: string
    dynamicSuffix: string
}
