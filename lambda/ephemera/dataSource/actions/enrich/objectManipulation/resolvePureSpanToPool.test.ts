import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { lexicalRelevance } from './embeddingMatch/lexicalRelevance'
import { resolvePureSpanToPool } from './resolvePureSpanToPool'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

// The pure resolver must not reach internalCache (the embed path): importing it fails the file.
jest.mock('../../../../internalCache', () => {
    throw new Error('the pure resolver must not import internalCache')
})

const redId = 'OBJECT#RedCup' as EphemeraObjectId
const blueId = 'OBJECT#BlueCup' as EphemeraObjectId
const mugId = 'OBJECT#Mug' as EphemeraObjectId

const catalog: ObjectManipulationCatalogEntry[] = [
    { objectId: redId, normalizedShortName: 'red cup', catalogScope: 'room' },
    { objectId: blueId, normalizedShortName: 'blue cup', catalogScope: 'room' },
    { objectId: mugId, normalizedShortName: 'mug', catalogScope: 'room' },
]

describe('resolvePureSpanToPool', () => {
    it('builds an exact pool for an exact name', async () => {
        const result = await resolvePureSpanToPool('mug', catalog)

        expect(result.type).toBe('pool')
        if (result.type !== 'pool') {
            return
        }
        expect(result.pool.candidates).toMatchObject([{ id: mugId, jointRelevance: 1, sourceTags: ['exact'] }])
    })

    it('pools only the names the span is a subsequence of, scored lexically', async () => {
        const result = await resolvePureSpanToPool('the cup', catalog)

        expect(result.type).toBe('pool')
        if (result.type !== 'pool') {
            return
        }
        expect(result.pool.span).toBe('the cup')
        expect(result.pool.candidates.map(({ id }) => id).sort()).toEqual([blueId, redId].sort())
        const red = result.pool.candidates.find(({ id }) => id === redId)
        expect(red).toMatchObject({ sourceTags: ['lexical'], locus: { kind: 'room' } })
        expect(red?.jointRelevance).toBeGreaterThan(0)
        expect(red?.jointRelevance).toBe(lexicalRelevance('cup', 'red cup'))
        expect(red?.embedRelevance).toBeUndefined()
    })

    it.each([
        ['a span matching no name', 'plate'],
        ['words out of order', 'cup red'],
        ['a span under three characters', 'up'],
    ])('declines %s as ineligible', async (_label, span) => {
        expect(await resolvePureSpanToPool(span, catalog)).toEqual({ type: 'ineligible' })
    })

    it('reports an empty catalog as the full resolver does', async () => {
        expect(await resolvePureSpanToPool('cup', [])).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noCatalog,
        })
    })
})
