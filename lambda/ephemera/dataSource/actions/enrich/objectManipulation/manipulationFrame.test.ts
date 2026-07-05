import { buildManipulationFrameFromExtract } from './manipulationFrame'

describe('buildManipulationFrameFromExtract', () => {
    it('merges enrich input and frame-extract response into a manipulation frame', () => {
        const frame = buildManipulationFrameFromExtract(
            {
                enrichRoute: 'relational',
                command: 'put broom on table',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                characterId: 'CHARACTER#Player',
                hostRoomId: 'ROOM#Bridge',
                roomObjectCatalog: [{ objectId: 'OBJECT#Broom', normalizedShortName: 'broom' }],
            },
            {
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
                operationKind: 'establishRelation',
            }
        )

        expect(frame).toEqual({
            command: 'put broom on table',
            subjectSpan: 'broom',
            targetSpan: 'table',
            relationSpan: 'on',
            operationKind: 'establishRelation',
            verbClass: 'release',
            rawObjectSpans: ['broom'],
            characterId: 'CHARACTER#Player',
            hostRoomId: 'ROOM#Bridge',
            roomObjectCatalog: [{ objectId: 'OBJECT#Broom', normalizedShortName: 'broom' }],
            heldInventoryCatalog: undefined,
        })
    })
})
