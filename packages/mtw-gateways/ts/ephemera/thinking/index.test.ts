import {
    createThinkingJobReadCacheHandler,
    createThinkingResultReadCacheHandler,
    createThinkingScheduleReadCacheHandler,
    fetchThinkingJobSnapshot,
    filterThinkingResultRows,
    filterThinkingScheduleRows,
    getJobMetaItem,
    getTaskResultItem,
    getTaskScheduleItem,
    jobEphemeraId,
    jobMetaDataCategory,
    jobTaskAdjacencyDataCategory,
    listThinkingSchedulesForJob,
    parseWorkItemIdFromTaskEphemeraId,
    queryTaskRowsForJob,
    taskEphemeraId,
    thinkingJobMetaFromEphemeraItem,
    thinkingResultMetaDataCategory,
    thinkingResultFromEphemeraItem,
    thinkingScheduleFromEphemeraItem,
    thinkingScheduleMetaDataCategory,
} from './index'

describe('thinking ephemera gateway keys', () => {
    it('builds job partition, task partition, adjacency sort key, and Meta::Result', () => {
        const gen = '550e8400-e29b-41d4-a716-446655440000'
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        expect(jobEphemeraId(gen)).toBe(`JOB#${gen}`)
        expect(taskEphemeraId(wid)).toBe(`TASK#${wid}`)
        expect(jobTaskAdjacencyDataCategory(wid)).toBe(`TASK#${wid}`)
        expect(thinkingResultMetaDataCategory()).toBe('Meta::Result')
        expect(thinkingScheduleMetaDataCategory()).toBe('Meta::Schedule')
        expect(jobMetaDataCategory()).toBe('Meta::Job')
    })

    it('parses workItemId from task partition EphemeraId', () => {
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        expect(parseWorkItemIdFromTaskEphemeraId(`TASK#${wid}`)).toBe(wid)
        expect(parseWorkItemIdFromTaskEphemeraId('JOB#x')).toBeNull()
        expect(parseWorkItemIdFromTaskEphemeraId('TASK#')).toBeNull()
    })
})

describe('thinking ephemera gateway fetch', () => {
    it('queries job adjacency rows with begins_with TASK#', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([]),
            getItem: jest.fn(),
        }
        const gen = '550e8400-e29b-41d4-a716-446655440000'
        await queryTaskRowsForJob(db, gen)
        expect(db.query).toHaveBeenCalledWith({
            Key: { EphemeraId: `JOB#${gen}` },
            KeyConditionExpression: 'begins_with(DataCategory, :taskPrefix)',
            ExpressionAttributeValues: { ':taskPrefix': 'TASK#' },
            allFields: true,
        })
    })

    it('getTaskResultItem uses TASK partition and Meta::Result', async () => {
        const db = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue(undefined),
        }
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        await getTaskResultItem(db, wid)
        expect(db.getItem).toHaveBeenCalledWith({
            Key: { EphemeraId: `TASK#${wid}`, DataCategory: 'Meta::Result' },
            getAllFields: true,
        })
    })

    it('getTaskScheduleItem uses TASK partition and Meta::Schedule', async () => {
        const db = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue(undefined),
        }
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        await getTaskScheduleItem(db, wid)
        expect(db.getItem).toHaveBeenCalledWith({
            Key: { EphemeraId: `TASK#${wid}`, DataCategory: 'Meta::Schedule' },
            getAllFields: true,
        })
    })

    it('getJobMetaItem uses Meta::Job sort key', async () => {
        const db = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue({ EphemeraId: 'JOB#x', DataCategory: 'Meta::Job', status: 'running' }),
        }
        const gen = '550e8400-e29b-41d4-a716-446655440000'
        const row = await getJobMetaItem(db, gen)
        expect(db.getItem).toHaveBeenCalledWith({
            Key: { EphemeraId: `JOB#${gen}`, DataCategory: 'Meta::Job' },
            getAllFields: true,
        })
        expect(row?.status).toBe('running')
    })
})

describe('thinkingResultFromEphemeraItem', () => {
    const validBody = {
        schemaVersion: 1,
        generationId: '550e8400-e29b-41d4-a716-446655440000',
        workItemId: '660e8400-e29b-41d4-a716-446655440001',
        segment: 'candidates' as const,
        ok: true,
        completedAt: '2026-01-01T00:00:00.000Z',
    }

    it('returns ThinkingResultEvent when contract fields are top-level', () => {
        const item = {
            EphemeraId: 'TASK#660e8400-e29b-41d4-a716-446655440001',
            DataCategory: 'Meta::Result',
            ...validBody,
        }
        expect(thinkingResultFromEphemeraItem(item)).toEqual(validBody)
    })

    it('returns null for malformed payloads', () => {
        expect(thinkingResultFromEphemeraItem({ EphemeraId: 'x', DataCategory: 'y', ok: true })).toBeNull()
        expect(thinkingResultFromEphemeraItem(null)).toBeNull()
    })
})

