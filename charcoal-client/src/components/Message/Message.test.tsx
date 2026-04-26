/**
* @vitest-environment jsdom
*/

import React from 'react'
import { render, screen } from '@testing-library/react'
import Message from './index'
import { PerceptionMessage, PerceptionRoomMetaData } from '@tonylb/mtw-interfaces/ts/messages'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

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

