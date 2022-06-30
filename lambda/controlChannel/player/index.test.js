jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index.js')
import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
jest.mock('@tonylb/mtw-utilities/dist/selfHealing/index.js')
import { generatePersonalAssetLibrary } from '@tonylb/mtw-utilities/dist/selfHealing/index.js'

import { whoAmI } from './index.js'

describe('whoAmI', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return assets in table for given player', async () => {
        ephemeraDB.getItem.mockResolvedValue({
            player: 'TestPlayer'
        })
        assetDB.getItem.mockResolvedValue({
            CodeOfConductConsent: true
        })
        generatePersonalAssetLibrary.mockResolvedValue({
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
        const output = await whoAmI('ABC', 'RequestTest')
        expect(output).toEqual({
            statusCode: 200,
            body: JSON.stringify({
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
            })
        })
    })
})
