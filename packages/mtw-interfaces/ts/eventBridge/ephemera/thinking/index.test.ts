import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    ThinkingEventSerializer,
    THINKING_JOB_COMPLETED_HEADER_TYPE,
    THINKING_RESULT_HEADER_TYPE,
    THINKING_SCHEDULE_HEADER_TYPE,
    THINKING_SCHEMA_VERSION_INITIAL,
    isThinkingEventExternal,
    isThinkingEventUpdate,
    isThinkingJobCompletedEvent,
    isThinkingJobCompletedEventExternal,
    isThinkingJobCreateEvent,
    isThinkingJobErrorEvent,
    isThinkingJobStatus,
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

const jobCompletedHeader = (): StreamingEventHeader => ({
    dataSourceKey: 'mtw.ephemera.thinking.scheduling',
    streamKey: 'JOB#test-generation',
    timestamp: 0,
    type: THINKING_JOB_COMPLETED_HEADER_TYPE
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

    describe('isThinkingJobStatus', () => {
        it('accepts all Meta::Job jobStatus values', () => {
            expect(isThinkingJobStatus('pending')).toBe(true)
            expect(isThinkingJobStatus('running')).toBe(true)
            expect(isThinkingJobStatus('failed')).toBe(true)
            expect(isThinkingJobStatus('completed')).toBe(true)
        })
        it('rejects unknown', () => {
            expect(isThinkingJobStatus('scheduled')).toBe(false)
            expect(isThinkingJobStatus(null)).toBe(false)
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
            expect(isThinkingScheduleEvent({ ...schedule, scheduleStatus: 'completed' })).toBe(true)
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
            expect(
                isThinkingEventExternal({
                    type: THINKING_JOB_COMPLETED_HEADER_TYPE,
                    schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                    generationId: 'gen-uuid',
                    jobStatus: 'completed',
                    completedAt: '2026-01-01T00:03:00.000Z',
                    schedules: [
                        {
                            schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                            generationId: 'gen-uuid',
                            workItemId: 'work-1',
                            segment: 'candidates',
                            scheduleStatus: 'completed'
                        }
                    ]
                })
            ).toBe(true)
            expect(isThinkingEventExternal({ type: 'Other', foo: 1 })).toBe(false)
        })

        it('isThinkingJobCreateEvent', () => {
            const jobCreate = {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                workItemIds: ['11111111-2222-3333-4444-555555555555'],
                jobStatus: 'pending' as const,
                createdAt: '2026-05-14T00:00:00.000Z'
            }
            expect(isThinkingJobCreateEvent(jobCreate)).toBe(true)
            expect(isThinkingJobCreateEvent({ ...jobCreate, jobStatus: 'running' })).toBe(true)
            expect(isThinkingJobCreateEvent({ ...jobCreate, workItemIds: [] })).toBe(false)
            expect(isThinkingJobCreateEvent({ ...jobCreate, workItemIds: [''] })).toBe(false)
            expect(isThinkingJobCreateEvent({ ...jobCreate, failedAt: '2026-01-01T00:00:00.000Z' })).toBe(false)
            expect(isThinkingJobCreateEvent({ ...jobCreate, segment: 'candidates' })).toBe(false)
            expect(isThinkingJobCreateEvent({ ...jobCreate, jobStatus: 'failed' })).toBe(false)
            expect(isThinkingJobCreateEvent({ ...jobCreate, jobStatus: 'completed' })).toBe(false)
        })

        it('isThinkingJobErrorEvent', () => {
            const jobErr = {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                jobStatus: 'failed' as const,
                failedAt: '2026-05-14T01:00:00.000Z',
                errorCode: 'PIPELINE_ABORT',
                errorMessage: 'stopped',
                lastFailedWorkItemId: '11111111-2222-3333-4444-555555555555'
            }
            expect(isThinkingJobErrorEvent(jobErr)).toBe(true)
            expect(isThinkingJobErrorEvent({ ...jobErr, workItemIds: ['x'] })).toBe(false)
            expect(isThinkingJobErrorEvent({ ...jobErr, segment: 'candidates' })).toBe(false)
            expect(isThinkingJobErrorEvent({ ...jobErr, ok: false })).toBe(false)
            expect(isThinkingJobErrorEvent({ ...jobErr, jobStatus: 'pending' })).toBe(false)
            expect(isThinkingJobErrorEvent({ ...jobErr, jobStatus: 'completed' })).toBe(false)
        })

        it('isThinkingJobCompletedEvent', () => {
            const scheduleItem = {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                workItemId: '11111111-2222-3333-4444-555555555555',
                segment: 'candidates' as const,
                scheduleStatus: 'completed' as const
            }
            const jobCompleted = {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                jobStatus: 'completed' as const,
                completedAt: '2026-05-14T02:00:00.000Z',
                schedules: [scheduleItem, { ...scheduleItem, workItemId: '22222222-3333-4444-5555-666666666666', segment: 'planSelect' as const }]
            }
            expect(isThinkingJobCompletedEvent(jobCompleted)).toBe(true)
            expect(isThinkingJobCompletedEvent({ ...jobCompleted, schedules: [] })).toBe(false)
            expect(isThinkingJobCompletedEvent({ ...jobCompleted, workItemIds: ['x'] })).toBe(false)
            expect(isThinkingJobCompletedEvent({ ...jobCompleted, workItemId: 'x' })).toBe(false)
            expect(isThinkingJobCompletedEvent({ ...jobCompleted, ok: true })).toBe(false)
            expect(isThinkingJobCompletedEvent({ ...jobCompleted, failedAt: '2026-01-01T00:00:00.000Z' })).toBe(false)
            expect(isThinkingJobCompletedEvent({ ...jobCompleted, jobStatus: 'running' })).toBe(false)
            expect(isThinkingJobCompletedEvent({ ...jobCompleted, jobStatus: 'failed' })).toBe(false)
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

        it('round-trips job completed with schedules', async () => {
            const internal = {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: '11111111-1111-1111-1111-111111111111',
                jobStatus: 'completed' as const,
                completedAt: '2026-05-14T13:00:00.000Z',
                schedules: [
                    {
                        schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                        generationId: '11111111-1111-1111-1111-111111111111',
                        workItemId: '22222222-2222-2222-2222-222222222222',
                        segment: 'candidates' as const,
                        scheduleStatus: 'completed' as const
                    },
                    {
                        schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                        generationId: '11111111-1111-1111-1111-111111111111',
                        workItemId: '33333333-3333-3333-3333-333333333333',
                        segment: 'planSelect' as const,
                        scheduleStatus: 'completed' as const,
                        enqueuedAt: '2026-05-14T12:00:00.000Z'
                    }
                ]
            }
            expect(isThinkingEventUpdate(internal)).toBe(true)
            const external = serializer.serialize({ content: internal, header: jobCompletedHeader() })
            expect(isThinkingJobCompletedEventExternal(external)).toBe(true)
            const back = await serializer.deserialize({ content: external, header: jobCompletedHeader() })
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

        it('returns null when job-completed content has schedule header', async () => {
            const external = serializer.serialize({
                content: {
                    schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                    generationId: 'g',
                    jobStatus: 'completed',
                    completedAt: '2026-05-14T13:00:00.000Z',
                    schedules: [
                        {
                            schemaVersion: 1,
                            generationId: 'g',
                            workItemId: 'w',
                            segment: 'candidates',
                            scheduleStatus: 'completed'
                        }
                    ]
                },
                header: jobCompletedHeader()
            })
            const r = await serializer.deserialize({ content: external, header: scheduleHeader() })
            expect(r).toBeNull()
        })
    })
})
