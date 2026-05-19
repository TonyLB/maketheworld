import {
    handleComponentExamplesEvent,
    type HandleComponentExamplesDependencies
} from './componentExamples'
import type { ComponentExamplesMirrorEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import type { EphemeraCacheDynamoItem } from './renderCache/baseClasses'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

describe('handleComponentExamplesEvent (mtw.ephemera.examples)', () => {
    const makeDeps = (): {
        deps: HandleComponentExamplesDependencies;
        internalCacheOverride: any;
        messageBus: { send: jest.Mock };
        computePerspectiveKey: jest.Mock;
        logger: { error: jest.Mock };
    } => {
        const getExactMatch = jest.fn().mockResolvedValue(null)
        const get = jest.fn().mockResolvedValue([])
        const send = jest.fn()
        const computePerspectiveKey = jest.fn().mockReturnValue('PERSPECTIVE#v1#abc123')
        const logger = { error: jest.fn() }

        const internalCacheOverride = {
            RenderCache: {
                getExactMatch,
                get
            }
        } as any

        const deps: HandleComponentExamplesDependencies = {
            internalCacheOverride,
            messageBus: { send },
            computePerspectiveKey,
            logger
        }

        return {
            deps,
            internalCacheOverride,
            messageBus: { send },
            computePerspectiveKey,
            logger
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('writes cache records with situationId for ExampleUpdated across parents', async () => {
        const {
            deps,
            internalCacheOverride,
            messageBus,
            computePerspectiveKey
        } = makeDeps()
        ;(internalCacheOverride.RenderCache.getExactMatch as jest.Mock).mockResolvedValue(null)

        const event: ComponentExamplesMirrorEvent = {
            type: 'ExampleUpdated',
            exampleId: 'SITUATION#situation-one',
            parentIds: ['ROOM#room-one', 'FEATURE#two', 'NOT#VALID'] as any,
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
        expect(messageBus.send).toHaveBeenCalledTimes(2)

        const payloads = messageBus.send.mock.calls.map((c) => c[0] as StreamingEventMessage)
        for (const msg of payloads) {
            expect(msg.type).toBe('StreamingEvent')
            expect(msg.dataSourceKey).toBe('api.ephemera')
            expect(msg.header.type).toBe('Put Cache Record')
        }

        const contents = await Promise.all(payloads.map((m) => m.getContent()))
        expect(contents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    componentId: 'ROOM#room-one',
                    record: expect.objectContaining({
                        markState: event.example.markState,
                        renderedContent: event.example.renderedContent,
                        provenance: event.example.provenance,
                        perspectiveId: 'PERSPECTIVE#v1#abc123',
                        perspectiveMatcher: event.perspectiveMatcher,
                        situationId: 'SITUATION#situation-one'
                    })
                }),
                expect.objectContaining({
                    componentId: 'FEATURE#two',
                    record: expect.objectContaining({
                        markState: event.example.markState,
                        renderedContent: event.example.renderedContent,
                        provenance: event.example.provenance,
                        perspectiveId: 'PERSPECTIVE#v1#abc123',
                        perspectiveMatcher: event.perspectiveMatcher,
                        situationId: 'SITUATION#situation-one'
                    })
                })
            ])
        )
        const putCommands = contents as Array<{ existingDataCategory?: string; record: Record<string, unknown> }>
        expect(putCommands.every((c) => c.existingDataCategory === undefined)).toBe(true)
        expect(putCommands.every((c) => !('authoredExampleId' in c.record))).toBe(true)
    })

    it('deletes cache records by situationId for ExampleRemoved', async () => {
        const {
            deps,
            internalCacheOverride,
            messageBus
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

        ;(internalCacheOverride.RenderCache.get as jest.Mock).mockResolvedValue(records)

        const event: ComponentExamplesMirrorEvent = {
            type: 'ExampleRemoved',
            exampleId: 'SITUATION#situation-one',
            parentIds: ['ROOM#one'],
            assetStack: ['ASSET#one'],
            perspectiveMatcher: { requiredAssetIds: ['ASSET#one'], forbiddenAssetIds: [] }
        }

        await handleComponentExamplesEvent(event, deps)

        expect(internalCacheOverride.RenderCache.get).toHaveBeenCalledWith('ROOM#one')
        expect(messageBus.send).toHaveBeenCalledTimes(1)

        const msg = messageBus.send.mock.calls[0][0] as StreamingEventMessage
        expect(msg.header.type).toBe('Delete Cache Records')
        expect(await msg.getContent()).toEqual({
            componentId: 'ROOM#one',
            dataCategories: ['CACHE#one']
        })
    })
})
