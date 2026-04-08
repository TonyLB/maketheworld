import {
    normalizeMarkState,
    markStatesEqual,
} from './markStateUtils'
import type { EphemeraCacheMarkState } from '../dataSource/renderCache/baseClasses'

const makeMarkState = (entries: Array<{ mark: string; value: string }>): EphemeraCacheMarkState => ({
    markValue: entries
})

describe('renderCache/markStateUtils', () => {
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
})

