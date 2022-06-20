import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/selfHealing/index.js')
import { generatePersonalAssetLibrary } from '@tonylb/mtw-utilities/selfHealing/index.js'
jest.mock('@tonylb/mtw-utilities/apiManagement/index.js')
import { SocketQueue } from '@tonylb/mtw-utilities/apiManagement/index.js'

import { handlePlayerEvents } from './player.js'

describe('handlePlayerEvents', () => {
    const socketFlushMock = jest.fn()
    const sendPlayerMock = jest.fn()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        generatePersonalAssetLibrary.mockImplementation((playerName) => {
            switch(playerName) {
                case 'TestPlayer':
                    return {
                        PlayerName: 'TestPlayer',
                        Assets:  [{
                            AssetId: 'QRS'
                        },
                        {
                            AssetId: 'StoryTest',
                            Story: true,
                            instance: true
                        }],
                        Characters: [{
                            CharacterId: 'MNO',
                            Name: 'Tess',
                            scopedId: 'TESS'
                        }]
                    }
                case 'TestPlayerTwo':
                    return {
                        PlayerName: 'TestPlayerTwo',
                        Assets:  [{
                            AssetId: 'XYZ'
                        }],
                        Characters: []
                    }
                case 'TestPlayerThree':
                    return {
                        PlayerName: 'TestPlayerThree',
                        Assets:  [{
                            AssetId: 'DEF'
                        }],
                        Characters: []
                    }
                case 'TestPlayerFour':
                    return {
                        PlayerName: 'TestPlayerFour',
                        Assets:  [{
                            AssetId: 'GHI'
                        }],
                        Characters: []
                    }
            }
        })

        SocketQueue.mockImplementation(() => ({
            sendPlayer: sendPlayerMock,
            flush: socketFlushMock
        }))
    })

    it('should update players on player-impacting events', async () => {
        await handlePlayerEvents({ events: [{
            oldImage: {
                player: 'TestPlayer'
            },
            newImage: {}
        },
        {
            oldImage: {},
            newImage: { player: 'TestPlayerTwo' }
        },
        {
            oldImage: { player: 'TestPlayerThree' },
            newImage: { player: 'TestPlayerFour' }
        }]})
        expect(sendPlayerMock).toHaveBeenCalledTimes(4)
        expect(sendPlayerMock).toHaveBeenCalledWith({
            PlayerName: 'TestPlayer',
            Message: {
                messageType: 'Player',
                PlayerName: 'TestPlayer',
                Assets: [{
                    AssetId: 'QRS'
                },
                {
                    AssetId: 'StoryTest',
                    Story: true,
                    instance: true
                }],
                Characters: [{
                    CharacterId: 'MNO',
                    Name: 'Tess',
                    scopedId: 'TESS'
                }]
            }
        })
        expect(sendPlayerMock).toHaveBeenCalledWith({
            PlayerName: 'TestPlayerTwo',
            Message: {
                messageType: 'Player',
                PlayerName: 'TestPlayerTwo',
                Assets:  [{
                    AssetId: 'XYZ'
                }],
                Characters: []
            }
        })
        expect(sendPlayerMock).toHaveBeenCalledWith({
            PlayerName: 'TestPlayerThree',
            Message: {
                messageType: 'Player',
                PlayerName: 'TestPlayerThree',
                Assets:  [{
                    AssetId: 'DEF'
                }],
                Characters: []
            }
        })
        expect(sendPlayerMock).toHaveBeenCalledWith({
            PlayerName: 'TestPlayerFour',
            Message: {
                messageType: 'Player',
                PlayerName: 'TestPlayerFour',
                Assets:  [{
                    AssetId: 'GHI'
                }],
                Characters: []
            }
        })
    })
})
