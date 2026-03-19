import {
    handleComponentExamplesEvent,
    type HandleComponentExamplesDependencies
} from './componentExamples'
import type { ComponentExamplesMirrorEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import type { EphemeraCacheDynamoItem } from '../renderCache'

describe('handleComponentExamplesEvent (mtw.ephemera.examples)', () => {
    const makeDeps = (): {
        deps: HandleComponentExamplesDependencies;
        queryCacheRecordsForComponent: jest.Mock;
        putCacheRecord: jest.Mock;
        deleteCacheRecord: jest.Mock;
        computePerspectiveKey: jest.Mock;
        logger: { error: jest.Mock };
    } => {
        const queryCacheRecordsForComponent = jest.fn()
        const putCacheRecord = jest.fn()
        const deleteCacheRecord = jest.fn()
        const computePerspectiveKey = jest.fn().mockReturnValue('PERSPECTIVE#v1#abc123')
        const logger = { error: jest.fn() }

        const deps: HandleComponentExamplesDependencies = {
            queryCacheRecordsForComponent,
            putCacheRecord,
            deleteCacheRecord,
            computePerspectiveKey,
            logger
        }

        return {
            deps,
            queryCacheRecordsForComponent,
            putCacheRecord,
            deleteCacheRecord,
            computePerspectiveKey,
            logger
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('writes cache records for ExampleUpdated for each parent component', async () => {
        const {
            deps,
            queryCacheRecordsForComponent,
            putCacheRecord,
            computePerspectiveKey
        } = makeDeps()
        queryCacheRecordsForComponent.mockResolvedValue([])

        const event: ComponentExamplesMirrorEvent = {
            type: 'ExampleUpdated',
            exampleId: 'EXAMPLE#one',
            parentIds: ['ROOM#one', 'FEATURE#two', 'NOT#VALID'] as any,
            assetStack: ['ASSET#one', 'ASSET#two'],
            perspectiveMatcher: { requiredAssetIds: ['ASSET#one', 'ASSET#two'], forbiddenAssetIds: [] },
            example: {
                markState: { markValue: [{ mark: 'MARK#one', value: 'value' }] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' }
            }
        }

        await handleComponentExamplesEvent(event, deps)

        expect(computePerspectiveKey).toHaveBeenCalledWith(['ASSET#one', 'ASSET#two'])
        expect(putCacheRecord).toHaveBeenCalledTimes(2)
        expect(putCacheRecord).toHaveBeenCalledWith(
            'ROOM#one',
            expect.objectContaining({
                markState: event.example.markState,
                renderedContent: event.example.renderedContent,
                provenance: event.example.provenance,
                perspectiveId: 'PERSPECTIVE#v1#abc123',
                perspectiveMatcher: event.perspectiveMatcher,
                authoredExampleId: 'EXAMPLE#one'
            }),
            undefined
        )
        expect(putCacheRecord).toHaveBeenCalledWith(
            'FEATURE#two',
            expect.objectContaining({
                markState: event.example.markState,
                renderedContent: event.example.renderedContent,
                provenance: event.example.provenance,
                perspectiveId: 'PERSPECTIVE#v1#abc123',
                perspectiveMatcher: event.perspectiveMatcher,
                authoredExampleId: 'EXAMPLE#one'
            }),
            undefined
        )
    })

    it('writes cache records with situationId when exampleId is SITUATION# (Room path)', async () => {
        const {
            deps,
            queryCacheRecordsForComponent,
            putCacheRecord,
            computePerspectiveKey
        } = makeDeps()
        queryCacheRecordsForComponent.mockResolvedValue([])

        const event: ComponentExamplesMirrorEvent = {
            type: 'ExampleUpdated',
            exampleId: 'SITUATION#situation-one',
            parentIds: ['ROOM#room-one'],
            assetStack: ['ASSET#one'],
            perspectiveMatcher: { requiredAssetIds: ['ASSET#one'], forbiddenAssetIds: [] },
            example: {
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' }
            }
        }

        await handleComponentExamplesEvent(event, deps)

        expect(computePerspectiveKey).toHaveBeenCalledWith(['ASSET#one'])
        expect(putCacheRecord).toHaveBeenCalledTimes(1)
        expect(putCacheRecord).toHaveBeenCalledWith(
            'ROOM#room-one',
            expect.objectContaining({
                markState: event.example.markState,
                renderedContent: event.example.renderedContent,
                provenance: event.example.provenance,
                perspectiveId: 'PERSPECTIVE#v1#abc123',
                perspectiveMatcher: event.perspectiveMatcher,
                situationId: 'SITUATION#situation-one'
            }),
            undefined
        )
        const putArg = putCacheRecord.mock.calls[0][1]
        expect(putArg).not.toHaveProperty('authoredExampleId')
    })

    it('deletes cache records for ExampleRemoved across all parents', async () => {
        const {
            deps,
            queryCacheRecordsForComponent,
            deleteCacheRecord
        } = makeDeps()

        const records: EphemeraCacheDynamoItem[] = [
            {
                EphemeraId: 'ROOM#one' as any,
                DataCategory: 'CACHE#one',
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#abc123',
                perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
                authoredExampleId: 'EXAMPLE#one'
            },
            {
                EphemeraId: 'ROOM#one' as any,
                DataCategory: 'CACHE#two',
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#def456',
                perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
                authoredExampleId: 'EXAMPLE#two'
            }
        ]

        queryCacheRecordsForComponent.mockResolvedValue(records)

        const event: ComponentExamplesMirrorEvent = {
            type: 'ExampleRemoved',
            exampleId: 'EXAMPLE#one',
            parentIds: ['ROOM#one', 'FEATURE#two'] as any,
            assetStack: ['ASSET#one'],
            perspectiveMatcher: { requiredAssetIds: ['ASSET#one'], forbiddenAssetIds: [] }
        }

        await handleComponentExamplesEvent(event, deps)

        expect(queryCacheRecordsForComponent).toHaveBeenCalledTimes(2)
        expect(queryCacheRecordsForComponent).toHaveBeenCalledWith('ROOM#one')
        expect(queryCacheRecordsForComponent).toHaveBeenCalledWith('FEATURE#two')

        expect(deleteCacheRecord).toHaveBeenCalledTimes(2)
        expect(deleteCacheRecord).toHaveBeenCalledWith('ROOM#one', 'CACHE#one')
        expect(deleteCacheRecord).toHaveBeenCalledWith('FEATURE#two', 'CACHE#one')
    })

    it('deletes cache records by situationId when exampleId is SITUATION#', async () => {
        const {
            deps,
            queryCacheRecordsForComponent,
            deleteCacheRecord
        } = makeDeps()

        const records: EphemeraCacheDynamoItem[] = [
            {
                EphemeraId: 'ROOM#one' as any,
                DataCategory: 'CACHE#one',
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#abc123',
                perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
                situationId: 'SITUATION#situation-one'
            },
            {
                EphemeraId: 'ROOM#one' as any,
                DataCategory: 'CACHE#two',
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#def456',
                perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
                situationId: 'SITUATION#situation-two'
            }
        ]

        queryCacheRecordsForComponent.mockResolvedValue(records)

        const event: ComponentExamplesMirrorEvent = {
            type: 'ExampleRemoved',
            exampleId: 'SITUATION#situation-one',
            parentIds: ['ROOM#one'],
            assetStack: ['ASSET#one'],
            perspectiveMatcher: { requiredAssetIds: ['ASSET#one'], forbiddenAssetIds: [] }
        }

        await handleComponentExamplesEvent(event, deps)

        expect(queryCacheRecordsForComponent).toHaveBeenCalledWith('ROOM#one')
        expect(deleteCacheRecord).toHaveBeenCalledTimes(1)
        expect(deleteCacheRecord).toHaveBeenCalledWith('ROOM#one', 'CACHE#one')
    })
})

