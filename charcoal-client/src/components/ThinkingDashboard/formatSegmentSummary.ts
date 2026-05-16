import { ThinkingScheduleEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

export const formatSegmentSummary = (schedules: ThinkingScheduleEvent[]): string => {
    const seen = new Set<string>()
    const segments: string[] = []
    for (const { segment } of schedules) {
        if (!seen.has(segment)) {
            seen.add(segment)
            segments.push(segment)
        }
    }
    return segments.join(', ')
}
