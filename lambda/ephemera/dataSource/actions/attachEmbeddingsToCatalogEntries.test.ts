import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import {
    attachEmbeddingsToCatalogEntries,
    catalogObjectIds,
} from './attachEmbeddingsToCatalogEntries'
import type { RoomInPlayObjectCatalogEntry } from './actorObjectCatalog'

const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const pouchId = 'OBJECT#Pouch' as EphemeraObjectId

const makeEmbedding = (axis: number): SemanticEmbedding => {
    const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
    values[axis] = 1
    return SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID })
}

describe('catalogObjectIds', () => {
    it('returns the deduped objectIds', () => {
        const entries: RoomInPlayObjectCatalogEntry[] = [
            { objectId: broomId, normalizedShortName: 'broom' },
            { objectId: anvilId, normalizedShortName: 'anvil' },
            { objectId: broomId, normalizedShortName: 'broom again' },
            { objectId: pouchId, normalizedShortName: 'pouch' },
        ]

        expect(catalogObjectIds(entries)).toEqual([broomId, anvilId, pouchId])
    })

    it('returns empty array when the catalog is empty', () => {
        expect(catalogObjectIds([])).toEqual([])
    })
})

describe('attachEmbeddingsToCatalogEntries', () => {
    it('attaches embeddings from map onto catalog entries', () => {
        const broomEmbedding = makeEmbedding(0)
        const entries: RoomInPlayObjectCatalogEntry[] = [
            { objectId: broomId, normalizedShortName: 'broom' },
            { objectId: anvilId, normalizedShortName: 'anvil' },
        ]

        const result = attachEmbeddingsToCatalogEntries(entries, {
            [broomId]: broomEmbedding,
        })

        expect(result).toEqual([
            { objectId: broomId, normalizedShortName: 'broom', embedding: broomEmbedding },
            { objectId: anvilId, normalizedShortName: 'anvil', embedding: undefined },
        ])
    })

    it('returns empty array for empty entries', () => {
        expect(attachEmbeddingsToCatalogEntries([], {})).toEqual([])
    })
})
