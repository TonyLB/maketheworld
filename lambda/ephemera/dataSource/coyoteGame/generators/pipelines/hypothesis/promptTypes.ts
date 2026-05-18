import type { IncludeIconicFewShotsOptions } from '../../../../coyotePromptFewShot'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

export type BuildHypothesisPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
} & IncludeIconicFewShotsOptions

export type CoyotePromptParts = {
    invariantPrefix: string
    dynamicSuffix: string
}