describe('filterThinkingResultRows', () => {
    it('keeps TASK# partition + Meta::Result rows that normalize', () => {
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        const good = {
            EphemeraId: `TASK#${wid}`,
            DataCategory: 'Meta::Result',
            schemaVersion: 1,
            generationId: '550e8400-e29b-41d4-a716-446655440000',
            workItemId: wid,
            segment: 'candidates',
            ok: false,
            completedAt: '2026-01-01T00:00:00.000Z',
        }
        const schedule = {
            EphemeraId: `TASK#${wid}`,
            DataCategory: 'Meta::Schedule',
            scheduleStatus: 'scheduled',
        }
        const jobAdjacency = {
            EphemeraId: 'JOB#550e8400-e29b-41d4-a716-446655440000',
            DataCategory: `TASK#${wid}`,
        }
        const out = filterThinkingResultRows([good, schedule, jobAdjacency, { DataCategory: 'Meta::Job' }])
        expect(out).toHaveLength(1)
        expect(out[0]?.ok).toBe(false)
    })
})

describe('thinkingScheduleFromEphemeraItem', () => {
    const validBody = {
        schemaVersion: 1,
        generationId: '550e8400-e29b-41d4-a716-446655440000',
        workItemId: '660e8400-e29b-41d4-a716-446655440001',
        segment: 'candidates' as const,
        scheduleStatus: 'scheduled' as const,
        enqueuedAt: '2026-01-01T00:00:00.000Z',
    }

    it('returns ThinkingScheduleEvent when contract fields are top-level', () => {
        const item = {
            EphemeraId: 'TASK#660e8400-e29b-41d4-a716-446655440001',
            DataCategory: 'Meta::Schedule',
            ...validBody,
        }
        expect(thinkingScheduleFromEphemeraItem(item)).toEqual(validBody)
    })

    it('returns null for malformed payloads', () => {
        expect(thinkingScheduleFromEphemeraItem({ EphemeraId: 'x', DataCategory: 'y', scheduleStatus: 'scheduled' })).toBeNull()
        expect(thinkingScheduleFromEphemeraItem(null)).toBeNull()
    })
})

describe('filterThinkingScheduleRows', () => {
    it('keeps TASK# partition + Meta::Schedule rows that normalize', () => {
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        const good = {
            EphemeraId: `TASK#${wid}`,
            DataCategory: 'Meta::Schedule',
            schemaVersion: 1,
            generationId: '550e8400-e29b-41d4-a716-446655440000',
            workItemId: wid,
            segment: 'candidates',
            scheduleStatus: 'claimed',
        }
        const result = {
            EphemeraId: `TASK#${wid}`,
            DataCategory: 'Meta::Result',
            schemaVersion: 1,
            generationId: '550e8400-e29b-41d4-a716-446655440000',
            workItemId: wid,
            segment: 'candidates',
            ok: true,
            completedAt: '2026-01-01T00:00:00.000Z',
        }
        const jobAdjacency = {
            EphemeraId: 'JOB#550e8400-e29b-41d4-a716-446655440000',
            DataCategory: `TASK#${wid}`,
        }
        const out = filterThinkingScheduleRows([good, result, jobAdjacency, { DataCategory: 'Meta::Job' }])
        expect(out).toHaveLength(1)
        expect(out[0]?.scheduleStatus).toBe('claimed')
    })
})

describe('createThinkingResultReadCacheHandler', () => {
    it('dedupes parallel gets for the same workItemId into one getItem', async () => {
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        const item = {
            EphemeraId: `TASK#${wid}`,
            DataCategory: 'Meta::Result',
            schemaVersion: 1,
            generationId: '550e8400-e29b-41d4-a716-446655440000',
            workItemId: wid,
            segment: 'candidates' as const,
            ok: true,
            completedAt: '2026-01-01T00:00:00.000Z',
        }
        const db = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue(item),
        }
        const cache = createThinkingResultReadCacheHandler(db)
        await Promise.all([cache.get(wid), cache.get(wid)])
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('clear allows a subsequent get to fetch again', async () => {
        const item = {
            EphemeraId: 'TASK#w',
            DataCategory: 'Meta::Result',
            schemaVersion: 1,
            generationId: 'g',
            workItemId: 'w',
            segment: 'candidates' as const,
            ok: true,
            completedAt: '2026-01-01T00:00:00.000Z',
        }
        const db = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue(item),
        }
        const cache = createThinkingResultReadCacheHandler(db)
        await cache.get('w')
        expect(db.getItem).toHaveBeenCalledTimes(1)
        cache.clear()
        await cache.get('w')
        expect(db.getItem).toHaveBeenCalledTimes(2)
    })
})

