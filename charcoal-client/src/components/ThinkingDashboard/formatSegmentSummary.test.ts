import { describe, it, expect } from 'vitest'

import { formatSegmentSummary } from './formatSegmentSummary'

describe('formatSegmentSummary', () => {
    it('deduplicates segments in first-seen order', () => {
        const schedules = [
            {
                schemaVersion: 1,
                generationId: 'gen-1',
                workItemId: 'w1',
                segment: 'candidates' as const,
                scheduleStatus: 'completed' as const
            },
            {
                schemaVersion: 1,
                generationId: 'gen-1',
                workItemId: 'w2',
                segment: 'candidates' as const,
                scheduleStatus: 'completed' as const
            },
            {
                schemaVersion: 1,
                generationId: 'gen-1',
                workItemId: 'w3',
                segment: 'planSelect' as const,
                scheduleStatus: 'completed' as const
            }
        ]
        expect(formatSegmentSummary(schedules)).toBe('candidates, planSelect')
    })

    it('returns empty string for empty schedules', () => {
        expect(formatSegmentSummary([])).toBe('')
    })
})
