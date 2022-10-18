import React from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import ActiveCharacter, { useActiveCharacter } from './index'

jest.mock('../../cacheDB')

const mockStore = configureStore()
const store = mockStore({
    activeCharacters: {
        byId: {
            'CHARACTER#TESS': {
                meta: { currentState: 'CONNECTED' },
                internalData: {},
                publicData: {}
            }
        }
    },
    ephemera: {
        publicData: {
            charactersInPlay: {}
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
                <ActiveCharacter CharacterId='CHARACTER#ABC' >
                    <TestComponent />
                </ActiveCharacter>
            </Provider>
        )
        expect(container.textContent).toBe("CHARACTER#ABC")
    })

    it('correctly imports redux-store info into context', () => {
        const { container } = render(
            <Provider store={store}>
                <ActiveCharacter CharacterId='CHARACTER#TESS' >
                    <TestSubscriptionComponent />
                </ActiveCharacter>
            </Provider>
        )
        expect(container.textContent).toBe("Subscribed")
    })

})
describe('useActiveCharacter hook', () => {

    it('correctly returns empty string outside of context', () => {
        const { container } = render(
            <TestComponent />
        )
        expect(container.textContent).toBe("CHARACTER#NONE")
    })

})
