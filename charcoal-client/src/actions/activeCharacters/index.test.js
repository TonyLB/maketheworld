import configureStore from 'redux-mock-store'
import thunk from 'redux-thunk'

jest.mock('../messages')
jest.mock('./subscription')
jest.mock('./messageSync')

import {
    activateCharacter,
    ACTIVATE_CHARACTER,
    ACTIVE_CHARACTER_FSM_INITIAL,
    ACTIVE_CHARACTER_FSM_SUBSCRIBING,
    ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT,
    ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS,
    deactivateCharacter,
    DEACTIVATE_CHARACTER,
    subscribeToMessages
} from '.'

const middlewares = [thunk] // add your middlewares like `redux-thunk`
const mockStore = configureStore(middlewares)

describe('activeCharacters actions', () => {
    it('sends a correct activateCharacter action', () => {
        expect(activateCharacter('123')).toEqual({
            type: ACTIVATE_CHARACTER,
            CharacterId: '123'
        })
    })
    it('sends a correct deactivateCharacter action', () => {
        expect(deactivateCharacter('123')).toEqual({
            type: DEACTIVATE_CHARACTER,
            CharacterId: '123'
        })
    })
    describe('when subscribeToMessages is called', () => {
        const makeStore = (state) => (mockStore({
            activeCharacters: {
                MARCO: {
                    CharacterId: 'MARCO',
                    state
                }
            }
        }))
        it('returns a no-op if state is not currently INITIAL', () => {
            const store = makeStore(ACTIVE_CHARACTER_FSM_SUBSCRIBING)
            store.dispatch(subscribeToMessages('MARCO'))
                .then(() => {
                    const actions = store.getActions()
                    expect(actions.length).toEqual(0)
                })
        })
        it('dispatches SUBSCRIBE_ATTEMPT, fetches cache and dispatches subscription when state is INITIAL', async () => {
            const store = makeStore(ACTIVE_CHARACTER_FSM_INITIAL)
            await store.dispatch(subscribeToMessages('MARCO'))
            const actions = store.getActions()
            expect(actions.length).toEqual(4)
            expect(actions[0]).toEqual({
                type: ACTIVE_CHARACTER_SUBSCRIBE_ATTEMPT,
                CharacterId: 'MARCO'
            })
            expect(actions[1]).toEqual({
                type: 'TEST_FETCH_CACHE',
                payload: 'MARCO'
            })
            expect(actions[2]).toEqual({
                type: 'TEST_MESSAGE_SYNC',
                payload: {
                    CharacterId: 'MARCO',
                    LastMessageSync: '567'
                }
            })
            expect(actions[3]).toEqual({
                CharacterId: 'MARCO',
                type: ACTIVE_CHARACTER_SUBSCRIBE_SUCCESS,
                subscription: 'TEST_SUBSCRIPTION'
            })
        })
    })
})