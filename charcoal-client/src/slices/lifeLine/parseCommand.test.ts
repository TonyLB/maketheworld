import { describe, expect, it, vi } from 'vitest'

import { parseCommand } from './index.api'

describe('parseCommand', () => {
    const CharacterId = 'CHARACTER#test-character-id' as const

    const setupHarness = () => {
        const mockSend = vi.fn()
        const getState = () => ({
            lifeLine: {
                meta: { currentState: 'CONNECTED' },
                publicData: { webSocket: { send: mockSend } },
            },
        })
        const dispatch = ((action: unknown) => {
            if (typeof action === 'function') {
                return (action as (dispatch: unknown, getState: unknown, extra: unknown) => unknown)(
                    dispatch,
                    getState,
                    undefined
                )
            }
            return action
        }) as unknown as (action: unknown) => unknown
        return { mockSend, dispatch, getState }
    }

    it('uses fire-and-forget command dispatch by default', () => {
        const { mockSend, dispatch, getState } = setupHarness()
        const result = parseCommand(CharacterId)({
            mode: 'Command',
            entry: 'look',
            raiseError: vi.fn(),
        })(dispatch as never, getState as never, undefined as never)

        expect(result).toBe(true)
        expect(mockSend).toHaveBeenCalledTimes(1)
        const outbound = JSON.parse(mockSend.mock.calls[0][0] as string)
        expect(outbound.message).toBe('command')
        expect(outbound.command).toBe('look')
        expect(outbound.RequestId).toBeUndefined()
    })

    it('uses promise dispatch for command mode when requested', () => {
        const { mockSend, dispatch, getState } = setupHarness()
        const result = parseCommand(CharacterId)({
            mode: 'Command',
            entry: 'inventory',
            raiseError: vi.fn(),
            commandDispatchStrategy: 'promise',
        })(dispatch as never, getState as never, undefined as never)

        expect(result).toBe(true)
        expect(mockSend).toHaveBeenCalledTimes(1)
        const outbound = JSON.parse(mockSend.mock.calls[0][0] as string)
        expect(outbound.message).toBe('command')
        expect(outbound.command).toBe('inventory')
        expect(typeof outbound.RequestId).toBe('string')
        expect(outbound.RequestId.length).toBeGreaterThan(0)
    })

    it('keeps non-command messages on fire-and-forget dispatch', () => {
        const { mockSend, dispatch, getState } = setupHarness()
        const result = parseCommand(CharacterId)({
            mode: 'SayMessage',
            entry: 'hello',
            raiseError: vi.fn(),
            commandDispatchStrategy: 'promise',
        })(dispatch as never, getState as never, undefined as never)

        expect(result).toBe(true)
        expect(mockSend).toHaveBeenCalledTimes(1)
        const outbound = JSON.parse(mockSend.mock.calls[0][0] as string)
        expect(outbound.message).toBe('action')
        expect(outbound.actionType).toBe('SayMessage')
        expect(outbound.payload.Message).toBe('hello')
        expect(outbound.RequestId).toBeUndefined()
    })
})
