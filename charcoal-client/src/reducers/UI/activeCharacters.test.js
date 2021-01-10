import activeCharacters from './activeCharacters.js'
import {
    ACTIVATE_CHARACTER,
    DEACTIVATE_CHARACTER,
    ACTIVE_CHARACTER_FSM_INITIAL,
    ACTIVE_CHARACTER_FSM_SUBSCRIBED,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT,
    ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS,
    ACTIVE_CHARACTER_SUBSCRIBE_FAIL,
    ACTIVE_CHARACTER_CONNECT_ATTEMPT,
    ACTIVE_CHARACTER_FSM_CONNECTING,
    ACTIVE_CHARACTER_CONNECT_SUCCESS,
    ACTIVE_CHARACTER_CONNECT_FAIL,
    ACTIVE_CHARACTER_FSM_CONNECTED,
    ACTIVE_CHARACTER_FSM_RECONNECTING,
    ACTIVE_CHARACTER_RECONNECT_ATTEMPT
} from '../../actions/UI/activeCharacters'

const testState = {
    TESS: {
        CharacterId: 'TESS',
        status: ACTIVE_CHARACTER_FSM_SUBSCRIBED
    }
}

describe('ActiveCharacters reducer', () => {
    it('should return an empty map by default', () => {
        expect(activeCharacters()).toEqual({})
    })

    it('should return unchanged on a different action type', () => {
        expect(activeCharacters(testState, { type: 'OTHER' })).toEqual(testState)
    })

    it('should return unchanged on activating an already active character', () => {
        expect(activeCharacters(testState, { type: ACTIVATE_CHARACTER, CharacterId: 'TESS' })).toEqual(testState)
    })

    it('should add an activated character on activate', () => {
        expect(activeCharacters(testState, { type: ACTIVATE_CHARACTER, CharacterId: 'MARCO' })).toEqual({
            ...testState,
            MARCO: {
                CharacterId: 'MARCO',
                status: ACTIVE_CHARACTER_FSM_INITIAL
            }
        })
    })

    it('should remove an activated character on deactivate', () => {
        expect(activeCharacters({
            ...testState,
            MARCO: {
                CharacterId: 'MARCO',
                status: ACTIVE_CHARACTER_FSM_SUBSCRIBED
            }
        }, { type: DEACTIVATE_CHARACTER, CharacterId: 'MARCO' })).toEqual(testState)
    })

    it('should return unchanged on deactivating a character that is not activated', () => {
        expect(activeCharacters(testState, { type: DEACTIVATE_CHARACTER, CharacterId: 'MARCO' })).toEqual(testState)
    })

    it('should transition FSM from initial to subscribing on ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT', () => {
        expect(activeCharacters({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_INITIAL,
                CharacterId: 'MARCO'
            }
        }, { type: ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT, CharacterId: 'MARCO' })).toEqual({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_SUBSCRIBING,
                CharacterId: 'MARCO'
            }
        })
    })

    it('should transition FSM from subscribing to subscribed on ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS', () => {
        expect(activeCharacters({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_SUBSCRIBING,
                CharacterId: 'MARCO'
            }
        }, { type: ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS, CharacterId: 'MARCO', subscription: 'Test' })).toEqual({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_SUBSCRIBED,
                CharacterId: 'MARCO',
                subscriptions: {
                    messages: 'Test'
                }
            }
        })
    })

    //
    // TO-DO:  Create unified error delivery architecture in order to deliver a user-friendly message upon
    // subscription failure
    //
    it('should transition FSM from subscribing to initial on ACTIVE_CHARACTER_SUBSCRIBE_FAIL', () => {
        expect(activeCharacters({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_SUBSCRIBING,
                CharacterId: 'MARCO'
            }
        }, { type: ACTIVE_CHARACTER_SUBSCRIBE_FAIL, CharacterId: 'MARCO' })).toEqual({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_INITIAL,
                CharacterId: 'MARCO',
            }
        })
    })

    it('should transition FSM from subscribed to connecting on ACTIVE_CHARACTER_CONNECT_ATTEMPT', () => {
        expect(activeCharacters({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_SUBSCRIBED,
                CharacterId: 'MARCO',
                subscriptions: { messages: 'Test' }
            }
        }, { type: ACTIVE_CHARACTER_CONNECT_ATTEMPT, CharacterId: 'MARCO' })).toEqual({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_CONNECTING,
                CharacterId: 'MARCO',
                subscriptions: {
                    messages: 'Test'
                }
            }
        })
    })

    it('should transition FSM from connecting to connected on ACTIVE_CHARACTER_CONNECT_SUCCESS', () => {
        expect(activeCharacters({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_CONNECTING,
                CharacterId: 'MARCO',
                subscriptions: {
                    messages: 'Test'
                }
            }
        }, { type: ACTIVE_CHARACTER_CONNECT_SUCCESS, CharacterId: 'MARCO', connection: 'Test' })).toEqual({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_CONNECTED,
                CharacterId: 'MARCO',
                subscriptions: {
                    messages: 'Test'
                },
                connection: 'Test'
            }
        })
    })

    //
    // TO-DO:  Create unified error delivery architecture in order to deliver a user-friendly message upon
    // connection failure
    //
    it('should transition FSM from connecting to subscribed on ACTIVE_CHARACTER_CONNECT_FAIL', () => {
        expect(activeCharacters({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_CONNECTING,
                CharacterId: 'MARCO',
                subscriptions: {
                    messages: 'Test'
                }
            }
        }, { type: ACTIVE_CHARACTER_CONNECT_FAIL, CharacterId: 'MARCO' })).toEqual({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_SUBSCRIBED,
                CharacterId: 'MARCO',
                subscriptions: {
                    messages: 'Test'
                }
            }
        })
    })

    it('should transition FSM from connected to reconnecting on ACTIVE_CHARACTER_RECONNECT_ATTEMPT', () => {
        expect(activeCharacters({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_CONNECTED,
                CharacterId: 'MARCO',
                subscriptions: { messages: 'Test' },
                connection: 'Test'
            }
        }, { type: ACTIVE_CHARACTER_RECONNECT_ATTEMPT, CharacterId: 'MARCO' })).toEqual({
            MARCO: {
                state: ACTIVE_CHARACTER_FSM_RECONNECTING,
                CharacterId: 'MARCO',
                subscriptions: {
                    messages: 'Test'
                },
                connection: 'Test'
            }
        })
    })

})
