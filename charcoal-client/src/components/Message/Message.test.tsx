/**
* @vitest-environment jsdom
*/

import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import Message from './index'
import { PerceptionMessage, PerceptionRoomMetaData } from '@tonylb/mtw-interfaces/ts/messages'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

vi.mock('./CharacterDescription', () => ({
    __esModule: true,
    default: () => <div data-testid="character-description-route">CharacterDescription</div>
}))

const mockStore = configureStore([])

describe('Message component - PerceptionMessage routing', () => {
    it('should render a generating room header as a Generating... placeholder', () => {
        const store = mockStore({
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
                                assets: [],
                                characters: [],
                                settings: { onboardCompleteTags: [] }
                            }
                        }
                    }
                }
            },
            personalAssets: { byId: {} },
            activeCharacters: {
                activeCharacter: 'CHARACTER#test'
            },
            settings: {
                server: { ChatPrompt: 'What do you do?' },
                client: { TextEntryLines: 1, ShowNeighborhoodHeaders: false, AlwaysShowOnboarding: false },
                connection: { sessionId: '', playerName: 'test-player' }
            },
            lifeLine: {}
        })

        const metaData: PerceptionRoomMetaData = {
            componentUUID: 'ROOM#test-room',
            displayMode: 'header',
            status: 'generating'
        }

        const message: PerceptionMessage & { parsedWML?: any } = {
            DisplayProtocol: 'PerceptionMessage',
            MessageId: 'msg-1',
            CreatedTime: Date.now(),
            wmlContent: '<Asset uuid=(render)><Room uuid=(ROOM#test-room) /></Asset>',
            metaData,
            parsedWML: {
                byUniversalId: {},
                _lookup: () => undefined
            }
        }

        render(
            <Provider store={store}>
                <Message message={message} />
            </Provider>
        )

        expect(screen.getByText('Generating...')).toBeDefined()
    })

    it('routes character PerceptionMessage via WML Character tag (switch fallback)', () => {
        const store = mockStore({
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
                                assets: [],
                                characters: [],
                                settings: { onboardCompleteTags: [] }
                            }
                        }
                    }
                }
            },
            personalAssets: { byId: {} },
            activeCharacters: {
                activeCharacter: 'CHARACTER#test'
            },
            settings: {
                server: { ChatPrompt: 'What do you do?' },
                client: { TextEntryLines: 1, ShowNeighborhoodHeaders: false, AlwaysShowOnboarding: false },
                connection: { sessionId: '', playerName: 'test-player' }
            },
            lifeLine: {}
        })

        const characterId = 'CHARACTER#5237d855-cac6-471b-96d9-0c3d38d856d7' as const
        const wmlContent = `<Asset uuid=(render)>
 <Character uuid=(${characterId})>
 <DisplayName>TonyLB</DisplayName>
 <Pronouns>they/them</Pronouns>
 </Character>
</Asset>`

        const message: PerceptionMessage & { parsedWML: { byUniversalId: Record<string, { tag: string }> } } = {
            DisplayProtocol: 'PerceptionMessage',
            MessageId: 'msg-char',
            CreatedTime: Date.now(),
            Target: 'CHARACTER#viewer',
            wmlContent,
            metaData: { componentUUID: characterId },
            parsedWML: { byUniversalId: { [characterId]: { tag: 'Character' } } }
        }

        render(
            <Provider store={store}>
                <Message message={message} />
            </Provider>
        )

        expect(screen.getByTestId('character-description-route')).toBeDefined()
        expect(screen.queryByText(/Unknown message type/)).toBeNull()
    })

    it('routes character PerceptionMessage via character metadata when WML lookup misses', () => {
        const store = mockStore({
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
                                assets: [],
                                characters: [],
                                settings: { onboardCompleteTags: [] }
                            }
                        }
                    }
                }
            },
            personalAssets: { byId: {} },
            activeCharacters: {
                activeCharacter: 'CHARACTER#test'
            },
            settings: {
                server: { ChatPrompt: 'What do you do?' },
                client: { TextEntryLines: 1, ShowNeighborhoodHeaders: false, AlwaysShowOnboarding: false },
                connection: { sessionId: '', playerName: 'test-player' }
            },
            lifeLine: {}
        })

        const characterId = 'CHARACTER#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' as const
        const message: PerceptionMessage & { parsedWML: { byUniversalId: Record<string, unknown> } } = {
            DisplayProtocol: 'PerceptionMessage',
            MessageId: 'msg-char-meta',
            CreatedTime: Date.now(),
            Target: 'CHARACTER#viewer',
            wmlContent: '',
            metaData: { componentUUID: characterId },
            parsedWML: { byUniversalId: {} }
        }

        render(
            <Provider store={store}>
                <Message message={message} />
            </Provider>
        )

        expect(screen.getByTestId('character-description-route')).toBeDefined()
        expect(screen.queryByText(/Unknown message type/)).toBeNull()
    })
})

describe('Message component - CoyoteGameHelpMessage routing', () => {
    it('should render the coyote help header', () => {
        const store = mockStore({
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
                                assets: [],
                                characters: [],
                                settings: { onboardCompleteTags: [] }
                            }
                        }
                    }
                }
            },
            personalAssets: { byId: {} },
            activeCharacters: {
                activeCharacter: 'CHARACTER#test'
            },
            settings: {
                server: { ChatPrompt: 'What do you do?' },
                client: { TextEntryLines: 1, ShowNeighborhoodHeaders: false, AlwaysShowOnboarding: false },
                connection: { sessionId: '', playerName: 'test-player' }
            },
            lifeLine: {}
        })
        const message = {
            DisplayProtocol: 'CoyoteGameHelpMessage',
            MessageId: 'msg-help',
            CreatedTime: Date.now()
        } as const

        render(
            <Provider store={store}>
                <Message message={message} />
            </Provider>
        )

        expect(screen.getByText('Welcome to the Coyote Game')).toBeDefined()
    })
})

describe('Message component - CoyoteGameHypothesisMessage routing', () => {
    it('should render hypothesis message in dedicated component surface', () => {
        const store = mockStore({
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
                                assets: [],
                                characters: [],
                                settings: { onboardCompleteTags: [] }
                            }
                        }
                    }
                }
            },
            personalAssets: { byId: {} },
            activeCharacters: {
                activeCharacter: 'CHARACTER#test'
            },
            settings: {
                server: { ChatPrompt: 'What do you do?' },
                client: { TextEntryLines: 1, ShowNeighborhoodHeaders: false, AlwaysShowOnboarding: false },
                connection: { sessionId: '', playerName: 'test-player' }
            },
            lifeLine: {}
        })
        const message = {
            DisplayProtocol: 'CoyoteGameHypothesisMessage',
            MessageId: 'msg-hypothesis',
            CreatedTime: Date.now(),
            Message: ['Hypothesis: Generating...']
        } as const

        render(
            <Provider store={store}>
                <Message message={message as any} />
            </Provider>
        )

        expect(screen.getByTestId('coyote-game-hypothesis-message')).toBeDefined()
        expect(screen.getByText('Hypothesis: Generating...')).toBeDefined()
    })
})

