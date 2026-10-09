jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { PERSISTENT_COMMAND_TTL_MS } from './lifetime'
import { get, put } from './rowStore'
import { takeCupPayload } from './testFixtures'

const nowSeconds = () => Math.floor(Date.now() / 1000)

describe('persistentCommand rowStore', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('puts the payload under the character/session key with a deleteAt one TTL out', async () => {
        const payload = takeCupPayload()
        await put('CHARACTER#TESS', 'abc', payload)
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(1)
        const item = (ephemeraDB.putItem as jest.Mock).mock.calls[0][0]
        expect(item).toEqual({
            EphemeraId: 'CHARACTER#TESS',
            DataCategory: 'SESSION#abc',
            ...payload,
            deleteAt: expect.any(Number),
        })
        expect(Math.abs(item.deleteAt - (nowSeconds() + PERSISTENT_COMMAND_TTL_MS / 1000))).toBeLessThanOrEqual(2)
    })

    it('gets the payload back, without the key or deleteAt', async () => {
        const payload = takeCupPayload()
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            DataCategory: 'SESSION#abc',
            ...payload,
            deleteAt: nowSeconds() + 100,
        })
        expect(await get('CHARACTER#TESS', 'abc')).toEqual(payload)
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            Key: { EphemeraId: 'CHARACTER#TESS', DataCategory: 'SESSION#abc' },
            getAllFields: true,
        })
    })

    it('treats a missing row as absent', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue(undefined)
        expect(await get('CHARACTER#TESS', 'abc')).toBeUndefined()
    })

    it('treats a row past its deleteAt as absent, even though Dynamo has not removed it yet', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue({ ...takeCupPayload(), deleteAt: nowSeconds() - 1 })
        expect(await get('CHARACTER#TESS', 'abc')).toBeUndefined()
    })

    it('treats a row that fails the guard as absent rather than throwing', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue({ root: 'old shape', deleteAt: nowSeconds() + 100 })
        expect(await get('CHARACTER#TESS', 'abc')).toBeUndefined()
    })
})
