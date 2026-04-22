import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { vi } from 'vitest'

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { RoomStateAffordance } from './RoomStateAffordance'

const ROOM_ID = 'ROOM#room1' as ComponentUUID
const sendRoomEphemeraStateChangeMock = vi.fn()
const isEphemeraCacheMarkStateMock = vi.fn()

let mockWorkbenchReturn: ReturnType<typeof import('../foundations/useWorkbenchAsset').useWorkbenchAsset> = {
    standardForm: new StandardForm({ universalKey: 'ASSET#test', components: [], metaData: [] }),
    readonly: false,
    updateStandard: vi.fn(),
    AssetId: 'ASSET#test',
} as any

vi.mock('../foundations/useWorkbenchAsset', () => ({
    useWorkbenchAsset: () => mockWorkbenchReturn,
}))

vi.mock('./ephemeraStateChange', () => ({
    sendRoomEphemeraStateChange: (args: unknown) => sendRoomEphemeraStateChangeMock(args),
}))

vi.mock('@tonylb/mtw-interfaces/ts/ephemeraMeta', () => ({
    isEphemeraCacheMarkState: (...args: unknown[]) => isEphemeraCacheMarkStateMock(...args),
}))

const createStore = () =>
    configureStore({
        reducer: {
            UI: (state = {}) => state,
        },
    })

function renderWithStore(ui: React.ReactElement) {
    return render(<Provider store={createStore()}>{ui}</Provider>)
}

describe('RoomStateAffordance', () => {
    beforeEach(() => {
        sendRoomEphemeraStateChangeMock.mockReset()
        isEphemeraCacheMarkStateMock.mockReset()
        isEphemeraCacheMarkStateMock.mockReturnValue(true)
        mockWorkbenchReturn = {
            standardForm: new StandardForm({ universalKey: 'ASSET#test', components: [], metaData: [] }),
            readonly: false,
            updateStandard: vi.fn(),
            AssetId: 'ASSET#test',
        } as any
    })

    it('renders one value control per lens mark', async () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><Lens uuid=(lens1) /></Room>
                <Lens uuid=(lens1)>
                    <Mark uuid=(mark1) />
                    <Mark uuid=(mark2) />
                </Lens>
                <Mark uuid=(mark1)><ShortName>Weather</ShortName></Mark>
                <Mark uuid=(mark2)><ShortName>Light</ShortName></Mark>
            </Asset>
        `)

        renderWithStore(<RoomStateAffordance RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))

        expect(await screen.findByLabelText('Weather')).toBeTruthy()
        expect(screen.getByLabelText('Light')).toBeTruthy()
    })

    it('shows empty state when room has no lens', async () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1) />
            </Asset>
        `)

        renderWithStore(<RoomStateAffordance RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))

        expect(await screen.findByText('This Room has no Lens, so there are no runtime marks to edit.')).toBeTruthy()
    })

    it('shows empty state when lens has no marks', async () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><Lens uuid=(lens1) /></Room>
                <Lens uuid=(lens1) />
            </Asset>
        `)

        renderWithStore(<RoomStateAffordance RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))

        expect(await screen.findByText('This Lens has no marks, so there are no runtime values to submit.')).toBeTruthy()
    })

    it('submits room state and shows ack success message', async () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><Lens uuid=(lens1) /></Room>
                <Lens uuid=(lens1)>
                    <Mark uuid=(mark1) />
                </Lens>
                <Mark uuid=(mark1)><ShortName>Weather</ShortName></Mark>
            </Asset>
        `)

        sendRoomEphemeraStateChangeMock.mockReturnValue(async () => ({
            ok: true,
            message: 'Runtime room state updated.',
        }))

        renderWithStore(<RoomStateAffordance RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
        fireEvent.change(await screen.findByLabelText('Weather'), { target: { value: 'rain' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply runtime state' }))

        await waitFor(() => {
            expect(sendRoomEphemeraStateChangeMock).toHaveBeenCalledWith({
                componentId: ROOM_ID,
                markState: {
                    markValue: [{ mark: 'MARK#mark1', value: 'rain' }],
                },
            })
        })
        expect(await screen.findByText('Runtime room state updated.')).toBeTruthy()
    })

    it('blocks submit when mark state validation fails', async () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><Lens uuid=(lens1) /></Room>
                <Lens uuid=(lens1)>
                    <Mark uuid=(mark1) />
                </Lens>
                <Mark uuid=(mark1)><ShortName>Weather</ShortName></Mark>
            </Asset>
        `)
        isEphemeraCacheMarkStateMock.mockReturnValue(false)

        renderWithStore(<RoomStateAffordance RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Apply runtime state' }))

        expect(sendRoomEphemeraStateChangeMock).not.toHaveBeenCalled()
        expect(await screen.findByText('Unable to send room-state update: invalid mark payload.')).toBeTruthy()
    })

    it('shows ack error message when helper returns failure', async () => {
        mockWorkbenchReturn.standardForm = new StandardForm(`
            <Asset uuid=(test)>
                <Room uuid=(room1)><Lens uuid=(lens1) /></Room>
                <Lens uuid=(lens1)>
                    <Mark uuid=(mark1) />
                </Lens>
                <Mark uuid=(mark1)><ShortName>Weather</ShortName></Mark>
            </Asset>
        `)
        sendRoomEphemeraStateChangeMock.mockReturnValue(async () => ({
            ok: false,
            message: 'Room state is unavailable for this room (META_ROOM_MISSING).',
        }))

        renderWithStore(<RoomStateAffordance RoomId={ROOM_ID} />)
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Apply runtime state' }))

        expect(await screen.findByText('Room state is unavailable for this room (META_ROOM_MISSING).')).toBeTruthy()
    })
})
