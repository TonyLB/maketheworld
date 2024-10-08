jest.mock('uuid', () => ({ v4: jest.fn() }))
import { v4 as uuidv4 } from 'uuid'

jest.mock('./mockableTime', () => (jest.fn()))
import now from './mockableTime'

jest.mock('./mockableAssetDB', () => ({
    optimisticUpdate: jest.fn(),
    getItem: jest.fn()
}))
import assetDB from './mockableAssetDB'
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/delayPromise')
import delayPromise from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'

import atomicLock from '.'
import { produce } from 'immer'

const uuidv4Mock = uuidv4 as jest.Mock
const assetDBMock = assetDB as jest.Mocked<typeof assetDB>
const nowMock = now as jest.Mock
const delayPromiseMock = delayPromise as jest.Mock

describe('atomicLock', () => {
    beforeEach(() => {
        delayPromiseMock.mockResolvedValue({})
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should grant a lock immediately when there is no conflict', async () => {
        uuidv4Mock.mockReturnValue('ABCDEF')
        nowMock.mockReturnValue(1000)
        assetDBMock.optimisticUpdate.mockResolvedValue({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: []
        })
        assetDBMock.getItem.mockResolvedValue({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['ABCDEF']
        })
        await atomicLock('ASSET#ABC')
        expect(assetDBMock.optimisticUpdate.mock.calls[0][0]).toEqual({
            Key: { AssetId: 'ASSET#ABC', DataCategory: 'Meta::Asset' },
            updateKeys: ['atomicLocks'],
            updateReducer: expect.any(Function)
        })
        expect(produce({ atomicLocks: undefined }, assetDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({ atomicLocks: ['ABCDEF'] })
        expect(assetDBMock.optimisticUpdate.mock.calls[1][0]).toEqual({
            Key: { AssetId: 'ASSET#ABC', DataCategory: 'Meta::Asset' },
            updateKeys: ['timeToUnlock'],
            updateReducer: expect.any(Function)
        })
        expect(produce({ atomicLocks: ['ABCDEF'] }, assetDBMock.optimisticUpdate.mock.calls[1][0].updateReducer)).toEqual({ atomicLocks: ['ABCDEF'], timeToUnlock: 6000 })
    })

    it('should wait to grant a lock when there is a conflict', async () => {
        uuidv4Mock.mockReturnValue('2')
        nowMock.mockReturnValueOnce(1000).mockReturnValue(3000)
        assetDBMock.optimisticUpdate.mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['1', '2'],
            timeToUnlock: 2000
        }).mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['2'],
            timeToUnlock: 3000
        }).mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['2'],
            timeToUnlock: 8000
        })
        assetDBMock.getItem.mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['1', '2'],
            timeToUnlock: 2000
        }).mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['2'],
            timeToUnlock: 3000
        })
        await atomicLock('ASSET#ABC')
        expect(delayPromiseMock).toHaveBeenCalled()
        expect(assetDBMock.optimisticUpdate.mock.calls[0][0]).toEqual({
            Key: { AssetId: 'ASSET#ABC', DataCategory: 'Meta::Asset' },
            updateKeys: ['atomicLocks'],
            updateReducer: expect.any(Function)
        })
        expect(produce({ atomicLocks: ['1'] }, assetDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({ atomicLocks: ['1', '2'] })
        expect(assetDBMock.optimisticUpdate.mock.calls[1][0]).toEqual({
            Key: { AssetId: 'ASSET#ABC', DataCategory: 'Meta::Asset' },
            updateKeys: ['timeToUnlock'],
            updateReducer: expect.any(Function)
        })
        expect(produce({ atomicLocks: ['2'] }, assetDBMock.optimisticUpdate.mock.calls[1][0].updateReducer)).toEqual({ atomicLocks: ['2'], timeToUnlock: 8000 })
    })

    it('should force unlock when timeout expires', async () => {
        uuidv4Mock.mockReturnValue('2')
        nowMock.mockReturnValueOnce(1000).mockReturnValue(3000)
        assetDBMock.optimisticUpdate.mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['1', '2'],
            timeToUnlock: 2000
        }).mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['2'],
            timeToUnlock: 8000
        })
        assetDBMock.getItem.mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['1', '2'],
            timeToUnlock: 2000
        }).mockResolvedValueOnce({
            AssetId: 'ASSET#ABC',
            DataCategory: 'Meta::Asset',
            atomicLocks: ['1', '2'],
            timeToUnlock: 2000
        })
        await atomicLock('ASSET#ABC')
        expect(delayPromiseMock).toHaveBeenCalled()
        expect(assetDBMock.optimisticUpdate.mock.calls[0][0]).toEqual({
            Key: { AssetId: 'ASSET#ABC', DataCategory: 'Meta::Asset' },
            updateKeys: ['atomicLocks'],
            updateReducer: expect.any(Function)
        })
        expect(produce({ atomicLocks: ['1'] }, assetDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({ atomicLocks: ['1', '2'] })
        expect(assetDBMock.optimisticUpdate.mock.calls[1][0]).toEqual({
            Key: { AssetId: 'ASSET#ABC', DataCategory: 'Meta::Asset' },
            updateKeys: ['atomicLocks', 'timeToUnlock'],
            updateReducer: expect.any(Function)
        })
        expect(produce({ atomicLocks: ['1', '2'], timeToUnlock: 2000 }, assetDBMock.optimisticUpdate.mock.calls[1][0].updateReducer)).toEqual({ atomicLocks: ['2'], timeToUnlock: 8000 })
    })
})