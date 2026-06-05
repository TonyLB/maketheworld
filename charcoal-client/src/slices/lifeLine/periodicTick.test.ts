import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LifeLinePubSub } from './index.api'
import type { LifeLinePubSubData } from './lifeLine'
import {
    isPeriodicTickLifeLineMessage,
    startPeriodicTickPublisher,
    stopPeriodicTickPublisher,
} from './periodicTick'

describe('periodicTick', () => {
    afterEach(() => {
        stopPeriodicTickPublisher()
        vi.useRealTimers()
    })

    describe('isPeriodicTickLifeLineMessage', () => {
        it('returns true for a PeriodicTick payload', () => {
            expect(isPeriodicTickLifeLineMessage({ messageType: 'PeriodicTick', now: 123 })).toBe(true)
        })

        it('returns false for other message types', () => {
            const messagesPayload = {
                messageType: 'Messages',
                messages: [],
            } as unknown as LifeLinePubSubData
            expect(isPeriodicTickLifeLineMessage(messagesPayload)).toBe(false)
        })

        it('returns false when now is missing or not a number', () => {
            expect(isPeriodicTickLifeLineMessage({ messageType: 'PeriodicTick' } as LifeLinePubSubData)).toBe(false)
            expect(isPeriodicTickLifeLineMessage({ messageType: 'PeriodicTick', now: '123' } as unknown as LifeLinePubSubData)).toBe(false)
        })
    })

    describe('LifeLinePubSub delivery', () => {
        it('publish delivers PeriodicTick payload to subscribers', () => {
            const callback = vi.fn()
            LifeLinePubSub.subscribe(callback)
            const payload = { messageType: 'PeriodicTick' as const, now: 123 }
            LifeLinePubSub.publish(payload)
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload,
                    unsubscribe: expect.any(Function),
                })
            )
        })
    })

    describe('startPeriodicTickPublisher / stopPeriodicTickPublisher', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })

        it('publishes PeriodicTick on interval with injectable getNow', () => {
            const callback = vi.fn()
            LifeLinePubSub.subscribe(({ payload }) => {
                if (isPeriodicTickLifeLineMessage(payload)) {
                    callback(payload)
                }
            })

            startPeriodicTickPublisher({ intervalMs: 1000, getNow: () => 42 })
            vi.advanceTimersByTime(1000)
            expect(callback).toHaveBeenCalledTimes(1)
            expect(callback).toHaveBeenCalledWith({ messageType: 'PeriodicTick', now: 42 })

            vi.advanceTimersByTime(1000)
            expect(callback).toHaveBeenCalledTimes(2)
        })

        it('is idempotent on second start', () => {
            const callback = vi.fn()
            LifeLinePubSub.subscribe(({ payload }) => {
                if (isPeriodicTickLifeLineMessage(payload)) {
                    callback(payload)
                }
            })

            startPeriodicTickPublisher({ intervalMs: 1000, getNow: () => 1 })
            startPeriodicTickPublisher({ intervalMs: 1000, getNow: () => 2 })
            vi.advanceTimersByTime(1000)
            expect(callback).toHaveBeenCalledTimes(1)
            expect(callback).toHaveBeenCalledWith({ messageType: 'PeriodicTick', now: 1 })
        })

        it('stopPeriodicTickPublisher prevents further publishes', () => {
            const callback = vi.fn()
            LifeLinePubSub.subscribe(({ payload }) => {
                if (isPeriodicTickLifeLineMessage(payload)) {
                    callback(payload)
                }
            })

            startPeriodicTickPublisher({ intervalMs: 1000, getNow: () => 99 })
            vi.advanceTimersByTime(1000)
            expect(callback).toHaveBeenCalledTimes(1)

            stopPeriodicTickPublisher()
            vi.advanceTimersByTime(5000)
            expect(callback).toHaveBeenCalledTimes(1)
        })

        it('ignores non-PeriodicTick payloads in tick-only subscriber', () => {
            const tickCallback = vi.fn()
            LifeLinePubSub.subscribe(({ payload }) => {
                if (!isPeriodicTickLifeLineMessage(payload)) {
                    return
                }
                tickCallback(payload)
            })

            const messagesPayload = {
                messageType: 'Messages',
                messages: [],
            } as unknown as LifeLinePubSubData
            LifeLinePubSub.publish(messagesPayload)
            expect(tickCallback).not.toHaveBeenCalled()
        })
    })
})
