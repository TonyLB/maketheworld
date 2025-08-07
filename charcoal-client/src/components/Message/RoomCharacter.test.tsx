/**
* @vitest-environment jsdom
*/

import { vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import '@testing-library/jest-dom'
import RoomCharacter from './RoomCharacter'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'

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
        const character = new StandardCharacter({
            tag: 'Character',
            key: 'test-character',
            name: 'Test Character',
            shortName: 'Test',
            pronouns: undefined,
            image: undefined
        })

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-name', 'Test Character')
    })

    it('should render StandardCharacter with image', () => {
        // Create a StandardCharacter with image
        const character = new StandardCharacter({
            tag: 'Character',
            key: 'image-character',
            name: 'Image Character',
            shortName: 'Image',
            pronouns: undefined,
            image: { fileURL: 'test-image.jpg' }
        })

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-file-url', 'test-image.jpg')
    })

    it('should handle click and dispatch socketDispatchPromise', () => {
        const character = new StandardCharacter({
            tag: 'Character',
            key: 'clickable-character',
            name: 'Clickable Character',
            shortName: 'Clickable',
            pronouns: undefined,
            image: undefined
        })

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
        const character = new StandardCharacter({
            tag: 'Character',
            key: 'no-name-character',
            shortName: 'Short',
            pronouns: undefined,
            image: undefined
            // No name
        })

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-name', 'Unknown Character')
    })

    it('should handle missing image gracefully', () => {
        const character = new StandardCharacter({
            tag: 'Character',
            key: 'no-image-character',
            name: 'No Image Character',
            shortName: 'NoImage',
            pronouns: undefined
            // No image
        })

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-file-url', '')
    })

    it('should pass character ID to CharacterChip', () => {
        const character = new StandardCharacter({
            tag: 'Character',
            key: 'id-character',
            name: 'ID Character',
            shortName: 'ID',
            pronouns: undefined,
            image: undefined
        })

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-character-id', character.universalKey)
    })
}) 