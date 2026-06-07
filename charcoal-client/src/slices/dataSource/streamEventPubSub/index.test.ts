import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@tonylb/mtw-interfaces/ts/subscriptions', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tonylb/mtw-interfaces/ts/subscriptions')>()
    return {
        ...actual,
        isSubscriptionClientMessage: () => true
    }
})

import { LifeLinePubSub } from '../../lifeLine/lifeLinePubSub'
import {
    StreamEventPubSub,
    makeStreamEventGuardForDataSource,
    registerDeserializer,
    unregisterDeserializer
} from './index'

const mockDeserializer = {
    serialize: vi.fn((params: any) => params.content),
    deserialize: vi.fn().mockResolvedValue({ type: 'Increment', value: 1 })
}

const bridgeTestKey = 'test.streamEventPubSub.replayAt'
const bridgeStreamKey = 'ASSET#test'
const bridgeTimestamp = 200
const snapshotUpdate = { wml: { sidecarUrl: 'https://example.com/sidecar' } }

describe('streamEventPubSub', () => {
    describe('makeStreamEventGuardForDataSource', () => {
        it('returns a guard that passes when header.dataSourceKey matches', () => {
            const guard = makeStreamEventGuardForDataSource('mtw.wml')
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#xyz',
                    timestamp: 1234,
                    type: 'Content Update'
                },
                content: { wml: '' }
            }
            expect(guard(envelope)).toBe(true)
        })

        it('returns a guard that fails when header.dataSourceKey does not match', () => {
            const guard = makeStreamEventGuardForDataSource('mtw.wml')
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets.contentHeaders',
                    streamKey: 'global',
                    timestamp: 1234,
                    type: 'Snapshot'
                },
                content: {}
            }
            expect(guard(envelope)).toBe(false)
        })

        it('returns a guard that fails when header is missing dataSourceKey', () => {
            const guard = makeStreamEventGuardForDataSource('mtw.wml')
            const envelope = {
                header: {
                    streamKey: 'ASSET#xyz',
                    timestamp: 1234,
                    type: 'Content Update'
                } as any,
                content: {}
            }
            expect(guard(envelope)).toBe(false)
        })
    })

    describe('registerDeserializer / unregisterDeserializer', () => {
        const testKey = 'test.streamEventPubSub.reg'

        beforeEach(() => {
            unregisterDeserializer(testKey)
        })

        it('registerDeserializer accepts a deserializer without throwing', () => {
            expect(() => registerDeserializer(testKey, mockDeserializer)).not.toThrow()
        })

        it('unregisterDeserializer removes a registered deserializer without throwing', () => {
            registerDeserializer(testKey, mockDeserializer)
            expect(() => unregisterDeserializer(testKey)).not.toThrow()
        })

        it('unregisterDeserializer is idempotent for unknown keys', () => {
            expect(() => unregisterDeserializer('unknown.key')).not.toThrow()
        })
    })

    describe('StreamEventPubSub', () => {
        it('subscribe returns a subscription id', () => {
            const callback = vi.fn()
            const id = StreamEventPubSub.subscribe(callback)
            expect(typeof id).toBe('string')
            expect(id.length).toBeGreaterThan(0)
        })

        it('publish delivers payload to subscribers', () => {
            const callback = vi.fn()
            StreamEventPubSub.subscribe(callback)
            const payload = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234,
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test',
                    timestamp: 1234,
                    type: 'Content Update'
                },
                content: { wml: '' }
            }
            StreamEventPubSub.publish(payload)
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload,
                    unsubscribe: expect.any(Function)
                })
            )
        })

        it('unsubscribe removes subscriber', () => {
            const callback = vi.fn()
            const id = StreamEventPubSub.subscribe(callback)
            StreamEventPubSub.unsubscribe(id)
            const payload = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234,
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test',
                    timestamp: 1234,
                    type: 'Content Update'
                },
                content: {}
            }
            StreamEventPubSub.publish(payload)
            expect(callback).not.toHaveBeenCalled()
        })
    })

    describe('LifeLine bridge replayAt wire-shape', () => {
        beforeEach(() => {
            unregisterDeserializer(bridgeTestKey)
            mockDeserializer.deserialize.mockReset()
            mockDeserializer.deserialize.mockResolvedValue({ type: 'Snapshot', wml: snapshotUpdate.wml })
            registerDeserializer(bridgeTestKey, mockDeserializer)
        })

        afterEach(() => {
            unregisterDeserializer(bridgeTestKey)
        })

        const publishWireMessage = (wireMessage: Record<string, unknown>) => {
            LifeLinePubSub.publish(wireMessage as any)
        }

        const baseWireMessage = {
            messageType: 'StreamEvent' as const,
            dataSourceKey: bridgeTestKey,
            streamKey: bridgeStreamKey,
            timestamp: bridgeTimestamp,
            update: snapshotUpdate
        }

        it('case B: lifts replayAt from flat header field on Snapshot', async () => {
            const callback = vi.fn()
            StreamEventPubSub.subscribe(callback)

            publishWireMessage({
                ...baseWireMessage,
                eventType: 'Snapshot',
                replayAt: 150
            })

            await vi.waitFor(() => {
                expect(callback).toHaveBeenCalled()
            })

            expect(callback.mock.calls[0][0].payload.replayAt).toBe(150)
        })

        it('case C: lifts replayAt from nested extendedHeader on Snapshot', async () => {
            const callback = vi.fn()
            StreamEventPubSub.subscribe(callback)

            publishWireMessage({
                ...baseWireMessage,
                eventType: 'Snapshot',
                extendedHeader: { replayAt: 150 }
            })

            await vi.waitFor(() => {
                expect(callback).toHaveBeenCalled()
            })

            expect(callback.mock.calls[0][0].payload.replayAt).toBe(150)
        })

        it('case E: does not lift replayAt from update on non-Snapshot events', async () => {
            mockDeserializer.deserialize.mockResolvedValue({ type: 'Content Update', wml: '<Asset />' })
            const callback = vi.fn()
            StreamEventPubSub.subscribe(callback)

            publishWireMessage({
                ...baseWireMessage,
                eventType: 'Content Update',
                update: { wml: '<Asset />', replayAt: 150 }
            })

            await vi.waitFor(() => {
                expect(callback).toHaveBeenCalled()
            })

            expect(callback.mock.calls[0][0].payload.replayAt).toBeUndefined()
        })

        it('case F: Snapshot without header replayAt yields undefined replayAt', async () => {
            const callback = vi.fn()
            StreamEventPubSub.subscribe(callback)

            publishWireMessage({
                ...baseWireMessage,
                eventType: 'Snapshot'
            })

            await vi.waitFor(() => {
                expect(callback).toHaveBeenCalled()
            })

            expect(callback.mock.calls[0][0].payload.replayAt).toBeUndefined()
        })
    })
})