describe('thinkingJobMetaFromEphemeraItem', () => {
    it('returns job meta when contract fields are top-level', () => {
        const gen = '550e8400-e29b-41d4-a716-446655440000'
        const item = {
            EphemeraId: `JOB#${gen}`,
            DataCategory: 'Meta::Job',
            schemaVersion: 1,
            generationId: gen,
            jobStatus: 'running' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
        }
        expect(thinkingJobMetaFromEphemeraItem(item)).toEqual({
            schemaVersion: 1,
            generationId: gen,
            jobStatus: 'running',
            createdAt: '2026-01-01T00:00:00.000Z',
        })
    })

    it('returns null for malformed payloads', () => {
        expect(thinkingJobMetaFromEphemeraItem({ EphemeraId: 'x', DataCategory: 'Meta::Job' })).toBeNull()
        expect(thinkingJobMetaFromEphemeraItem(null)).toBeNull()
    })
})

describe('listThinkingSchedulesForJob', () => {
    const gen = '550e8400-e29b-41d4-a716-446655440000'
    const wid1 = '660e8400-e29b-41d4-a716-446655440001'
    const wid2 = '770e8400-e29b-41d4-a716-446655440002'

    const scheduleBody = (workItemId: string, segment: 'candidates' | 'planSelect') => ({
        schemaVersion: 1,
        generationId: gen,
        workItemId,
        segment,
        scheduleStatus: 'scheduled' as const,
    })

    it('queries adjacency then getItem per workItemId in query order', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([
                { EphemeraId: `JOB#${gen}`, DataCategory: `TASK#${wid1}` },
                { EphemeraId: `JOB#${gen}`, DataCategory: `TASK#${wid2}` },
            ]),
            getItem: jest.fn().mockImplementation(({ Key }: { Key: { EphemeraId: string } }) => {
                if (Key.EphemeraId === `TASK#${wid1}`) {
                    return Promise.resolve({
                        EphemeraId: `TASK#${wid1}`,
                        DataCategory: 'Meta::Schedule',
                        ...scheduleBody(wid1, 'candidates'),
                    })
                }
                if (Key.EphemeraId === `TASK#${wid2}`) {
                    return Promise.resolve({
                        EphemeraId: `TASK#${wid2}`,
                        DataCategory: 'Meta::Schedule',
                        ...scheduleBody(wid2, 'planSelect'),
                    })
                }
                return Promise.resolve(undefined)
            }),
        }
        const schedules = await listThinkingSchedulesForJob(db, gen)
        expect(db.query).toHaveBeenCalledTimes(1)
        expect(db.getItem).toHaveBeenCalledTimes(2)
        expect(schedules).toHaveLength(2)
        expect(schedules[0]?.workItemId).toBe(wid1)
        expect(schedules[1]?.workItemId).toBe(wid2)
    })

    it('skips adjacency lines with missing or malformed schedule rows', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([
                { EphemeraId: `JOB#${gen}`, DataCategory: `TASK#${wid1}` },
                { EphemeraId: `JOB#${gen}`, DataCategory: `TASK#${wid2}` },
            ]),
            getItem: jest.fn().mockImplementation(({ Key }: { Key: { EphemeraId: string } }) => {
                if (Key.EphemeraId === `TASK#${wid1}`) {
                    return Promise.resolve({
                        EphemeraId: `TASK#${wid1}`,
                        DataCategory: 'Meta::Schedule',
                        ...scheduleBody(wid1, 'candidates'),
                    })
                }
                return Promise.resolve(undefined)
            }),
        }
        const schedules = await listThinkingSchedulesForJob(db, gen)
        expect(schedules).toHaveLength(1)
        expect(schedules[0]?.workItemId).toBe(wid1)
    })
})

describe('fetchThinkingJobSnapshot', () => {
    const gen = '550e8400-e29b-41d4-a716-446655440000'
    const wid = '660e8400-e29b-41d4-a716-446655440001'

    it('loads Meta::Job, adjacency workItemIds, and schedules', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([
                { EphemeraId: `JOB#${gen}`, DataCategory: `TASK#${wid}` },
            ]),
            getItem: jest.fn().mockImplementation(({ Key }: { Key: { EphemeraId: string; DataCategory: string } }) => {
                if (Key.DataCategory === 'Meta::Job') {
                    return Promise.resolve({
                        EphemeraId: `JOB#${gen}`,
                        DataCategory: 'Meta::Job',
                        schemaVersion: 1,
                        generationId: gen,
                        jobStatus: 'running',
                    })
                }
                if (Key.EphemeraId === `TASK#${wid}`) {
                    return Promise.resolve({
                        EphemeraId: `TASK#${wid}`,
                        DataCategory: 'Meta::Schedule',
                        schemaVersion: 1,
                        generationId: gen,
                        workItemId: wid,
                        segment: 'candidates',
                        scheduleStatus: 'scheduled',
                    })
                }
                return Promise.resolve(undefined)
            }),
        }
        const snap = await fetchThinkingJobSnapshot(db, gen)
        expect(snap.generationId).toBe(gen)
        expect(snap.jobStatus).toBe('running')
        expect(snap.workItemIds).toEqual([wid])
        expect(snap.schedules).toHaveLength(1)
        expect(snap.schedules[0]?.workItemId).toBe(wid)
    })
})

