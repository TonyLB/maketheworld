/**
 * @vitest-environment jsdom
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import '@testing-library/jest-dom'

import CharacterChip from './index'

vi.mock('../../../cacheDB')

const mockCharacterStyleWrapper = vi.fn(({ children }: any) => (
    <div data-testid="character-style-wrapper">{children}</div>
))
vi.mock('../CharacterStyleWrapper', () => ({
    __esModule: true,
    default: (props: any) => mockCharacterStyleWrapper(props),
    CharacterStyleWrapper: (props: any) => mockCharacterStyleWrapper(props)
}))

vi.mock('../../slices/ephemera', () => ({
    getCharactersInPlay: () => ({
        'CHARACTER#test': {
            CharacterId: 'CHARACTER#test',
            DisplayName: 'Default Name',
            fileURL: ''
        }
    })
}))

vi.mock('../../slices/configuration', () => ({
    getConfiguration: () => ({ AppBaseURL: '' })
}))

vi.mock('../../environment', () => ({
    DevEnvironment: false
}))

const mockStore = configureStore()

describe('CharacterChip', () => {
    let store: any

    beforeEach(() => {
        vi.clearAllMocks()
        store = mockStore({})
    })

    describe('default variant', () => {
        it('wraps the chip in CharacterStyleWrapper and shows the label', () => {
            render(
                <Provider store={store}>
                    <CharacterChip
                        CharacterId={'CHARACTER#test'}
                        Name="Test Character"
                        onClick={() => {}}
                    />
                </Provider>
            )

            expect(screen.getByTestId('character-style-wrapper')).toBeInTheDocument()
            expect(mockCharacterStyleWrapper).toHaveBeenCalled()
            expect(screen.getByText('Test Character')).toBeInTheDocument()
        })

        it('invokes onClick when the chip is clicked', () => {
            const onClick = vi.fn()
            render(
                <Provider store={store}>
                    <CharacterChip
                        CharacterId={'CHARACTER#test'}
                        Name="Clickable"
                        onClick={onClick}
                    />
                </Provider>
            )

            fireEvent.click(screen.getByText('Clickable'))
            expect(onClick).toHaveBeenCalledTimes(1)
        })
    })

    describe('inactive variant', () => {
        it('does not wrap the chip in CharacterStyleWrapper', () => {
            render(
                <Provider store={store}>
                    <CharacterChip
                        CharacterId={'CHARACTER#test'}
                        Name="Inactive Character"
                        variant="inactive"
                    />
                </Provider>
            )

            expect(screen.queryByTestId('character-style-wrapper')).toBeNull()
            expect(mockCharacterStyleWrapper).not.toHaveBeenCalled()
            expect(screen.getByText('Inactive Character')).toBeInTheDocument()
        })

        it('ignores any onClick passed in (chip is inert)', () => {
            const onClick = vi.fn()
            render(
                <Provider store={store}>
                    <CharacterChip
                        CharacterId={'CHARACTER#test'}
                        Name="Inert Character"
                        onClick={onClick}
                        variant="inactive"
                    />
                </Provider>
            )

            fireEvent.click(screen.getByText('Inert Character'))
            expect(onClick).not.toHaveBeenCalled()
        })
    })
})
