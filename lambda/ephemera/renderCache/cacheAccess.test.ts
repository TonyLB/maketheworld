jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('uuid')

import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    queryCacheRecordsForComponent,
    putCacheRecord,
    deleteCacheRecord,
    type PutCacheRecordInput
} from './cacheAccess'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const uuidv4Mock = uuidv4 as jest.Mock

const componentId = 'ROOM#test-room-uuid' as const

const minimalRecord = {
    markState: { markValue: [{ mark: 'MARK#mark-uuid', value: 'sunny' }] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' as const },
    perspectiveId: 'test-perspective'
} as PutCacheRecordInput

describe('renderCache/cacheAccess', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        uuidv4Mock.mockReturnValue('new-uuid-1234')
    })

    describe('queryCacheRecordsForComponent', () => {
        it('returns cache-shaped items from ephemeraDB.query', async () => {
            const items = [
                {
                    EphemeraId: componentId,
                    DataCategory: 'CACHE#abc',
                    markState: minimalRecord.markState,
                    renderedContent: minimalRecord.renderedContent,
                    provenance: minimalRecord.provenance,
                    perspectiveId: minimalRecord.perspectiveId
                }
            ]
            ephemeraDBMock.query.mockResolvedValue(items)

            const result = await queryCacheRecordsForComponent(componentId)

            expect(ephemeraDBMock.query).toHaveBeenCalledTimes(1)
            expect(ephemeraDBMock.query).toHaveBeenCalledWith({
                Key: { EphemeraId: componentId },
                KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
                ExpressionAttributeValues: { ':dcPrefix': 'CACHE#' },
                allFields: true
            })
            expect(result).toEqual(items)
        })

        it('returns empty array when query returns no items', async () => {
            ephemeraDBMock.query.mockResolvedValue([])

            const result = await queryCacheRecordsForComponent(componentId)

            expect(ephemeraDBMock.query).toHaveBeenCalledWith({
                Key: { EphemeraId: componentId },
                KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
                ExpressionAttributeValues: { ':dcPrefix': 'CACHE#' },
                allFields: true
            })
            expect(result).toEqual([])
        })

        it('filters out items that fail isEphemeraCacheDynamoItem', async () => {
            const valid = {
                EphemeraId: componentId,
                DataCategory: 'CACHE#valid',
                markState: minimalRecord.markState,
                renderedContent: minimalRecord.renderedContent,
                provenance: minimalRecord.provenance,
                perspectiveId: minimalRecord.perspectiveId
            }
            ephemeraDBMock.query.mockResolvedValue([
                valid,
                { EphemeraId: componentId, DataCategory: 'OTHER#x' } as any,
                { EphemeraId: componentId, DataCategory: 'CACHE#bad', markState: null } as any
            ])

            const result = await queryCacheRecordsForComponent(componentId)

            expect(result).toEqual([valid])
        })
    })

    describe('putCacheRecord', () => {
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
                perspectiveId: minimalRecord.perspectiveId
            })
        })

        it('includes authoredExampleId when provided', async () => {
            ephemeraDBMock.putItem.mockResolvedValue(undefined)

            await putCacheRecord(componentId, {
                ...minimalRecord,
                authoredExampleId: 'EXAMPLE#example-uuid'
            })

            expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(
                expect.objectContaining({
                    EphemeraId: componentId,
                    DataCategory: 'CACHE#new-uuid-1234',
                    authoredExampleId: 'EXAMPLE#example-uuid'
                })
            )
        })

        it('omits authoredExampleId when not provided', async () => {
            ephemeraDBMock.putItem.mockResolvedValue(undefined)

            await putCacheRecord(componentId, minimalRecord)

            const call = ephemeraDBMock.putItem.mock.calls[0][0]
            expect(call).not.toHaveProperty('authoredExampleId')
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

    describe('deleteCacheRecord', () => {
        it('calls deleteItem with EphemeraId and DataCategory', async () => {
            ephemeraDBMock.deleteItem.mockResolvedValue(undefined)

            await deleteCacheRecord(componentId, 'CACHE#some-uuid')

            expect(ephemeraDBMock.deleteItem).toHaveBeenCalledTimes(1)
            expect(ephemeraDBMock.deleteItem).toHaveBeenCalledWith({
                EphemeraId: componentId,
                DataCategory: 'CACHE#some-uuid'
            })
        })
    })
})
