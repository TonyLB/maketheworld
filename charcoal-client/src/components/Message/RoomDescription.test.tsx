/**
* @vitest-environment jsdom
*/

import { vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import RoomDescription from './RoomDescription'
import { RoomDescription as RoomDescriptionType, RoomHeader as RoomHeaderType } from '@tonylb/mtw-interfaces/ts/messages'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardExit, StandardExitSimple } from '@tonylb/mtw-wml/ts/standardize/components/exit'

vi.mock('../../../cacheDB')
vi.mock('../../slices/player', () => ({
    getPlayer: () => (state: any) => state.player
}))
vi.mock('../../slices/personalAssets', () => ({
    getStatus: () => (state: any) => state.personalAssets?.byId?.['ASSET#draft']?.meta?.currentState || 'FRESH'
}))
vi.mock('../ActiveCharacter', () => ({
    useActiveCharacter: () => ({ CharacterId: 'CHARACTER#test' })
}))
vi.mock('../../slices/lifeLine', () => ({
    socketDispatchPromise: vi.fn(),
    moveCharacter: vi.fn()
}))
vi.mock('../Onboarding/useOnboarding', () => ({
    useOnboardingCheckpoint: vi.fn()
}))

const mockStore = configureStore()

// Mock sub-components
vi.mock('./RoomExit', () => ({
    default: ({ exit }: { exit: StandardExit }) => {
        try {
            // Try to extract description, fallback to 'Unknown Exit'
            const description = exit._payload.plain.description?._payload?.plain?.toJSON?.() || 'Unknown Exit'
            return <div data-testid="room-exit">{description}</div>
        } catch (e) {
            return <div data-testid="room-exit">Unknown Exit</div>
        }
    }
}))

vi.mock('./RoomCharacter', () => ({
    default: ({ character }: { character: StandardCharacter }) => {
        try {
            // Try to extract name, fallback to 'Unknown Character'
            const name = typeof character.name === 'string' ? character.name || 'Unknown Character' : 'Unknown Character'
            return <div data-testid="room-character">{name}</div>
        } catch (e) {
            return <div data-testid="room-character">Unknown Character</div>
        }
    }
}))

vi.mock('./RenderTreeContent', () => ({
    default: ({ list }: any) => <div data-testid="render-tree">{Array.isArray(list) ? list.join(' ') : 'No content'}</div>
}))

