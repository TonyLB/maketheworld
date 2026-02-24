import {
    testing,
    findExactMatch,
    findExactMatchForComponent
} from './exampleComparison'
import type {
    EphemeraCacheDynamoItem,
    EphemeraCacheMarkState
} from './baseClasses'

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
                perspectiveId: undefined
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
                perspectiveId: undefined
            })

            expect(match).toBeNull()
        })

        it('returns a record that exactly matches the proposed state (no perspective)', () => {
            const proposed = makeMarkState([
                { mark: 'MARK#a', value: 'one' },
                { mark: 'MARK#b', value: 'two' }
            ])
            const records = [
                baseRecord({
                    markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }])
                }),
                baseRecord({
                    DataCategory: 'CACHE#match',
                    markState: makeMarkState([
                        { mark: 'MARK#b', value: 'two' },
                        { mark: 'MARK#a', value: 'one' }
                    ])
                })
            ]

            const match = findExactMatch({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                records,
                perspectiveId: undefined
            })

            expect(match).toEqual(
                expect.objectContaining({
                    DataCategory: 'CACHE#match'
                })
            )
        })

        it('respects perspectiveId when provided', () => {
            const proposed = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const records = [
                baseRecord({
                    DataCategory: 'CACHE#different-perspective',
                    markState: proposed,
                    perspectiveId: 'PERSPECTIVE#other'
                }),
                baseRecord({
                    DataCategory: 'CACHE#correct-perspective',
                    markState: proposed,
                    perspectiveId: 'PERSPECTIVE#target'
                })
            ]

            const match = findExactMatch({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                records,
                perspectiveId: 'PERSPECTIVE#target'
            })

            expect(match).toEqual(
                expect.objectContaining({
                    DataCategory: 'CACHE#correct-perspective',
                    perspectiveId: 'PERSPECTIVE#target'
                })
            )
        })

        it('can match any perspective when perspectiveId is undefined', () => {
            const proposed = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const records = [
                baseRecord({
                    DataCategory: 'CACHE#one',
                    markState: proposed,
                    perspectiveId: 'PERSPECTIVE#one'
                }),
                baseRecord({
                    DataCategory: 'CACHE#two',
                    markState: proposed,
                    perspectiveId: 'PERSPECTIVE#two'
                })
            ]

            const match = findExactMatch({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                records,
                perspectiveId: undefined
            })

            expect(match).not.toBeNull()
            if (!match) {
                return
            }
            expect(['CACHE#one', 'CACHE#two']).toContain(match.DataCategory)
        })
    })

    describe('findExactMatchForComponent', () => {
        it('queries cache records and delegates to findExactMatch', async () => {
            const proposed = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
            const records = [
                baseRecord({
                    DataCategory: 'CACHE#match',
                    markState: proposed,
                    perspectiveId: 'PERSPECTIVE#abc'
                })
            ]

            const query = jest.fn().mockResolvedValue(records)

            const match = await findExactMatchForComponent({
                componentId: 'ROOM#test-room',
                proposedMarkState: proposed,
                perspectiveId: 'PERSPECTIVE#abc',
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

