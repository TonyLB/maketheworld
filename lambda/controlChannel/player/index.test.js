import { jest, describe, it, expect } from '@jest/globals'

import { assetDB, ephemeraDB } from '/opt/utilities/dynamoDB/index.js'

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
        assetDB.query.mockResolvedValue([{
            AssetId: 'CHARACTER#MNO',
            DataCategory: 'Meta::Character',
            scopedId: 'TESS',
            Name: 'Tess'
        },
        {
            AssetId: 'ASSET#QRS',
            DataCategory: 'Meta::Asset'
        },
        {
            AssetId: 'ASSET#StoryTest',
            DataCategory: 'Meta::Asset',
            Story: true,
            instance: true
        }])
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
