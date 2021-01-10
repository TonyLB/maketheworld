import React, { useEffect } from 'react'
import { render } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import ActiveCharacter, { useActiveCharacter } from './index'
import { DEACTIVATE_CHARACTER } from '../../actions/UI/activeCharacters'

const mockStore = configureStore()
const store = mockStore({
    activeCharacters: {
        TESS: { CharacterId: 'TESS' }
    }
})

const TestComponent = () => {
    const { CharacterId } = useActiveCharacter()
    return <div>{CharacterId}</div>
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
