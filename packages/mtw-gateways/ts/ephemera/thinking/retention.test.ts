import {
    THINKING_DYNAMO_TTL_AFTER_TERMINAL_MS,
    THINKING_SNAPSHOT_COMPLETED_MAX_AGE_MS,
    isTerminalThinkingScheduleStatus,
    thinkingDeleteAtFromTerminalIso,
    thinkingSnapshotCompletedCutoffIso,
} from './retention'

describe('thinking retention helpers', () => {
    const fixedNow = Date.parse('2026-05-17T12:00:00.000Z')

    describe('thinkingSnapshotCompletedCutoffIso', () => {
        it('returns ISO string 8 hours before now', () => {
            expect(thinkingSnapshotCompletedCutoffIso(fixedNow)).toBe('2026-05-17T04:00:00.000Z')
        })
    })

    describe('thinkingDeleteAtFromTerminalIso', () => {
        it('returns epoch seconds terminal + 9 hours', () => {
            const terminal = '2026-05-17T12:00:00.000Z'
            const expected = Math.floor(
                (Date.parse(terminal) + THINKING_DYNAMO_TTL_AFTER_TERMINAL_MS) / 1000
            )
            expect(thinkingDeleteAtFromTerminalIso(terminal, fixedNow)).toBe(expected)
        })

        it('falls back to now when terminal ISO is invalid', () => {
            const expected = Math.floor((fixedNow + THINKING_DYNAMO_TTL_AFTER_TERMINAL_MS) / 1000)
            expect(thinkingDeleteAtFromTerminalIso('not-a-date', fixedNow)).toBe(expected)
        })
    })

    describe('isTerminalThinkingScheduleStatus', () => {
        it('returns true for completed and cancelled', () => {
            expect(isTerminalThinkingScheduleStatus('completed')).toBe(true)
            expect(isTerminalThinkingScheduleStatus('cancelled')).toBe(true)
        })

        it('returns false for in-flight statuses', () => {
            expect(isTerminalThinkingScheduleStatus('scheduled')).toBe(false)
            expect(isTerminalThinkingScheduleStatus('claimed')).toBe(false)
        })
    })

    describe('constants', () => {
        it('uses 8h snapshot and 9h TTL offsets', () => {
            expect(THINKING_SNAPSHOT_COMPLETED_MAX_AGE_MS).toBe(8 * 60 * 60 * 1000)
            expect(THINKING_DYNAMO_TTL_AFTER_TERMINAL_MS).toBe(9 * 60 * 60 * 1000)
        })
    })
})
