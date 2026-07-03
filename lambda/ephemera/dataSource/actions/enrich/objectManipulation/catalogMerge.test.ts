import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { catalogWithScope, mergeObjectManipulationCatalogs } from './catalogMerge'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const ropeId = 'OBJECT#Rope' as EphemeraObjectId

describe('catalogWithScope', () => {
    it('tags each entry with the given catalog scope', () => {
        const room = [{ objectId: 'OBJECT#Broom' as const, normalizedShortName: 'broom' }]
        expect(catalogWithScope(room, 'room')).toEqual([
            { objectId: 'OBJECT#Broom', normalizedShortName: 'broom', catalogScope: 'room' },
        ])
        expect(catalogWithScope(room, 'held')).toEqual([
            { objectId: 'OBJECT#Broom', normalizedShortName: 'broom', catalogScope: 'held' },
        ])
    })
})

describe('mergeObjectManipulationCatalogs', () => {
    it('tags room entries with catalogScope room', () => {
        const room = [{ objectId: broomId, normalizedShortName: 'broom' }]
        expect(mergeObjectManipulationCatalogs(room)).toEqual([
            { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
        ])
    })

    it('appends held-only entries after room entries', () => {
        const room = [{ objectId: broomId, normalizedShortName: 'broom' }]
        const held = [{ objectId: ropeId, normalizedShortName: 'rope' }]
        expect(mergeObjectManipulationCatalogs(room, held)).toEqual([
            { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
            { objectId: ropeId, normalizedShortName: 'rope', catalogScope: 'held' },
        ])
    })

    it('dedupes by objectId with room winning on collision', () => {
        const room = [{ objectId: broomId, normalizedShortName: 'broom' }]
        const held = [{ objectId: broomId, normalizedShortName: 'held-broom' }]
        expect(mergeObjectManipulationCatalogs(room, held)).toEqual([
            { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
        ])
    })

    it('preserves room order when multiple room entries', () => {
        const room = [
            { objectId: broomId, normalizedShortName: 'broom' },
            { objectId: anvilId, normalizedShortName: 'anvil' },
        ]
        const held = [{ objectId: ropeId, normalizedShortName: 'rope' }]
        const merged = mergeObjectManipulationCatalogs(room, held)
        expect(merged.map(({ objectId }) => objectId)).toEqual([broomId, anvilId, ropeId])
    })
})
