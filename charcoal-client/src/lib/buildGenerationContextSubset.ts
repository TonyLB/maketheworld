import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardKey } from '@tonylb/mtw-wml/ts/standardize/components/reference'

/**
 * Builds the generation-context subset for a Room: Room plus Direct-referenced Lens, Mark, and Guidance.
 * The caller serializes with schemaToWML([result.schema]) to get the WML string to send in generateRoomPreview.
 */
export const buildGenerationContextSubset = (_form: StandardForm, _roomKey: StandardKey): StandardForm => {
    throw new Error('Not implemented')
}