describe('createThinkingJobReadCacheHandler', () => {
    const gen = '550e8400-e29b-41d4-a716-446655440000'
    const wid = '660e8400-e29b-41d4-a716-446655440001'

    it('dedupes parallel gets for the same generationId into one query batch', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([
                { EphemeraId: `JOB#${gen}`, DataCategory: `TASK#${wid}` },
            ]),
            getItem: jest.fn().mockImplementation(({ Key }: { Key: { EphemeraId: string; DataCategory: string } }) => {
                if (Key.DataCategory === 'Meta::Job') {
                    return Promise.resolve({
                        EphemeraId: `JOB#${gen}`,
                        DataCategory: 'Meta::Job',
                        schemaVersion: 1,
                        generationId: gen,
                        jobStatus: 'running',
                    })
                }
                if (Key.EphemeraId === `TASK#${wid}`) {
                    return Promise.resolve({
                        EphemeraId: `TASK#${wid}`,
                        DataCategory: 'Meta::Schedule',
                        schemaVersion: 1,
                        generationId: gen,
                        workItemId: wid,
                        segment: 'candidates',
                        scheduleStatus: 'scheduled',
                    })
                }
                return Promise.resolve(undefined)
            }),
        }
        const cache = createThinkingJobReadCacheHandler(db)
        await Promise.all([cache.get(gen), cache.get(gen)])
        expect(db.query).toHaveBeenCalledTimes(1)
        expect(db.getItem).toHaveBeenCalledTimes(2)
    })

    it('invalidate allows a subsequent get to fetch again', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([]),
            getItem: jest.fn().mockResolvedValue({
                EphemeraId: `JOB#${gen}`,
                DataCategory: 'Meta::Job',
                schemaVersion: 1,
                generationId: gen,
                jobStatus: 'running',
            }),
        }
        const cache = createThinkingJobReadCacheHandler(db)
        await cache.get(gen)
        expect(db.query).toHaveBeenCalledTimes(1)
        cache.invalidate(gen)
        await cache.get(gen)
        expect(db.query).toHaveBeenCalledTimes(2)
    })

    it('clear allows a subsequent get to fetch again', async () => {
        const db = {
            query: jest.fn().mockResolvedValue([]),
            getItem: jest.fn().mockResolvedValue({
                EphemeraId: `JOB#${gen}`,
                DataCategory: 'Meta::Job',
                schemaVersion: 1,
                generationId: gen,
                jobStatus: 'running',
            }),
        }
        const cache = createThinkingJobReadCacheHandler(db)
        await cache.get(gen)
        expect(db.query).toHaveBeenCalledTimes(1)
        cache.clear()
        await cache.get(gen)
        expect(db.query).toHaveBeenCalledTimes(2)
    })
})

describe('createThinkingScheduleReadCacheHandler', () => {
    it('dedupes parallel gets for the same workItemId into one getItem', async () => {
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        const item = {
            EphemeraId: `TASK#${wid}`,
            DataCategory: 'Meta::Schedule',
            schemaVersion: 1,
            generationId: '550e8400-e29b-41d4-a716-446655440000',
            workItemId: wid,
            segment: 'candidates' as const,
            scheduleStatus: 'scheduled' as const,
        }
        const db = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue(item),
        }
        const cache = createThinkingScheduleReadCacheHandler(db)
        await Promise.all([cache.get(wid), cache.get(wid)])
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('clear allows a subsequent get to fetch again', async () => {
        const item = {
            EphemeraId: 'TASK#w',
            DataCategory: 'Meta::Schedule',
            schemaVersion: 1,
            generationId: 'g',
            workItemId: 'w',
            segment: 'candidates' as const,
            scheduleStatus: 'scheduled' as const,
        }
        const db = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue(item),
        }
        const cache = createThinkingScheduleReadCacheHandler(db)
        await cache.get('w')
        expect(db.getItem).toHaveBeenCalledTimes(1)
        cache.clear()
        await cache.get('w')
        expect(db.getItem).toHaveBeenCalledTimes(2)
    })
})
