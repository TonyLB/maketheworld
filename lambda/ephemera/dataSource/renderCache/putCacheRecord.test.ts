jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('uuid')
jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        RenderCache: {
            set: jest.fn(),
        },
    },
}))

import internalCache from '../../internalCache'

import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { putCacheRecord, type PutCacheRecordInput } from './putCacheRecord'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const uuidv4Mock = uuidv4 as jest.Mock
const renderCacheSetMock = internalCache.RenderCache.set as jest.Mock

const componentId = 'ROOM#test-room-uuid' as const

const minimalRecord: PutCacheRecordInput = {
    markState: { markValue: [{ mark: 'MARK#mark-uuid', value: 'sunny' }] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' as const },
    perspectiveId: 'test-perspective',
    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] }
}

describe('dataSource/renderCache/putCacheRecord', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        uuidv4Mock.mockReturnValue('new-uuid-1234')
    })

    it('puts item with generated CACHE#uuid and returns dataCategory', async () => {
        ephemeraDBMock.putItem.mockResolvedValue(undefined)

        const dataCategory = await putCacheRecord(componentId, minimalRecord)

        expect(uuidv4Mock).toHaveBeenCalled()
        expect(dataCategory).toBe('CACHE#new-uuid-1234')
        expect(ephemeraDBMock.putItem).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith({
            EphemeraId: componentId,
            DataCategory: 'CACHE#new-uuid-1234',
            markState: minimalRecord.markState,
            renderedContent: minimalRecord.renderedContent,
            provenance: minimalRecord.provenance,
            perspectiveId: minimalRecord.perspectiveId,
            perspectiveMatcher: minimalRecord.perspectiveMatcher
        })
    })

    it('includes situationId when provided', async () => {
        ephemeraDBMock.putItem.mockResolvedValue(undefined)

        await putCacheRecord(componentId, {
            ...minimalRecord,
            situationId: 'SITUATION#situation-uuid'
        })

        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(
            expect.objectContaining({
                EphemeraId: componentId,
                DataCategory: 'CACHE#new-uuid-1234',
                situationId: 'SITUATION#situation-uuid'
            })
        )
    })

    it('omits situationId when not provided', async () => {
        ephemeraDBMock.putItem.mockResolvedValue(undefined)

        await putCacheRecord(componentId, minimalRecord)

        const call = ephemeraDBMock.putItem.mock.calls[0][0]
        expect(call).not.toHaveProperty('situationId')
    })

    it('uses existingDataCategory when provided (overwrite in place)', async () => {
        ephemeraDBMock.putItem.mockResolvedValue(undefined)

        const dataCategory = await putCacheRecord(
            componentId,
            minimalRecord,
            'CACHE#existing-uuid'
        )

        expect(uuidv4Mock).not.toHaveBeenCalled()
        expect(dataCategory).toBe('CACHE#existing-uuid')
        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(
            expect.objectContaining({
                EphemeraId: componentId,
                DataCategory: 'CACHE#existing-uuid',
                markState: minimalRecord.markState,
                renderedContent: minimalRecord.renderedContent
            })
        )
    })

    it('persists catalogVersion and updates RenderCache memo', async () => {
        ephemeraDBMock.putItem.mockResolvedValue(undefined)

        await putCacheRecord(componentId, { ...minimalRecord, catalogVersion: 3 })

        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(
            expect.objectContaining({ catalogVersion: 3 })
        )
        expect(renderCacheSetMock).toHaveBeenCalledWith(
            expect.objectContaining({
                componentId,
                catalogVersion: 3,
                cacheId: 'CACHE#new-uuid-1234',
            })
        )
    })

    it('ignores invalid existingDataCategory and generates new key', async () => {
        ephemeraDBMock.putItem.mockResolvedValue(undefined)

        const dataCategory = await putCacheRecord(
            componentId,
            minimalRecord,
            'OTHER#not-cache'
        )

        expect(uuidv4Mock).toHaveBeenCalled()
        expect(dataCategory).toBe('CACHE#new-uuid-1234')
    })
})
