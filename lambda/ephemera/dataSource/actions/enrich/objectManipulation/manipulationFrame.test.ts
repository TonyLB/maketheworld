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
                roomObjectCatalog: [{ objectId: 'OBJECT#Broom', normalizedShortName: 'broom' }],
            },
            {
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
            }
        )

        expect(frame).toEqual({
            command: 'put broom on table',
            subjectSpan: 'broom',
            targetSpan: 'table',
            relationSpan: 'on',
            verbClass: 'release',
            rawObjectSpans: ['broom'],
            characterId: 'CHARACTER#Player',
            roomObjectCatalog: [{ objectId: 'OBJECT#Broom', normalizedShortName: 'broom' }],
            heldInventoryCatalog: undefined,
        })
    })
})
