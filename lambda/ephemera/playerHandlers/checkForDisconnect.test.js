import { jest, describe, it, expect } from '@jest/globals'

import { ephemeraDB, assetDB } from '/opt/utilities/dynamoDB/index.js'

import { checkForDisconnect } from './checkForDisconnect.js'

describe('player checkForDisconnect', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should remove connection from global and library subscriptions', async () => {
        assetDB.getItem.mockResolvedValue({
            ConnectionIds: ['123', '456']
        })
        await checkForDisconnect({
            oldImage: {
                DataCategory: 'CONNECTION#123'
            }
        })
        expect(assetDB.getItem).toHaveBeenCalledWith({
            AssetId: 'Library',
            DataCategory: 'Subscriptions',
            ProjectionFields: ['ConnectionIds']
        })
        expect(ephemeraDB.update).toBeCalledTimes(1)
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'Global',
            DataCategory: 'Connections',
            UpdateExpression: 'REMOVE connections.#connection',
            ExpressionAttributeNames: {
                '#connection': '123'
            }
        })
        expect(assetDB.update).toBeCalledTimes(1)
        expect(assetDB.update).toHaveBeenCalledWith({
            AssetId: 'Library',
            DataCategory: 'Subscriptions',
            UpdateExpression: 'SET ConnectionIds = :connectionIds',
            ExpressionAttributeValues: {
                ':connectionIds': ['456']
            }
        })
    })
})