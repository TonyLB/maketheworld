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
    socketDispatchPromise: vi.fn(() => ({ type: 'lifeLine/socketDispatchPromise' }))
}))

const mockStore = configureStore()

// Mock CharacterChip component with proper React component pattern
vi.mock('../CharacterChip', () => {
    const MockCharacterChip = vi.fn((props: any) => {
        const { CharacterId, Name, fileURL, onClick, variant } = props
        return (
            <div 
                data-testid="character-chip" 
                data-character-id={CharacterId}
                data-name={Name}
                data-file-url={fileURL}
                data-variant={variant ?? 'default'}
                data-has-onclick={onClick ? 'true' : 'false'}
                onClick={onClick}
            >
                {Name}
            </div>
        )
    })
    
    return {
        default: MockCharacterChip
    }
})

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
        // Create a StandardCharacter with name using WML
        const character = new StandardCharacter(`
            <Character key=(testCharacter)>
                <DisplayName>Test Character</DisplayName>
                <ShortName>Test</ShortName>
            </Character>
        `)

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        // Debug: Check what was rendered
        console.log('Rendered HTML:', screen.getByTestId('character-chip').outerHTML)

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-name', 'Test Character')
    })

    it('should render StandardCharacter with image', () => {
        // Create a StandardCharacter with image using WML
        const character = new StandardCharacter(`
            <Character key=(imageCharacter)>
                <DisplayName>Image Character</DisplayName>
                <ShortName>Image</ShortName>
                <Image key=(test-image) />
            </Character>
        `)

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        // The image key should be available for fileURL resolution
        expect(screen.getByTestId('character-chip')).toBeInTheDocument()
    })

    it('should handle click and dispatch socketDispatchPromise', () => {
        const character = new StandardCharacter(`
            <Character key=(clickableCharacter)>
                <DisplayName>Clickable Character</DisplayName>
                <ShortName>Clickable</ShortName>
            </Character>
        `)

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
        const character = new StandardCharacter(`
            <Character key=(noNameCharacter)>
                <ShortName>Short</ShortName>
            </Character>
        `)

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-name', 'Unknown Character')
    })

    it('should handle missing image gracefully', () => {
        const character = new StandardCharacter(`
            <Character key=(noImageCharacter)>
                <DisplayName>No Image Character</DisplayName>
                <ShortName>NoImage</ShortName>
            </Character>
        `)

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-file-url', '')
    })

    it('should pass character ID to CharacterChip', () => {
        const character = new StandardCharacter(`
            <Character key=(idCharacter)>
                <DisplayName>ID Character</DisplayName>
                <ShortName>ID</ShortName>
            </Character>
        `)

        render(
            <Provider store={store}>
                <RoomCharacter character={character} />
            </Provider>
        )

        expect(screen.getByTestId('character-chip')).toHaveAttribute('data-character-id', character.universalKey)
    })

    describe('inactive variant', () => {
        it('should forward variant="inactive" and drop onClick when inactive', () => {
            const character = new StandardCharacter(`
                <Character key=(inactiveCharacter)>
                    <DisplayName>Inactive Character</DisplayName>
                    <ShortName>Inactive</ShortName>
                </Character>
            `)

            render(
                <Provider store={store}>
                    <RoomCharacter character={character} inactive />
                </Provider>
            )

            const chip = screen.getByTestId('character-chip')
            expect(chip).toHaveAttribute('data-variant', 'inactive')
            expect(chip).toHaveAttribute('data-has-onclick', 'false')
        })

        it('should not dispatch socketDispatchPromise when an inactive chip is clicked', () => {
            const character = new StandardCharacter(`
                <Character key=(inactiveClickCharacter)>
                    <DisplayName>Inactive Click</DisplayName>
                    <ShortName>InactiveClick</ShortName>
                </Character>
            `)

            render(
                <Provider store={store}>
                    <RoomCharacter character={character} inactive />
                </Provider>
            )

            fireEvent.click(screen.getByTestId('character-chip'))

            expect(mockDispatch).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    type: expect.stringContaining('lifeLine/socketDispatchPromise')
                })
            )
        })
    })
}) 