jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index.js')
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
jest.mock('@tonylb/mtw-utilities/dist/selfHealing/index.js')
import { generatePersonalAssetLibrary } from '@tonylb/mtw-utilities/dist/selfHealing/index.js'

jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('../messageBus')
import messageBus from '../messageBus'

import whoAmIMessage from './index'

const assetDBMock = assetDB as jest.Mocked<typeof assetDB>
const generatePersonalAssetLibraryMock = generatePersonalAssetLibrary as jest.Mock
const internalCacheMock = internalCache as jest.Mocked<typeof internalCache>
const messageBusMock = messageBus as jest.Mocked<typeof messageBus>

describe('whoAmI', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return assets in table for given player', async () => {
        assetDBMock.getItem.mockResolvedValue({
            CodeOfConductConsent: true
        })
        generatePersonalAssetLibraryMock.mockResolvedValue({
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
        })
        internalCacheMock.get.mockResolvedValueOnce('TestPlayer').mockResolvedValueOnce('RequestTest')
        await whoAmIMessage({ payloads: [{ type: 'WhoAmI'} ], messageBus })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
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
                }],
                CodeOfConductConsent: true,
                RequestId: 'RequestTest'
            }
        })
    })
})
