import { buildMembershipManipulationFrame } from './membershipFrame'

describe('buildMembershipManipulationFrame', () => {
    it('combines parse input and classify intent into a membership frame', () => {
        const frame = buildMembershipManipulationFrame(
            {
                command: 'grab the broom',
                characterId: 'CHARACTER#abc',
                roomObjectCatalog: [{ objectId: 'OBJECT#broom', normalizedShortName: 'broom' }],
                heldInventoryCatalog: [],
            },
            {
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
            }
        )
        expect(frame).toEqual({
            command: 'grab the broom',
            rawObjectSpans: ['broom'],
            verbClass: 'acquire',
            characterId: 'CHARACTER#abc',
            roomObjectCatalog: [{ objectId: 'OBJECT#broom', normalizedShortName: 'broom' }],
            heldInventoryCatalog: [],
        })
    })
})
