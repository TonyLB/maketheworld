import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import { testPositionGraphFromEnvelope } from '../../../positions/positionGraph/testFixtures'
import {
    buildObjectManipulationComplexityPrompt,
    buildObjectManipulationIdentityPrompt,
} from './buildPrompt'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId

const touchingEdge: StandardExitEdgeData = {
    tag: 'Exit',
    uuid: 'edge-1',
    from: broomId,
    to: tableId,
    payload: {},
}

describe('buildObjectManipulationIdentityPrompt', () => {
    it('includes catalogScope on catalog rows', () => {
        const { dynamicSuffix } = buildObjectManipulationIdentityPrompt('pick up broom', {
            rawObjectSpan: 'broom',
            catalog: [{ objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' }],
        })
        expect(dynamicSuffix).toContain('catalogScope')
        expect(dynamicSuffix).toContain('"room"')
    })
})

describe('buildObjectManipulationComplexityPrompt', () => {
    it('includes membership context and no catalog labels', () => {
        const { invariantPrefix, dynamicSuffix } = buildObjectManipulationComplexityPrompt('pick up broom', {
            objectId: broomId,
            containers: [roomId],
            positionGraph: testPositionGraphFromEnvelope(roomId, { nodes: [], edges: [touchingEdge] }),
        })
        expect(invariantPrefix).toContain('Do not re-resolve identity')
        expect(dynamicSuffix).toContain(broomId)
        expect(dynamicSuffix).toContain('Membership containers')
        expect(dynamicSuffix).toContain('Exit edges touching object')
        expect(dynamicSuffix).not.toContain('normalized shortNames')
    })
})
