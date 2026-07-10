import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { existencePresenceGuard } from './existencePresenceGuard'
import { identityPlanCandidateFromSpan } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ObjectSpanCandidate } from './spanResolution'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const ghostId = 'OBJECT#Ghost' as EphemeraObjectId

const roomBroom: ObjectSpanCandidate = {
    id: broomId,
    label: 'broom',
    jointRelevance: 1,
    sourceTags: ['exact'],
    locus: { kind: 'room' },
}

const catalog: ObjectManipulationCatalogEntry[] = [
    {
        objectId: broomId,
        normalizedShortName: 'broom',
        catalogScope: 'room',
    },
]

describe('existencePresenceGuard', () => {
    it('accepts id present at matching locus scope', () => {
        expect(existencePresenceGuard(
            identityPlanCandidateFromSpan(roomBroom, 'takeHold'),
            catalog
        )).toEqual({ type: 'ok' })
    })

    it('rejects hallucinated id absent from catalog', () => {
        const ghost: ObjectSpanCandidate = {
            ...roomBroom,
            id: ghostId,
            label: 'ghost',
        }
        expect(existencePresenceGuard(
            identityPlanCandidateFromSpan(ghost, 'takeHold'),
            catalog
        )).toEqual({
            type: 'error',
            reason: objectManipulationErrorMessages.noMatch,
        })
    })

    it('rejects locus / catalogScope mismatch', () => {
        const heldClaim: ObjectSpanCandidate = {
            ...roomBroom,
            locus: { kind: 'heldByActor' },
        }
        expect(existencePresenceGuard(
            identityPlanCandidateFromSpan(heldClaim, 'drop'),
            catalog
        )).toEqual({
            type: 'error',
            reason: objectManipulationErrorMessages.noMatch,
        })
    })
})