describe('RoomDescription', () => {
    let store: any

    beforeEach(() => {
        store = mockStore({
            player: { Assets: [] },
            personalAssets: { byId: {} }
        })
        vi.clearAllMocks()
    })

    describe('Legacy Format Support', () => {
        it('should render legacy RoomDescription data', () => {
            const legacyMessage: RoomDescriptionType = {
                DisplayProtocol: 'RoomDescription',
                Name: ['Test Room'],
                Description: ['A test room description'],
                Summary: ['Test summary'],
                RoomId: 'ROOM#test-room',
                Exits: [
                    {
                        Name: 'North Exit',
                        RoomId: 'ROOM#north-room',
                        Visibility: 'Public'
                    }
                ],
                Characters: [
                    {
                        Name: 'Test Character',
                        CharacterId: 'CHARACTER#test-char',
                        fileURL: 'test-image.jpg'
                    }
                ],
                assets: ['ASSET#test'],
                Target: 'CHARACTER#test',
                MessageId: 'Test',
                CreatedTime: 1000000
            }

            render(
                <Provider store={store}>
                    <RoomDescription message={legacyMessage} />
                </Provider>
            )

            expect(screen.getByText('Test Room')).toBeDefined()
            expect(screen.getByText('A test room description')).toBeDefined()
            expect(screen.getByTestId('room-exit').textContent).toBe('North Exit')
            expect(screen.getByTestId('room-character').textContent).toBe('Test Character')
        })

        it('should render legacy RoomHeader data', () => {
            const legacyMessage: RoomHeaderType = {
                DisplayProtocol: 'RoomHeader',
                Name: ['Header Room'],
                Description: ['A header room description'],
                Summary: ['Header summary'],
                RoomId: 'ROOM#header-room',
                Exits: [],
                Characters: [],
                Target: 'CHARACTER#test',
                MessageId: 'Test',
                CreatedTime: 1000000
            }

            render(
                <Provider store={store}>
                    <RoomDescription message={legacyMessage} header />
                </Provider>
            )

            expect(screen.getByText('Header Room')).toBeDefined()
            expect(screen.getByText('A header room description')).toBeDefined()
        })
    })

    describe('Standard Format Support', () => {
        it('should render Standard format room data', () => {
            // Create a StandardForm with room data
            const wmlContent = `
<Asset key=(TestRoom)>
    <Room uuid=(ROOM#test-room)>
        <Example uuid=(EXAMPLE#test-example)>
            <Name>Standard Room</Name>
            <Description>Standard room description</Description>
            <Summary>Standard summary</Summary>
        </Example>
        <Exit to=(ROOM#north-room)>North Exit</Exit>
    </Room>
</Asset>`
            
            const standardForm = new StandardForm(wmlContent)
            const componentUUID = 'ROOM#test-room'

            render(
                <Provider store={store}>
                    <RoomDescription 
                        message={{ DisplayProtocol: 'PerceptionMessage' } as any}
                        parsedWML={standardForm}
                        componentUUID={componentUUID}
                    />
                </Provider>
            )

            expect(screen.getByText('Standard Room')).toBeDefined()
            expect(screen.getByText('Standard room description')).toBeDefined()
            expect(screen.getByTestId('room-exit').textContent).toBe('North Exit')
        })

        it('should handle missing Standard format data gracefully', () => {
            render(
                <Provider store={store}>
                    <RoomDescription 
                        message={{ DisplayProtocol: 'PerceptionMessage' } as any}
                        parsedWML={undefined}
                        componentUUID={undefined}
                    />
                </Provider>
            )

            expect(screen.getByText('Untitled')).toBeDefined()
            expect(screen.getByText('No description')).toBeDefined()
        })
    })

    describe('Bridge State Functionality', () => {
        it('should convert legacy exits to Standard format', () => {
            const legacyMessage: RoomDescriptionType = {
                DisplayProtocol: 'RoomDescription',
                Name: ['Test Room'],
                Description: ['Test description'],
                Summary: ['Test summary'],
                RoomId: 'ROOM#test-room',
                Exits: [
                    {
                        Name: 'Legacy Exit',
                        RoomId: 'ROOM#target-room',
                        Visibility: 'Public'
                    }
                ],
                Characters: [],
                Target: 'CHARACTER#test',
                MessageId: 'Test',
                CreatedTime: 1000000
            }

            render(
                <Provider store={store}>
                    <RoomDescription message={legacyMessage} />
                </Provider>
            )

            // Should render the converted exit
            expect(screen.getByTestId('room-exit').textContent).toBe('Legacy Exit')
        })

        it('should convert legacy characters to Standard format', () => {
            const legacyMessage: RoomDescriptionType = {
                DisplayProtocol: 'RoomDescription',
                Name: ['Test Room'],
                Description: ['Test description'],
                Summary: ['Test summary'],
                RoomId: 'ROOM#test-room',
                Exits: [],
                Characters: [
                    {
                        Name: 'Legacy Character',
                        CharacterId: 'CHARACTER#legacy-char',
                        fileURL: 'legacy-image.jpg'
                    }
                ],
                Target: 'CHARACTER#test',
                MessageId: 'Test',
                CreatedTime: 1000000
            }

            render(
                <Provider store={store}>
                    <RoomDescription message={legacyMessage} />
                </Provider>
            )

            // Should render the converted character
            expect(screen.getByTestId('room-character').textContent).toBe('Legacy Character')
        })
    })

    describe('Header Mode', () => {
        it('should render in header mode with live indicator', () => {
            const legacyMessage: RoomHeaderType = {
                DisplayProtocol: 'RoomHeader',
                Name: ['Header Room'],
                Description: ['Header description'],
                Summary: ['Header summary'],
                RoomId: 'ROOM#header-room',
                Exits: [],
                Characters: [],
                Target: 'CHARACTER#test',
                MessageId: 'Test',
                CreatedTime: 1000000
            }

            render(
                <Provider store={store}>
                    <RoomDescription message={legacyMessage} header currentHeader />
                </Provider>
            )

            expect(screen.getByText('Header Room')).toBeDefined()
            expect(screen.getByText('Live')).toBeDefined()
        })
    })
}) 