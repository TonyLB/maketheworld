import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    ThinkingEventSerializer,
    THINKING_RESULT_HEADER_TYPE,
    THINKING_SCHEDULE_HEADER_TYPE,
    THINKING_SCHEMA_VERSION_INITIAL,
    isThinkingEventExternal,
    isThinkingEventUpdate,
    isThinkingResultEvent,
    isThinkingResultEventExternal,
    isThinkingScheduleEvent,
    isThinkingScheduleEventExternal,
    isThinkingSegment
} from './index'

const scheduleHeader = (): StreamingEventHeader => ({
    dataSourceKey: 'mtw.ephemera.thinking.scheduling',
    streamKey: 'JOB#test-generation',
    timestamp: 0,
    type: THINKING_SCHEDULE_HEADER_TYPE
})

const resultHeader = (): StreamingEventHeader => ({
    dataSourceKey: 'mtw.ephemera.thinking',
    streamKey: 'JOB#test-generation',
    timestamp: 0,
    type: THINKING_RESULT_HEADER_TYPE
})

describe('thinking eventBridge contracts', () => {
    describe('isThinkingSegment', () => {
        it('accepts known segments', () => {
            expect(isThinkingSegment('candidates')).toBe(true)
            expect(isThinkingSegment('planSelect')).toBe(true)
            expect(isThinkingSegment('narrativeBeats')).toBe(true)
        })
        it('rejects unknown', () => {
            expect(isThinkingSegment('other')).toBe(false)
            expect(isThinkingSegment(null)).toBe(false)
        })
    })

    describe('type guards', () => {
        const schedule = {
            schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
            generationId: 'gen-uuid',
            workItemId: 'work-uuid',
            segment: 'candidates' as const,
            scheduleStatus: 'scheduled' as const,
            enqueuedAt: '2026-01-01T00:00:00.000Z'
        }

        it('isThinkingScheduleEvent', () => {
            expect(isThinkingScheduleEvent(schedule)).toBe(true)
            expect(isThinkingScheduleEvent({ ...schedule, ok: true })).toBe(false)
        })

        it('isThinkingResultEvent', () => {
            const result = {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: 'gen-uuid',
                workItemId: 'work-uuid',
                segment: 'planSelect' as const,
                ok: true,
                completedAt: '2026-01-01T00:01:00.000Z',
                verbose: { roomObjectsByRoom: {} }
            }
            expect(isThinkingResultEvent(result)).toBe(true)
            expect(isThinkingResultEvent({ ...result, scheduleStatus: 'scheduled' })).toBe(false)
        })

        it('isThinkingEventExternal', () => {
            expect(
                isThinkingEventExternal({
                    type: THINKING_SCHEDULE_HEADER_TYPE,
                    ...schedule
                })
            ).toBe(true)
            expect(
                isThinkingEventExternal({
                    type: THINKING_RESULT_HEADER_TYPE,
                    schemaVersion: 1,
                    generationId: 'g',
                    workItemId: 'w',
                    segment: 'narrativeBeats',
                    ok: false,
                    completedAt: '2026-01-01T00:02:00.000Z',
                    errorCode: 'LLM_ERROR'
                })
            ).toBe(true)
            expect(isThinkingEventExternal({ type: 'Other', foo: 1 })).toBe(false)
        })
    })

    describe('ThinkingEventSerializer', () => {
        const serializer = new ThinkingEventSerializer()

        it('round-trips schedule', async () => {
            const internal = {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: '11111111-1111-1111-1111-111111111111',
                workItemId: '22222222-2222-2222-2222-222222222222',
                segment: 'candidates' as const,
                scheduleStatus: 'claimed' as const
            }
            expect(isThinkingEventUpdate(internal)).toBe(true)
            const external = serializer.serialize({ content: internal, header: scheduleHeader() })
            expect(isThinkingScheduleEventExternal(external)).toBe(true)
            const back = await serializer.deserialize({ content: external, header: scheduleHeader() })
            expect(back).toEqual(internal)
        })

        it('round-trips result with verbose', async () => {
            const internal = {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: '11111111-1111-1111-1111-111111111111',
                workItemId: '22222222-2222-2222-2222-222222222222',
                segment: 'planSelect' as const,
                ok: true,
                completedAt: '2026-05-14T12:00:00.000Z',
                verbose: { nested: [1, 2] }
            }
            const external = serializer.serialize({ content: internal, header: resultHeader() })
            expect(isThinkingResultEventExternal(external)).toBe(true)
            const back = await serializer.deserialize({ content: external, header: resultHeader() })
            expect(back).toEqual(internal)
        })

        it('throws on Snapshot serialize', () => {
            expect(() =>
                serializer.serialize({
                    content: {
                        schemaVersion: 1,
                        generationId: 'g',
                        workItemId: 'w',
                        segment: 'candidates',
                        scheduleStatus: 'scheduled'
                    },
                    header: { ...scheduleHeader(), type: 'Snapshot' }
                })
            ).toThrow('snapshot')
        })

        it('returns null on Snapshot deserialize', async () => {
            const r = await serializer.deserialize({
                content: {
                    type: THINKING_SCHEDULE_HEADER_TYPE,
                    schemaVersion: 1,
                    generationId: 'g',
                    workItemId: 'w',
                    segment: 'candidates',
                    scheduleStatus: 'scheduled'
                },
                header: { ...scheduleHeader(), type: 'Snapshot' }
            })
            expect(r).toBeNull()
        })

        it('returns null when header/content mismatch', async () => {
            const external = serializer.serialize({
                content: {
                    schemaVersion: 1,
                    generationId: 'g',
                    workItemId: 'w',
                    segment: 'candidates',
                    scheduleStatus: 'scheduled'
                },
                header: scheduleHeader()
            })
            const r = await serializer.deserialize({ content: external, header: resultHeader() })
            expect(r).toBeNull()
        })
    })
})
