import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardKey, ReferenceList } from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardRoom, { type StandardRoomPayload } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardMark, { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import StandardGuidance from '@tonylb/mtw-wml/ts/standardize/components/guidance'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { ExitFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'
import { SituationRoomFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'

const GENERATION_CONTEXT_CASCADE = {
    graph: [
        { name: 'room', requestType: 'Full' as const, transitions: [
            { connectionType: 'Direct' as const, targetNode: 'lens' },
            { connectionType: 'Direct' as const, targetNode: 'guidance' }
        ] },
        { name: 'lens', requestType: 'Full' as const, transitions: [
            { connectionType: 'Direct' as const, targetNode: 'mark' }
        ] },
        { name: 'mark', requestType: 'Full' as const, transitions: [] },
        { name: 'guidance', requestType: 'Full' as const, transitions: [] }
    ],
    startNodes: ['room']
}

const isGenerationContextComponent = (c: StandardComponent): boolean =>
    c instanceof StandardRoom || c instanceof StandardLens || c instanceof StandardMark || c instanceof StandardGuidance

const roomMatchesKey = (room: StandardRoom, roomKey: StandardKey): boolean =>
    room.standardKey.equals(roomKey)

/** Clones the room and clears situations, inline refs, exits, features, and characters on the clone's payload. */
function trimRoomForGenerationContext(room: StandardRoom): StandardRoom {
    const trimmed = room.clone()
    const payload = (trimmed as StandardRoom & { _payload: StandardRoomPayload })._payload
    payload._situations = new SituationRoomFacetList([])
    payload._exits = new ExitFacetList([])
    payload._features = new ReferenceList([])
    payload._inlineRefs = new ReferenceList([])
    payload._characters = new ReferenceList([])
    return trimmed
}

/**
 * Builds the generation-context subset for a Room: Room plus Direct-referenced Lens, Mark, and Guidance.
 * The caller can serialize with schemaToWML([result.schema]) to obtain generation-context WML when a trimmed
 * room slice (without situations, inline refs, exits, features, characters) is needed.
 * The Room in the result is trimmed to only shortName, lens, and guidance (no situations, inline refs, exits, features, characters).
 */
export const buildGenerationContextSubset = (form: StandardForm, roomKey: StandardKey): StandardForm => {
    const subsetForm = form.subset([{
        requestType: 'Full',
        keys: [roomKey],
        cascadeConditions: [GENERATION_CONTEXT_CASCADE]
    }])

    const generationContextComponents = subsetForm.components.filter(isGenerationContextComponent)
    const newComponents = generationContextComponents.map((c) =>
        c instanceof StandardRoom && roomMatchesKey(c, roomKey) ? trimRoomForGenerationContext(c) : c
    )

    return subsetForm.withComponents(newComponents)
}
