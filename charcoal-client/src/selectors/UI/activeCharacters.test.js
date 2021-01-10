import { getActiveCharacterState, getActiveCharactersUI } from './activeCharacters'
import {
    ACTIVE_CHARACTER_FSM_INVALID,
    ACTIVE_CHARACTER_FSM_INITIAL,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED,
    ACTIVE_CHARACTER_FSM_CONNECTING,
    ACTIVE_CHARACTER_FSM_CONNECTED,
    ACTIVE_CHARACTER_FSM_RECONNECTING
} from '../../actions/UI/activeCharacters'

describe('activeCharacters selectors', () => {
    describe('getActiveCharacterState', () => {
        const testState = {
            UI: {
                activeCharacters: {
                    ABC: {
                        state: ACTIVE_CHARACTER_FSM_INITIAL,
                        CharacterId: 'ABC'
                    }
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
            UI: {
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
                        CharacterId: 'SUBSCRIBED'
                    },
                    CONNECTING: {
                        state: ACTIVE_CHARACTER_FSM_CONNECTING,
                        CharacterId: 'CONNECTING'
                    },
                    CONNECTED: {
                        state: ACTIVE_CHARACTER_FSM_CONNECTED,
                        CharacterId: 'CONNECTED'
                    },
                    RECONNECTING: {
                        state: ACTIVE_CHARACTER_FSM_RECONNECTING,
                        CharacterId: 'RECONNECTING'
                    }
                }
            }
        }

        it('should correctly derive values for all states', () => {
            expect(getActiveCharactersUI(testState)).toEqual({
                INVALID: {
                    CharacterId: 'INVALID',
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: false
                },
                INITIAL: {
                    CharacterId: 'INITIAL',
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: false
                },
                SUBSCRIBING: {
                    CharacterId: 'SUBSCRIBING',
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: true,
                    isSubscribed: false
                },
                SUBSCRIBED: {
                    CharacterId: 'SUBSCRIBED',
                    isConnecting: false,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: true
                },
                CONNECTING: {
                    CharacterId: 'CONNECTING',
                    isConnecting: true,
                    isConnected: false,
                    isSubscribing: false,
                    isSubscribed: true
                },
                CONNECTED: {
                    CharacterId: 'CONNECTED',
                    isConnecting: false,
                    isConnected: true,
                    isSubscribing: false,
                    isSubscribed: true
                },
                RECONNECTING: {
                    CharacterId: 'RECONNECTING',
                    isConnecting: false,
                    isConnected: true,
                    isSubscribing: false,
                    isSubscribed: true
                }
            })
        })

    })
})