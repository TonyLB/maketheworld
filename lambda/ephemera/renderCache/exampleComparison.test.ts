import {
    testing,
    findExactMatch,
    findExactMatchForComponent
} from './exampleComparison'
import type {
    EphemeraCacheDynamoItem,
    EphemeraCacheMarkState
} from './baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

const { normalizeMarkState, markStatesEqual } = testing

const makeMarkState = (entries: Array<{ mark: string; value: string }>): EphemeraCacheMarkState => ({
    markValue: entries
})

const baseRecord = (overrides: Partial<EphemeraCacheDynamoItem> = {}): EphemeraCacheDynamoItem => ({
    EphemeraId: 'ROOM#test-room' as const,
    DataCategory: 'CACHE#test',
    markState: makeMarkState([]),
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
    perspectiveId: 'PERSPECTIVE#abc',
    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] },
    ...overrides
})

describe('renderCache/exampleComparison', () => {
    describe('normalizeMarkState', () => {
        it('produces deterministic ordering for the same logical state', () => {
            const a = makeMarkState([
                { mark: 'MARK#b', value: 'two' },
                { mark: 'MARK#a', value: 'one' }
            ])
            const b = makeMarkState([
                { mark: 'MARK#a', value: 'one' },
                { mark: 'MARK#b', value: 'two' }
            ])

            const normalizedA = normalizeMarkState(a)
            const normalizedB = normalizeMarkState(b)

            expect(normalizedA).toEqual(normalizedB)
            expect(normalizedA.markValue.map((entry) => entry.mark)).toEqual([
                'MARK#a',
                'MARK#b'
            ])
        })

        it('deduplicates marks with last-wins semantics', () => {
            const state = makeMarkState([
                { mark: 'MARK#a', value: 'first' },
                { mark: 'MARK#a', value: 'second' },
                { mark: 'MARK#b', value: 'other' }
            ])

            const normalized = normalizeMarkState(state)

            expect(normalized.markValue).toEqual([
                { mark: 'MARK#a', value: 'second' },
                { mark: 'MARK#b', value: 'other' }
            ])
        })

        it('filters out entries with empty mark or value', () => {
            const state = makeMarkState([
                { mark: '', value: 'x' },
                { mark: 'MARK#a', value: '' },
                { mark: 'MARK#b', value: 'ok' }
            ])

            const normalized = normalizeMarkState(state)

            expect(normalized.markValue).toEqual([{ mark: 'MARK#b', value: 'ok' }])
        })

        it('treats two empty mark states as equal after normalization', () => {
            const a = makeMarkState([])
            const b = makeMarkState([])

            const normalizedA = normalizeMarkState(a)
            const normalizedB = normalizeMarkState(b)

            expect(normalizedA).toEqual({ markValue: [] })
            expect(normalizedB).toEqual({ markValue: [] })
        })
    })

    describe('markStatesEqual', () => {
        it('returns true for logically equal states regardless of order', () => {
            const a = makeMarkState([
                { mark: 'MARK#b', value: 'two' },
                { mark: 'MARK#a', value: 'one' }
            ])
            const b = makeMarkState([
                { mark: 'MARK#a', value: 'one' },
                { mark: 'MARK#b', value: 'two' }
            ])

            expect(markStatesEqual(a, b)).toBe(true)
        })

        it('returns false when there is an extra mark', () => {
            const a = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const b = makeMarkState([
                { mark: 'MARK#a', value: 'one' },
                { mark: 'MARK#b', value: 'two' }
            ])

            expect(markStatesEqual(a, b)).toBe(false)
            expect(markStatesEqual(b, a)).toBe(false)
        })

        it('returns false when a mark value differs', () => {
            const a = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const b = makeMarkState([{ mark: 'MARK#a', value: 'different' }])

            expect(markStatesEqual(a, b)).toBe(false)
        })
    })

    describe('findExactMatch', () => {
        it('returns null when there are no records', () => {
            const proposed = makeMarkState([{ mark: 'MARK#a', value: 'one' }])

            const match = findExactMatch({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                records: [],
                perspective: { assetStack: ['ASSET#a'] } as Perspective
            })

            expect(match).toBeNull()
        })

        it('returns null when no record matches the proposed state', () => {
            const proposed = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const records = [
                baseRecord({
                    markState: makeMarkState([{ mark: 'MARK#a', value: 'different' }])
                })
            ]

            const match = findExactMatch({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                records,
                perspective: { assetStack: ['ASSET#a'] } as Perspective
            })

            expect(match).toBeNull()
        })

        it('returns a record that matches proposed state when perspectiveMatches', () => {
            const proposed = makeMarkState([
                { mark: 'MARK#a', value: 'one' },
                { mark: 'MARK#b', value: 'two' }
            ])
            const perspective: Perspective = { assetStack: ['ASSET#a'] }
            const records = [
                baseRecord({
                    markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#other'], forbiddenAssetIds: [] }
                }),
                baseRecord({
                    DataCategory: 'CACHE#match',
                    markState: makeMarkState([
                        { mark: 'MARK#b', value: 'two' },
                        { mark: 'MARK#a', value: 'one' }
                    ]),
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] }
                })
            ]

            const match = findExactMatch({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                records,
                perspective
            })

            expect(match).toEqual(
                expect.objectContaining({
                    DataCategory: 'CACHE#match'
                })
            )
        })

        it('respects perspective when provided (filters by perspectiveMatches)', () => {
            const proposed = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const perspective: Perspective = { assetStack: ['ASSET#a', 'ASSET#b'] }
            const records = [
                baseRecord({
                    DataCategory: 'CACHE#no-match',
                    markState: proposed,
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#other'], forbiddenAssetIds: [] }
                }),
                baseRecord({
                    DataCategory: 'CACHE#correct-perspective',
                    markState: proposed,
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#a', 'ASSET#b'], forbiddenAssetIds: [] }
                })
            ]

            const match = findExactMatch({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                records,
                perspective
            })

            expect(match).toEqual(
                expect.objectContaining({
                    DataCategory: 'CACHE#correct-perspective'
                })
            )
        })

        it('skips records without perspectiveMatcher', () => {
            const proposed = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const records = [
                {
                    ...baseRecord({ DataCategory: 'CACHE#legacy', markState: proposed }),
                    perspectiveMatcher: undefined
                } as unknown as EphemeraCacheDynamoItem,
                baseRecord({
                    DataCategory: 'CACHE#with-matcher',
                    markState: proposed,
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] }
                })
            ]
            const perspective: Perspective = { assetStack: ['ASSET#a'] }

            const match = findExactMatch({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                records,
                perspective
            })

            expect(match).toEqual(
                expect.objectContaining({ DataCategory: 'CACHE#with-matcher' })
            )
        })
    })

    describe('findExactMatchForComponent', () => {
        it('queries cache records and delegates to findExactMatch', async () => {
            const proposed = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const perspective: Perspective = { assetStack: ['ASSET#a'] }
            const records = [
                baseRecord({
                    DataCategory: 'CACHE#match',
                    markState: proposed,
                    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] }
                })
            ]

            const query = jest.fn().mockResolvedValue(records)

            const match = await findExactMatchForComponent({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                perspective,
                query
            })

            expect(query).toHaveBeenCalledWith('ROOM#test-room')
            expect(match).toEqual(
                expect.objectContaining({
                    DataCategory: 'CACHE#match'
                })
            )
        })
    })
})

