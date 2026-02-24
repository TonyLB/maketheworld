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
        computePerspectiveId: jest.Mock;
        logger: { error: jest.Mock };
    } => {
        const queryCacheRecordsForComponent = jest.fn()
        const putCacheRecord = jest.fn()
        const deleteCacheRecord = jest.fn()
        const computePerspectiveId = jest.fn().mockReturnValue('PERSPECTIVE#abc123')
        const logger = { error: jest.fn() }

        const deps: HandleComponentExamplesDependencies = {
            queryCacheRecordsForComponent,
            putCacheRecord,
            deleteCacheRecord,
            computePerspectiveId,
            logger
        }

        return {
            deps,
            queryCacheRecordsForComponent,
            putCacheRecord,
            deleteCacheRecord,
            computePerspectiveId,
            logger
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('writes cache records for ExampleUpdated for each parent component', async () => {
        const {
            deps,
            putCacheRecord,
            computePerspectiveId
        } = makeDeps()

        const event: ComponentExamplesMirrorEvent = {
            type: 'ExampleUpdated',
            exampleId: 'EXAMPLE#one',
            parentIds: ['ROOM#one', 'FEATURE#two', 'NOT#VALID'] as any,
            assetStack: ['ASSET#one', 'ASSET#two'],
            example: {
                markState: { markValue: [{ mark: 'MARK#one', value: 'value' }] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' }
            }
        }

        await handleComponentExamplesEvent(event, deps)

        expect(computePerspectiveId).toHaveBeenCalledWith(['ASSET#one', 'ASSET#two'])
        expect(putCacheRecord).toHaveBeenCalledTimes(2)
        expect(putCacheRecord).toHaveBeenCalledWith(
            'ROOM#one',
            expect.objectContaining({
                markState: event.example.markState,
                renderedContent: event.example.renderedContent,
                provenance: event.example.provenance,
                perspectiveId: 'PERSPECTIVE#abc123',
                authoredExampleId: 'EXAMPLE#one'
            })
        )
        expect(putCacheRecord).toHaveBeenCalledWith(
            'FEATURE#two',
            expect.objectContaining({
                markState: event.example.markState,
                renderedContent: event.example.renderedContent,
                provenance: event.example.provenance,
                perspectiveId: 'PERSPECTIVE#abc123',
                authoredExampleId: 'EXAMPLE#one'
            })
        )
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
                authoredExampleId: 'EXAMPLE#one'
            },
            {
                EphemeraId: 'ROOM#one' as any,
                DataCategory: 'CACHE#two',
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#def456',
                authoredExampleId: 'EXAMPLE#two'
            }
        ]

        queryCacheRecordsForComponent.mockResolvedValue(records)

        const event: ComponentExamplesMirrorEvent = {
            type: 'ExampleRemoved',
            exampleId: 'EXAMPLE#one',
            parentIds: ['ROOM#one', 'FEATURE#two'] as any,
            assetStack: ['ASSET#one']
        }

        await handleComponentExamplesEvent(event, deps)

        expect(queryCacheRecordsForComponent).toHaveBeenCalledTimes(2)
        expect(queryCacheRecordsForComponent).toHaveBeenCalledWith('ROOM#one')
        expect(queryCacheRecordsForComponent).toHaveBeenCalledWith('FEATURE#two')

        expect(deleteCacheRecord).toHaveBeenCalledTimes(2)
        expect(deleteCacheRecord).toHaveBeenCalledWith('ROOM#one', 'CACHE#one')
        expect(deleteCacheRecord).toHaveBeenCalledWith('FEATURE#two', 'CACHE#one')
    })
})

