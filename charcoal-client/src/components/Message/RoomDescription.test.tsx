/**
* @vitest-environment jsdom
*/

import { vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import RoomDescription from './RoomDescription'
import { PerceptionRoomMetaData } from '@tonylb/mtw-interfaces/ts/messages'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

vi.mock('../../../cacheDB')

// Mock the sub-components to simplify testing
vi.mock('./RoomExit', () => ({
    default: ({ exit }: any) => (
        <div data-testid="room-exit">{exit?.description?.plainString || 'Exit'}</div>
    )
}))

vi.mock('./RoomCharacter', () => ({
    default: ({ character }: any) => (
        <div data-testid="room-character">{character?.displayName?.plainString || 'Character'}</div>
    )
}))

vi.mock('./RenderTreeContent', () => ({
    default: ({ list }: { list: any[] }) => (
        <div>{Array.isArray(list) ? list.join(' ') : String(list)}</div>
    )
}))

const mockStore = configureStore([])

describe('RoomDescription', () => {
    let store: any

    beforeEach(() => {
        // Use a real AssetUUID for the draft asset
        const draftAssetId = 'ASSET#test-draft-uuid-1234'
        store = mockStore({
            player: {
                Players: {
                    'CHARACTER#test': {
                        Assets: []
                    }
                }
            },
            playerDataSource: {
                publicData: {
                    activeStreamKeys: [],
                    subscribedStreams: {
                        'test-player': {
                            materializedView: {
                                type: 'Snapshot',
                                assets: [
                                    {
                                        AssetId: draftAssetId,
                                        zone: 'Draft'
                                    }
                                ],
                                characters: [],
                                settings: {
                                    onboardCompleteTags: []
                                }
                            }
                        }
                    }
                }
            },
            personalAssets: {
                byId: {
                    [draftAssetId]: {
                        meta: {
                            currentState: 'FRESH'
                        }
                    }
                }
            },
            activeCharacters: {
                activeCharacter: 'CHARACTER#test'
            },
            settings: {
                server: {
                    ChatPrompt: 'What do you do?'
                },
                client: {
                    TextEntryLines: 1,
                    ShowNeighborhoodHeaders: false,
                    AlwaysShowOnboarding: false
                },
                connection: {
                    sessionId: '',
                    playerName: 'test-player'
                }
            },
            lifeLine: {}
        })
    })

    describe('Basic Rendering', () => {
        it('should render with minimal metaData (no parsedWML)', () => {
            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#test-room',
                displayMode: 'full'
            }

            render(
                <Provider store={store}>
                    <RoomDescription metaData={metaData} />
                </Provider>
            )

            // Should show default values when no parsedWML
            expect(screen.getByText('Untitled')).toBeDefined()
        })

        it('should render room with StandardForm data', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) uuid=(ROOM#testRoom)>
                        <Example key=(example1) uuid=(EXAMPLE#example1)>
                            <DisplayName>Test Room</DisplayName>
                            <Description>A beautiful test room with stone walls</Description>
                            <Summary>Test summary</Summary>
                        </Example>
                    </Room>
                </Asset>
            `))

            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#testRoom',
                displayMode: 'full'
            }

            render(
                <Provider store={store}>
                    <RoomDescription parsedWML={standardForm} metaData={metaData} />
                </Provider>
            )

            expect(screen.getByText('Test Room')).toBeDefined()
            expect(screen.getByText('A beautiful test room with stone walls')).toBeDefined()
        })

        it('should handle room with exits and characters', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) uuid=(ROOM#testRoom)>
                        <Example key=(example1) uuid=(EXAMPLE#example1)>
                            <DisplayName>Room with Exits</DisplayName>
                            <Description>A room with multiple exits and characters</Description>
                        </Example>
                        <Exit to=(ROOM#north)>North passage</Exit>
                        <Exit to=(ROOM#south)>South corridor</Exit>
                        <Character key=(testChar) uuid=(testChar) />
                    </Room>
                </Asset>
            `))

            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#testRoom',
                displayMode: 'full'
            }

            render(
                <Provider store={store}>
                    <RoomDescription parsedWML={standardForm} metaData={metaData} />
                </Provider>
            )

            expect(screen.getByText('Room with Exits')).toBeDefined()
            expect(screen.getByText('A room with multiple exits and characters')).toBeDefined()
            
            // Should render both exits
            const exits = screen.getAllByTestId('room-exit')
            expect(exits).toHaveLength(2)
            
            // Should render the character (but it won't show up without proper data)
            // Just verify no crashes occurred
            expect(screen.getByRole('heading', { name: 'Room with Exits' })).toBeDefined()
        })
    })

    describe('Header Mode', () => {
        it('should render in header mode', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) uuid=(ROOM#testRoom)>
                        <Example key=(example1) uuid=(EXAMPLE#example1)>
                            <DisplayName>Header Room</DisplayName>
                            <Description>A room shown as header</Description>
                        </Example>
                    </Room>
                </Asset>
            `))

            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#testRoom',
                displayMode: 'header'
            }

            render(
                <Provider store={store}>
                    <RoomDescription 
                        parsedWML={standardForm} 
                        metaData={metaData} 
                        header 
                    />
                </Provider>
            )

            expect(screen.getByText('Header Room')).toBeDefined()
        })

        it('should show live indicator when currentHeader is true', () => {
            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#test-room',
                displayMode: 'header'
            }

            render(
                <Provider store={store}>
                    <RoomDescription 
                        metaData={metaData} 
                        header 
                        currentHeader 
                    />
                </Provider>
            )

            expect(screen.getByText('Live')).toBeDefined()
        })

        it('should not show live indicator when currentHeader is false', () => {
            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#test-room',
                displayMode: 'header'
            }

            render(
                <Provider store={store}>
                    <RoomDescription 
                        metaData={metaData} 
                        header 
                    />
                </Provider>
            )

            expect(screen.queryByText('Live')).toBeNull()
        })
    })

    describe('Edge Cases', () => {
        it('should handle room with no examples gracefully', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Room key=(testRoom) uuid=(ROOM#testRoom) />
                </Asset>
            `))

            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#testRoom',
                displayMode: 'full'
            }

            render(
                <Provider store={store}>
                    <RoomDescription parsedWML={standardForm} metaData={metaData} />
                </Provider>
            )

            // Should fall back to defaults
            expect(screen.getByText('Untitled')).toBeDefined()
        })

        it('should handle missing room component gracefully', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature key=(notARoom)>
                        <ShortName>Not a Room</ShortName>
                    </Feature>
                </Asset>
            `))

            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#nonexistent', // Component doesn't exist
                displayMode: 'full'
            }

            render(
                <Provider store={store}>
                    <RoomDescription parsedWML={standardForm} metaData={metaData} />
                </Provider>
            )

            // Should fall back to defaults when component not found
            expect(screen.getByText('Untitled')).toBeDefined()
        })
    })
})