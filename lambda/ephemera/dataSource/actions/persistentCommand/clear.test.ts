jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { clear, clearSession } from './clear'

describe('persistentCommand clear', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('deletes one character/session row', async () => {
        await clear('CHARACTER#TESS', 'abc')
        expect(ephemeraDB.deleteItem).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.deleteItem).toHaveBeenCalledWith({ EphemeraId: 'CHARACTER#TESS', DataCategory: 'SESSION#abc' })
    })

    it('queries the session category and deletes every character row found', async () => {
        ;(ephemeraDB.query as jest.Mock).mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', DataCategory: 'SESSION#abc' },
            { EphemeraId: 'CHARACTER#MARCO', DataCategory: 'SESSION#abc' },
        ])
        await clearSession('abc')
        expect(ephemeraDB.query).toHaveBeenCalledWith({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: 'SESSION#abc' },
            KeyConditionExpression: 'begins_with(EphemeraId, :characterPrefix)',
            ExpressionAttributeValues: { ':characterPrefix': 'CHARACTER#' },
        })
        expect(ephemeraDB.deleteItem).toHaveBeenCalledTimes(2)
        expect(ephemeraDB.deleteItem).toHaveBeenCalledWith({ EphemeraId: 'CHARACTER#TESS', DataCategory: 'SESSION#abc' })
        expect(ephemeraDB.deleteItem).toHaveBeenCalledWith({ EphemeraId: 'CHARACTER#MARCO', DataCategory: 'SESSION#abc' })
    })

    it('deletes nothing when the session has no rows', async () => {
        ;(ephemeraDB.query as jest.Mock).mockResolvedValue([])
        await clearSession('abc')
        expect(ephemeraDB.deleteItem).not.toHaveBeenCalled()
    })
})
