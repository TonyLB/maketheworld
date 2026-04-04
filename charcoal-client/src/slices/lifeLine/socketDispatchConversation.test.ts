import { describe, it, expect, vi } from 'vitest'
import type { EphemeraAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'

import { LifeLinePubSub, socketDispatchConversation, matchesCorrelationPayload } from './index.api'
import type { LifeLinePubSubData } from './lifeLine'

describe('matchesCorrelationPayload', () => {
    const params = {
        conversationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        requestId: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
        matchRequestIdFallback: false,
    }

    it('matches when conversationId equals', () => {
        const payload = {
            messageType: 'Messages' as const,
            messages: [],
            LastSync: null as number | null,
            conversationId: params.conversationId,
        } as unknown as LifeLinePubSubData
        expect(matchesCorrelationPayload(payload, params)).toBe(true)
    })

    it('does not match RequestId when fallback is false', () => {
        const payload = {
            messageType: 'Messages' as const,
            messages: [],
            LastSync: null as number | null,
            RequestId: params.requestId,
        } as unknown as LifeLinePubSubData
        expect(matchesCorrelationPayload(payload, params)).toBe(false)
    })

    it('matches RequestId when fallback is true', () => {
        const payload = {
            messageType: 'Messages' as const,
            messages: [],
            LastSync: null as number | null,
            RequestId: params.requestId,
        } as unknown as LifeLinePubSubData
        expect(
            matchesCorrelationPayload(payload, { ...params, matchRequestIdFallback: true })
        ).toBe(true)
    })

    it('returns false when neither matches', () => {
        const payload = {
            messageType: 'Messages' as const,
            messages: [],
            LastSync: null as number | null,
        } as unknown as LifeLinePubSubData
        expect(matchesCorrelationPayload(payload, params)).toBe(false)
    })
})

describe('socketDispatchConversation', () => {
    it('subscribes before send, delivers correlated events, and unsubscribe stops further events', async () => {
        const onEvent = vi.fn()
        const mockSend = vi.fn()
        const conversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        const getState = () => ({
            lifeLine: {
                meta: { currentState: 'CONNECTED' },
                publicData: { webSocket: { send: mockSend } },
            },
        })
        const dispatch = vi.fn()
        const thunk = socketDispatchConversation(
            { message: 'fetchEphemera', conversationId } as EphemeraAPIMessage & { conversationId?: string },
            { onEvent, service: 'ephemera' }
        )
        const result = await thunk(dispatch as any, getState as any, undefined as any)
        expect(mockSend).toHaveBeenCalledTimes(1)
        const sent = JSON.parse(mockSend.mock.calls[0][0] as string)
        expect(sent.conversationId).toBe(conversationId)
        expect(sent.RequestId).toBeDefined()
        expect(sent.service).toBe('ephemera')

        const first = {
            messageType: 'Ephemera' as const,
            updates: [],
            conversationId,
        } as unknown as LifeLinePubSubData
        LifeLinePubSub.publish(first)
        expect(onEvent).toHaveBeenCalledTimes(1)

        result.unsubscribe()
        LifeLinePubSub.publish(first)
        expect(onEvent).toHaveBeenCalledTimes(1)
    })

    it('treats Error as terminal by default and stops the subscription', async () => {
        const onEvent = vi.fn()
        const onTerminal = vi.fn()
        const mockSend = vi.fn()
        const conversationId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        const getState = () => ({
            lifeLine: {
                meta: { currentState: 'CONNECTED' },
                publicData: { webSocket: { send: mockSend } },
            },
        })
        const dispatch = vi.fn()
        const thunk = socketDispatchConversation(
            { message: 'fetchEphemera', conversationId } as EphemeraAPIMessage & { conversationId?: string },
            { onEvent, onTerminal, service: 'ephemera' }
        )
        const result = await thunk(dispatch as any, getState as any, undefined as any)
        const errPayload = {
            messageType: 'Error' as const,
            conversationId,
            error: 'test error',
        } as unknown as LifeLinePubSubData
        LifeLinePubSub.publish(errPayload)
        expect(onEvent).toHaveBeenCalledTimes(1)
        expect(onTerminal).toHaveBeenCalledWith(errPayload)
        LifeLinePubSub.publish(errPayload)
        expect(onEvent).toHaveBeenCalledTimes(1)
        result.unsubscribe()
    })

    it('rejects when socket is not connected', async () => {
        const getState = () => ({
            lifeLine: {
                meta: { currentState: 'INITIAL' },
                publicData: { webSocket: null },
            },
        })
        const dispatch = vi.fn()
        const thunk = socketDispatchConversation(
            { message: 'fetchEphemera' } as EphemeraAPIMessage & { conversationId?: string },
            { onEvent: vi.fn(), service: 'ephemera' }
        )
        await expect(thunk(dispatch as any, getState as any, undefined as any)).rejects.toMatchObject({
            message: 'fetchEphemera',
        })
    })

    it('uses custom isTerminal to end subscription after a non-terminal then terminal payload', async () => {
        const onEvent = vi.fn()
        const onTerminal = vi.fn()
        const mockSend = vi.fn()
        const conversationId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
        const getState = () => ({
            lifeLine: {
                meta: { currentState: 'CONNECTED' },
                publicData: { webSocket: { send: mockSend } },
            },
        })
        const dispatch = vi.fn()
        const isTerminal = (payload: unknown) =>
            typeof payload === 'object' &&
            payload !== null &&
            (payload as { messageType?: string; step?: string }).messageType === 'SyntheticStream' &&
            (payload as { step?: string }).step === 'done'

        const thunk = socketDispatchConversation(
            { message: 'fetchEphemera', conversationId } as EphemeraAPIMessage & { conversationId?: string },
            { onEvent, onTerminal, service: 'ephemera', isTerminal }
        )
        await thunk(dispatch as any, getState as any, undefined as any)
        const progress = {
            messageType: 'SyntheticStream' as const,
            conversationId,
            step: 'progress' as const,
        } as unknown as LifeLinePubSubData
        LifeLinePubSub.publish(progress)
        expect(onEvent).toHaveBeenCalledTimes(1)
        expect(onTerminal).not.toHaveBeenCalled()
        const done = {
            messageType: 'SyntheticStream' as const,
            conversationId,
            step: 'done' as const,
        } as unknown as LifeLinePubSubData
        LifeLinePubSub.publish(done)
        expect(onEvent).toHaveBeenCalledTimes(2)
        expect(onTerminal).toHaveBeenCalledWith(done)
        LifeLinePubSub.publish(done)
        expect(onEvent).toHaveBeenCalledTimes(2)
    })
})
