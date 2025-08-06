/**
* @vitest-environment jsdom
*/

import { vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import RoomExit from './RoomExit'
import { StandardExit } from '@tonylb/mtw-wml/ts/standardize/components/exit'

vi.mock('../../../cacheDB')
vi.mock('../ActiveCharacter', () => ({
    useActiveCharacter: () => ({ CharacterId: 'CHARACTER#test' })
}))
vi.mock('../../slices/lifeLine', () => ({
    moveCharacter: vi.fn()
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
        const exitData = {
            to: 'ROOM#target-room',
            description: 'Test Exit'
        }
        const exit = new StandardExit(exitData)

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Test Exit')).toBeInTheDocument()
    })

    it('should render StandardExit with object reference', () => {
        // Create a StandardExit with object reference
        const exitData = {
            to: {
                universalKey: 'ROOM#target-room',
                tag: 'Room'
            },
            description: 'Object Exit'
        }
        const exit = new StandardExit(exitData)

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Object Exit')).toBeInTheDocument()
    })

    it('should handle click and dispatch moveCharacter', () => {
        const exitData = {
            to: 'ROOM#target-room',
            description: 'Clickable Exit'
        }
        const exit = new StandardExit(exitData)

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
        const exitData = {
            to: 'ROOM#target-room'
            // No description
        }
        const exit = new StandardExit(exitData)

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Unknown Exit')).toBeInTheDocument()
    })

    it('should handle missing target room gracefully', () => {
        const exitData = {
            to: {
                tag: 'Room'
                // No universalKey
            },
            description: 'No Target Exit'
        }
        const exit = new StandardExit(exitData)

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('No Target Exit')).toBeInTheDocument()
    })
}) 