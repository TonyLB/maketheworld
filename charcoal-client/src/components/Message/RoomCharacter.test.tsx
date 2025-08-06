/**
* @vitest-environment jsdom
*/

import { vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import RoomCharacter from './RoomCharacter'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

vi.mock('../../../cacheDB')
vi.mock('../ActiveCharacter', () => ({
    useActiveCharacter: () => ({ CharacterId: 'CHARACTER#viewer' })
}))
vi.mock('../../slices/lifeLine', () => ({
    socketDispatchPromise: vi.fn()
}))

const mockStore = configureStore()

// Mock CharacterChip component
vi.mock('../CharacterChip', () => ({
    default: ({ CharacterId, Name, fileURL, onClick }: any) => (
        <div 
            data-testid="character-chip" 
            data-character-id={CharacterId}
            data-name={Name}
            data-file-url={fileURL}
            onClick={onClick}
        >
            {Name}
        </div>
    )
}))

describe('RoomCharacter', () => {
    let store: any
    let mockDispatch: any

    beforeEach(() => {
        store = mockStore({})
        mockDispatch = vi.fn()
        store.dispatch = mockDispatch
        vi.clearAllMocks()
    })

    it('should render StandardCharacter with name', () => {
        // Create a StandardCharacter with name
        const characterData = {
            name: 'Test Character',
            shortName: 'Test',
            pronouns: undefined,
            image: undefined
        }
        const character = standardComponentFactory('Character', characterData) as StandardCharacter

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-name', 'Test Character')
    })

    it('should render StandardCharacter with image', () => {
        // Create a StandardCharacter with image
        const characterData = {
            name: 'Image Character',
            shortName: 'Image',
            pronouns: undefined,
            image: { fileURL: 'test-image.jpg' }
        }
        const character = standardComponentFactory('Character', characterData) as StandardCharacter

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-file-url', 'test-image.jpg')
    })

    it('should handle click and dispatch socketDispatchPromise', () => {
        const characterData = {
            name: 'Clickable Character',
            shortName: 'Clickable',
            pronouns: undefined,
            image: undefined
        }
        const character = standardComponentFactory('Character', characterData) as StandardCharacter

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        const chip = screen.getByTestId('character-chip')
        fireEvent.click(chip)

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('lifeLine/socketDispatchPromise')
            })
        )
    })

    it('should handle missing name gracefully', () => {
        const characterData = {
            shortName: 'Short',
            pronouns: undefined,
            image: undefined
            // No name
        }
        const character = standardComponentFactory('Character', characterData) as StandardCharacter

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-name', 'Unknown Character')
    })

    it('should handle missing image gracefully', () => {
        const characterData = {
            name: 'No Image Character',
            shortName: 'NoImage',
            pronouns: undefined
            // No image
        }
        const character = standardComponentFactory('Character', characterData) as StandardCharacter

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-file-url', '')
    })

    it('should pass character ID to CharacterChip', () => {
        const characterData = {
            name: 'ID Character',
            shortName: 'ID',
            pronouns: undefined,
            image: undefined
        }
        const character = standardComponentFactory('Character', characterData) as StandardCharacter

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-character-id', character.universalKey)
    })
}) 