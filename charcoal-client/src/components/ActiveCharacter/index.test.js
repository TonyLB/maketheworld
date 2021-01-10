import React from 'react'
import { render } from '@testing-library/react'
import ActiveCharacter, { useActiveCharacter } from './index'

const TestComponent = () => {
    const { CharacterId } = useActiveCharacter()
    return <div>{CharacterId}</div>
}

describe('ActiveCharacter wrapper component', () => {

    it('correctly sets context CharacterId', () => {
        const { container } = render(
            <ActiveCharacter CharacterId='ABC' >
                <TestComponent />
            </ActiveCharacter>
        )
        expect(container.textContent).toBe("ABC")
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
