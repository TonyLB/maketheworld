import { getActiveCharacterState, getActiveCharacters } from './activeCharacters'
import {
    ACTIVE_CHARACTER_FSM_INVALID,
    ACTIVE_CHARACTER_FSM_INITIAL,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED,
    ACTIVE_CHARACTER_FSM_CONNECTING,
    ACTIVE_CHARACTER_FSM_CONNECTED,
    ACTIVE_CHARACTER_FSM_RECONNECTING
} from '../actions/activeCharacters'

describe('activeCharacters selectors', () => {
    describe('getActiveCharacterState', () => {
        const testState = {
            activeCharacters: {
                ABC: {
                    state: ACTIVE_CHARACTER_FSM_INITIAL,
                    CharacterId: 'ABC'
                }
            }
        }

        it('should extract state from the object when available', () => {
            expect(getActiveCharacterState('ABC')(testState)).toEqual(ACTIVE_CHARACTER_FSM_INITIAL)
        })

        it('should correct return invalid when object not available', () => {
            expect(getActiveCharacterState('DEF')(testState)).toEqual(ACTIVE_CHARACTER_FSM_INVALID)
        })
    })

    describe('getActiveCharactersUI', () => {
        const testState = {
            activeCharacters: {
                INVALID: {
                    state: ACTIVE_CHARACTER_FSM_INVALID,
                    CharacterId: 'INVALID'
                },
                INITIAL: {
                    state: ACTIVE_CHARACTER_FSM_INITIAL,
                    CharacterId: 'INITIAL'
                },
                SUBSCRIBING: {
                    state: ACTIVE_CHARACTER_FSM_SUBSCRIBING,
                    CharacterId: 'SUBSCRIBING'
                },
                SUBSCRIBED: {
                    state: ACTIVE_CHARACTER_FSM_SUBSCRIBED,
                    CharacterId: 'SUBSCRIBED',
                    subscription: '123'
                },
                CONNECTING: {
                    state: ACTIVE_CHARACTER_FSM_CONNECTING,
                    CharacterId: 'CONNECTING',
                    subscription: '123'
                },
                CONNECTED: {
                    state: ACTIVE_CHARACTER_FSM_CONNECTED,
                    CharacterId: 'CONNECTED',
                    subscription: '123'
                },
                RECONNECTING: {
                    state: ACTIVE_CHARACTER_FSM_RECONNECTING,
                    CharacterId: 'RECONNECTING',
                    subscription: '123'
                }
            }
        }

        it('should correctly derive values for all states', () => {
            expect(getActiveCharacters(testState)).toEqual({
                INVALID: {
                    CharacterId: 'INVALID',
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: false,
                    state: ACTIVE_CHARACTER_FSM_INVALID
                },
                INITIAL: {
                    CharacterId: 'INITIAL',
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: false,
                    state: ACTIVE_CHARACTER_FSM_INITIAL
                },
                SUBSCRIBING: {
                    CharacterId: 'SUBSCRIBING',
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: true,
                    isSubscribed: false,
                    state: ACTIVE_CHARACTER_FSM_SUBSCRIBING
                },
                SUBSCRIBED: {
                    CharacterId: 'SUBSCRIBED',
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: true,
                    subscription: '123',
                    state: ACTIVE_CHARACTER_FSM_SUBSCRIBED
                },
                CONNECTING: {
                    CharacterId: 'CONNECTING',
                    isConnecting: true,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: true,
                    subscription: '123',
                    state: ACTIVE_CHARACTER_FSM_CONNECTING
                },
                CONNECTED: {
                    CharacterId: 'CONNECTED',
                    isConnecting: false,
                    isConnected: true,
                    isSubscribing: false,
                    isSubscribed: true,
                    subscription: '123',
                    state: ACTIVE_CHARACTER_FSM_CONNECTED
                },
                RECONNECTING: {
                    CharacterId: 'RECONNECTING',
                    isConnecting: false,
                    isConnected: true,
                    isSubscribing: false,
                    isSubscribed: true,
                    subscription: '123',
                    state: ACTIVE_CHARACTER_FSM_RECONNECTING
                }
            })
        })

    })
})