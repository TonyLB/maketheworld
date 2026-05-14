import {
    createThinkingResultReadCacheHandler,
    filterThinkingResultRows,
    getJobMetaItem,
    getTaskResultItem,
    jobEphemeraId,
    jobMetaDataCategory,
    jobTaskAdjacencyDataCategory,
    parseWorkItemIdFromTaskEphemeraId,
    queryTaskRowsForJob,
    taskEphemeraId,
    thinkingResultMetaDataCategory,
    thinkingResultFromEphemeraItem,
} from './index'

describe('thinking ephemera gateway keys', () => {
    it('builds job partition, task partition, adjacency sort key, and Meta::Result', () => {
        const gen = '550e8400-e29b-41d4-a716-446655440000'
        const wid = '660e8400-e29b-41d4-a716-446655440001'
        expect(jobEphemeraId(gen)).toBe(`JOB#${gen}`)
        expect(taskEphemeraId(wid)).toBe(`TASK#${wid}`)
        expect(jobTaskAdjacencyDataCategory(wid)).toBe(`TASK#${wid}`)
        expect(thinkingResultMetaDataCategory()).toBe('Meta::Result')
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
