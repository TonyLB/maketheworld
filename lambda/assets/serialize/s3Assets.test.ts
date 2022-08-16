import { jest, describe, expect, it } from '@jest/globals'

import { AssetWorkspace } from './s3Assets'

describe('AssetWorkspace class', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    const assetWorkspace = new AssetWorkspace(`
        <Asset key=(Test)>
            <Room key=(welcome)>
                <Name>Welcome Room</Name>
                <Description>
                    A clean white room with several chairs and a table.
                </Description>
            </Room>
        </Asset>
    `)

    it('should return assetId', () => {
        expect(assetWorkspace.assetId).toEqual('Test')
    })
})