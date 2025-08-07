/**
* @vitest-environment jsdom
*/

import { vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import '@testing-library/jest-dom'
import RoomExit from './RoomExit'
import { StandardExit } from '@tonylb/mtw-wml/ts/standardize/components/exit'

vi.mock('../../../cacheDB')
vi.mock('../ActiveCharacter', () => ({
    useActiveCharacter: () => ({ CharacterId: 'CHARACTER#test' })
}))
vi.mock('../../slices/lifeLine', () => ({
    moveCharacter: vi.fn(() => vi.fn())
}))
vi.mock('../../slices/player/index.api', () => ({
    addOnboardingComplete: vi.fn()
}))

const mockStore = configureStore()

describe('RoomExit', () => {
    let store: any
    let mockDispatch: any

    beforeEach(() => {
        store = mockStore({})
        mockDispatch = vi.fn()
        store.dispatch = mockDispatch
        vi.clearAllMocks()
    })

    it('should render StandardExit with description', () => {
        // Create a StandardExit with description
        const exit = new StandardExit({
            tag: 'Exit',
            key: 'test-exit',
            to: 'ROOM#target-room',
            description: 'Test Exit'
        })

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Test Exit')).toBeInTheDocument()
    })

    it('should render StandardExit with object reference', () => {
        // Create a StandardExit with object reference
        const exit = new StandardExit({
            tag: 'Exit',
            key: 'object-exit',
            to: {
                universalKey: 'ROOM#target-room',
                tag: 'Room'
            },
            description: 'Object Exit'
        })

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Object Exit')).toBeInTheDocument()
    })

    it('should handle click and dispatch moveCharacter', () => {
        const exit = new StandardExit({
            tag: 'Exit',
            key: 'clickable-exit',
            to: 'ROOM#target-room',
            description: 'Clickable Exit'
        })

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        const chip = screen.getByText('Clickable Exit')
        fireEvent.click(chip)

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('player/addOnboardingComplete')
            })
        )
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: expect.stringContaining('lifeLine/moveCharacter')
            })
        )
    })

    it('should handle missing description gracefully', () => {
        const exit = new StandardExit({
            tag: 'Exit',
            key: 'no-desc-exit',
            to: 'ROOM#target-room'
            // No description
        })

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Unknown Exit')).toBeInTheDocument()
    })

    it('should handle missing target room gracefully', () => {
        const exit = new StandardExit({
            tag: 'Exit',
            key: 'no-target-exit',
            to: {
                tag: 'Room',
                key: 'unknown-room'
                // No universalKey but has key
            },
            description: 'No Target Exit'
        })

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('No Target Exit')).toBeInTheDocument()
    })
}) 