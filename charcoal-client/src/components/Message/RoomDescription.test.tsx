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

    /**
     * Room-render channel: `StandardRoom.render` from ephemera `<Render>` (parse with `standardizeMode: 'ephemeraWire'`).
     */
    describe('Pure render', () => {
        it('renders DisplayName and description from <Render> under Room (ephemeraWire)', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(ROOM#main)>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            const parsedWML = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#main',
                displayMode: 'full'
            }

            render(
                <Provider store={store}>
                    <RoomDescription parsedWML={parsedWML} metaData={metaData} />
                </Provider>
            )

            expect(screen.getByText('Parlor')).toBeDefined()
            expect(screen.getByText('Full prose here.')).toBeDefined()
        })

        it('uses render prose when <Render> is present alongside legacy Situation facet (render wins)', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(ROOM#main)>
                        <Render>
                            <DisplayName>From Render</DisplayName>
                            <Summary>R summary</Summary>
                            <Description>R body</Description>
                        </Render>
                        <Situation uuid=(SITUATION#legacy)>
                            <DisplayName>From Situation</DisplayName>
                            <Summary>S summary</Summary>
                            <Description>S body</Description>
                        </Situation>
                    </Room>
                </Asset>
            `)
            const parsedWML = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#main',
                displayMode: 'full'
            }

            render(
                <Provider store={store}>
                    <RoomDescription parsedWML={parsedWML} metaData={metaData} />
                </Provider>
            )

            expect(screen.getByText('From Render')).toBeDefined()
            expect(screen.getByText('R body')).toBeDefined()
            expect(screen.queryByText('From Situation')).toBeNull()
        })

        it('shows defaults when no parsedWML (no render payload)', () => {
            const metaData: PerceptionRoomMetaData = {
                componentUUID: 'ROOM#test-room',
                displayMode: 'full'
            }

            render(
                <Provider store={store}>
                    <RoomDescription metaData={metaData} />
                </Provider>
            )

            expect(screen.getByText('Untitled')).toBeDefined()
        })

        it('uses situation prose when render is absent', () => {
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Situation key=(bright) uuid=(SITUATION#bright)>
                        <Mark key=(illumination) uuid=(MARK#illumination)>
                            <Match>bright</Match>
                        </Mark>
                    </Situation>
                    <Room key=(testRoom) uuid=(ROOM#testRoom)>
                        <Situation key=(bright) uuid=(SITUATION#bright)>
                            <DisplayName>Situation Room</DisplayName>
                            <Description>A room rendered from a Situation facet</Description>
                            <Summary>Situation summary</Summary>
                        </Situation>
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

            expect(screen.getByText('Situation Room')).toBeDefined()
            expect(screen.getByText('A room rendered from a Situation facet')).toBeDefined()
        })

        it('uses defaults when room has no render or situation prose', () => {
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

            expect(screen.getByText('Untitled')).toBeDefined()
            expect(screen.getByText('No description')).toBeDefined()
        })
    })

    /**
     * Room-affordances channel only (exits, characters, Object, etc.): skipped until affordance-only
     * perception fixtures and client aggregation are wired. Un-skip and flesh out in a staged TDD pass.
     */
    describe.skip('Pure affordances', () => {
        it('placeholder: affordance-channel-only StandardForm without render row', () => {
            // Future: parse WML from affordances `PublishMessage` only; assert exits / characters / objects
            // without room-render prose. Old single-channel tests below inform target behavior.
            expect(true).toBe(true)
        })
    })

    /**
     * Single-channel / pre-aggregation behavior: skipped as the starting point for staged-activation TDD.
     * When we split room-render vs room-affordances and virtual-header merge, re-enable and replace
     * expectations with multi-channel equivalents; use these cases to preserve product intent.
     */
    describe.skip('Merged behavior', () => {
        describe('Basic rendering', () => {
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

                expect(screen.getByText('Untitled')).toBeDefined()
            })

            it('should render room from Situation facet when present', () => {
                const standardForm = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Situation key=(bright) uuid=(SITUATION#bright)>
                            <Mark key=(illumination) uuid=(MARK#illumination)>
                                <Match>bright</Match>
                            </Mark>
                        </Situation>
                        <Room key=(testRoom) uuid=(ROOM#testRoom)>
                            <Situation key=(bright) uuid=(SITUATION#bright)>
                                <DisplayName>Situation Room</DisplayName>
                                <Description>A room rendered from a Situation facet</Description>
                                <Summary>Situation summary</Summary>
                            </Situation>
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

                expect(screen.getByText('Situation Room')).toBeDefined()
                expect(screen.getByText('A room rendered from a Situation facet')).toBeDefined()
            })

            it('should render room with StandardForm data', () => {
                const standardForm = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room key=(testRoom) uuid=(ROOM#testRoom)>
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Test Room</DisplayName>
                                <Description>A beautiful test room with stone walls</Description>
                                <Summary>Test summary</Summary>
                            </Situation>
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
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Room with Exits</DisplayName>
                                <Description>A room with multiple exits and characters</Description>
                            </Situation>
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

                const exits = screen.getAllByTestId('room-exit')
                expect(exits).toHaveLength(2)

                expect(screen.getByRole('heading', { name: 'Room with Exits' })).toBeDefined()
            })
        })

        describe('Header mode', () => {
            it('should render in header mode', () => {
                const standardForm = new StandardForm(deIndentWML(`
                    <Asset uuid=(test)>
                        <Room key=(testRoom) uuid=(ROOM#testRoom)>
                            <Situation uuid=(DEFAULT)>
                                <DisplayName>Header Room</DisplayName>
                                <Description>A room shown as header</Description>
                            </Situation>
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

            it('should render generating placeholder when isGenerating is true', () => {
                const metaData: PerceptionRoomMetaData = {
                    componentUUID: 'ROOM#test-room',
                    displayMode: 'header',
                    status: 'generating'
                }

                render(
                    <Provider store={store}>
                        <RoomDescription
                            metaData={metaData}
                            header
                            isGenerating
                        />
                    </Provider>
                )

                expect(screen.getByText('Generating...')).toBeDefined()
                expect(screen.queryByText('No description')).toBeNull()
            })
        })

        describe('Edge cases', () => {
            it('should handle room with no situation prose gracefully', () => {
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
                    componentUUID: 'ROOM#nonexistent',
                    displayMode: 'full'
                }

                render(
                    <Provider store={store}>
                        <RoomDescription parsedWML={standardForm} metaData={metaData} />
                    </Provider>
                )

                expect(screen.getByText('Untitled')).toBeDefined()
            })
        })
    })
})
