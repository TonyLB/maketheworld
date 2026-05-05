import { describe, it, expect } from '@jest/globals'
import { hasActiveConnections, isStaleSessionMetaRow, STALE_BUFFER_MS } from './classification'

describe('stale session classification', () => {
    describe('hasActiveConnections', () => {
        it('returns false for empty or missing connections', () => {
            expect(hasActiveConnections(undefined)).toBe(false)
            expect(hasActiveConnections([])).toBe(false)
        })

        it('returns true when at least one connection id exists', () => {
            expect(hasActiveConnections(['ws-1'])).toBe(true)
        })
    })

    describe('isStaleSessionMetaRow', () => {
        const baseNow = 1_000_000

        it('returns false when connections are still active', () => {
            expect(isStaleSessionMetaRow({
                connections: ['c1'],
                dropAfter: baseNow - 999_999,
                nowMs: baseNow
            })).toBe(false)
        })

        it('returns false inside disconnect grace (before dropAfter)', () => {
            const dropAfter = baseNow + 4000
            expect(isStaleSessionMetaRow({
                connections: [],
                dropAfter,
                nowMs: baseNow
            })).toBe(false)
        })

        it('returns false shortly after dropAfter but within diagnostics buffer (false-positive suppression)', () => {
            const dropAfter = baseNow - 1000
            expect(isStaleSessionMetaRow({
                connections: [],
                dropAfter,
                nowMs: dropAfter + STALE_BUFFER_MS - 1
            })).toBe(false)
        })

        it('returns true after dropAfter plus diagnostics buffer', () => {
            const dropAfter = baseNow - 50_000
            expect(isStaleSessionMetaRow({
                connections: [],
                dropAfter,
                nowMs: dropAfter + STALE_BUFFER_MS + 1
            })).toBe(true)
        })

        it('returns true when connections are empty and dropAfter is missing (anomaly)', () => {
            expect(isStaleSessionMetaRow({
                connections: [],
                dropAfter: undefined,
                nowMs: baseNow
            })).toBe(true)
        })

        it('is deterministic for repeated evaluation (idempotent classification)', () => {
            const args = {
                connections: [] as string[],
                dropAfter: baseNow - 100_000,
                nowMs: baseNow
            }
            expect(isStaleSessionMetaRow(args)).toBe(isStaleSessionMetaRow(args))
        })
    })
})
