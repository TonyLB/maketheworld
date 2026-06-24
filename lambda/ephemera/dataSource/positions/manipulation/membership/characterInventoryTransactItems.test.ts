import { produce } from 'immer'

import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { buildCharacterInventoryTransactItems } from './characterInventoryTransactItems'

const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const CHARACTER_A = 'CHARACTER#Alpha' as EphemeraCharacterId
const CHARACTER_B = 'CHARACTER#Beta' as EphemeraCharacterId

describe('buildCharacterInventoryTransactItems', () => {
    it('adds object to character inventory graph and adjacency', () => {
        const items = buildCharacterInventoryTransactItems({
            objectId: OBJECT_ID,
            diff: { froms: [], to: CHARACTER_A, changed: true },
        }) as any[]

        expect(items).toHaveLength(2)

        const graphDraft = produce({ positionGraph: { nodes: [], edges: [] } }, (draft) => {
            items[0].Update.updateReducer(draft)
        })
        expect(graphDraft.positionGraph).toEqual({
            nodes: [{ tag: 'Object', universalKey: OBJECT_ID }],
            edges: [],
        })

        expect(items[1].Put).toEqual({
            EphemeraId: OBJECT_ID,
            DataCategory: buildPositionAdjacencyDataCategory(CHARACTER_A),
        })
    })

    it('removes object from character inventory graph and adjacency', () => {
        const items = buildCharacterInventoryTransactItems({
            objectId: OBJECT_ID,
            diff: { froms: [CHARACTER_A], to: null, changed: true },
        }) as any[]

        expect(items).toHaveLength(2)

        const graphDraft = produce({
            positionGraph: {
                nodes: [
                    { tag: 'Object', universalKey: OBJECT_ID },
                    { tag: 'Object', universalKey: 'OBJECT#Other' as EphemeraObjectId },
                ],
                edges: [],
            },
        }, (draft) => {
            items[0].Update.updateReducer(draft)
        })
        expect(graphDraft.positionGraph?.nodes).toEqual([
            { tag: 'Object', universalKey: 'OBJECT#Other' },
        ])

        expect(items[1].Delete).toEqual({
            EphemeraId: OBJECT_ID,
            DataCategory: buildPositionAdjacencyDataCategory(CHARACTER_A),
        })
    })

    it('moves object between character inventory hosts', () => {
        const items = buildCharacterInventoryTransactItems({
            objectId: OBJECT_ID,
            diff: { froms: [CHARACTER_A], to: CHARACTER_B, changed: true },
        }) as any[]

        expect(items).toHaveLength(4)
        expect(items[0].Update.Key.EphemeraId).toBe(CHARACTER_A)
        expect(items[1].Delete.DataCategory).toBe(buildPositionAdjacencyDataCategory(CHARACTER_A))
        expect(items[2].Update.Key.EphemeraId).toBe(CHARACTER_B)
        expect(items[3].Put.DataCategory).toBe(buildPositionAdjacencyDataCategory(CHARACTER_B))
    })
})
