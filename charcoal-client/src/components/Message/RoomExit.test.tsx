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
    moveCharacter: vi.fn(() => () => ({ type: 'lifeLine/moveCharacter' }))
}))
vi.mock('../../slices/player/index.api', () => ({
    addOnboardingComplete: vi.fn(() => ({ type: 'player/addOnboardingComplete' }))
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
        // Create a StandardExit with description using WML
        const exit = StandardExit.create(`
            <Exit to=(ROOM#target-room)>
                Test Exit
            </Exit>
        `)

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Test Exit')).toBeInTheDocument()
    })

    it('should render StandardExit with object reference', () => {
        // Create a StandardExit with object reference using WML
        const exit = StandardExit.create(`
            <Exit to=(ROOM#target-room)>
                Object Exit
            </Exit>
        `)

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Object Exit')).toBeInTheDocument()
    })

    it('should handle click and dispatch moveCharacter', () => {
        const exit = StandardExit.create({
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
        const exit = StandardExit.create(`
            <Exit to=(ROOM#target-room) />
        `)

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('Unknown Exit')).toBeInTheDocument()
    })

    it('should handle missing target room gracefully', () => {
        const exit = StandardExit.create(`
            <Exit to=(unknown-room)>
                No Target Exit
            </Exit>
        `)

        render(
            <Provider store={store}>
                <RoomExit exit={exit} />
            </Provider>
        )

        expect(screen.getByText('No Target Exit')).toBeInTheDocument()
    })
}) 