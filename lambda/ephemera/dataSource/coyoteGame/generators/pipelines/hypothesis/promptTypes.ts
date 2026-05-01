import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

export type BuildHypothesisPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
}

export type CoyotePromptParts = {
    invariantPrefix: string
    dynamicSuffix: string
}
