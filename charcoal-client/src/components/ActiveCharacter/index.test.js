import React, { useEffect } from 'react'
import { render } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import ActiveCharacter, { useActiveCharacter } from './index'
import { DEACTIVATE_CHARACTER, ACTIVE_CHARACTER_FSM_SUBSCRIBED } from '../../actions/activeCharacters'

const mockStore = configureStore()
const store = mockStore({
    stateSeekingMachines: {
        machines: {
            ['Subscribe::Character::TESS']: {
                currentState: 'SYNCHRONIZED'
            }    
        }
    },
    messages: [],
    characters: {}
})

const TestComponent = () => {
    const { CharacterId } = useActiveCharacter()
    return <div>{CharacterId}</div>
}

const TestSubscriptionComponent = () => {
    const { isSubscribed } = useActiveCharacter()
    return <div>{ isSubscribed ? 'Subscribed' : 'Not subscribed' }</div>
}

describe('ActiveCharacter wrapper component', () => {

    beforeEach(() => {
        store.clearActions()
    })

    it('correctly sets context CharacterId', () => {
        const { container } = render(
            <Provider store={store}>
                <ActiveCharacter CharacterId='ABC' >
                    <TestComponent />
                </ActiveCharacter>
            </Provider>
        )
        expect(container.textContent).toBe("ABC")
    })

    it('correctly imports redux-store info into context', () => {
        const { container } = render(
            <Provider store={store}>
                <ActiveCharacter CharacterId='TESS' >
                    <TestSubscriptionComponent />
                </ActiveCharacter>
            </Provider>
        )
        expect(container.textContent).toBe("Subscribed")
    })

    it('correctly passes a deactivate action', () => {
        const TestDeactivateComponent = () => {
            const { deactivate } = useActiveCharacter()
            useEffect(() => {
                deactivate()
            }, [deactivate])
            return <div />
        }

        act(() => {
            render(
                <Provider store={store}>
                    <ActiveCharacter CharacterId='ABC' >
                        <TestDeactivateComponent />
                    </ActiveCharacter>
                </Provider>
            )
        })

        const actions = store.getActions()
        expect(actions).toEqual([{ type: DEACTIVATE_CHARACTER, CharacterId: 'ABC' }])
    })

})
describe('useActiveCharacter hook', () => {

    it('correctly returns empty string outside of context', () => {
        const { container } = render(
            <TestComponent />
        )
        expect(container.textContent).toBe("")
    })

})
