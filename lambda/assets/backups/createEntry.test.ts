jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('./utils.ts')
import { getCurrentDateString } from './utils'
jest.mock('../internalCache')
import internalCache from '../internalCache'

import { createEntry } from './createEntry'

const assetDBMock = jest.mocked(assetDB)
const internalCacheMock = jest.mocked(internalCache, true)
const getCurrentDateStringMock = jest.mocked(getCurrentDateString)

describe('Backup createEntry', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        getCurrentDateStringMock.mockReturnValue('2020-01-01')
    })

    it('should create first daily backup when none exists', async () => {
        assetDBMock.query.mockResolvedValue([])
        internalCacheMock.Meta.get.mockResolvedValue([{ AssetId: 'ASSET#Test', address: { zone: 'Canon', subFolder: 'Assets', fileName: 'Test' } }])
        const { suffix, fileName } = await createEntry({ AssetId: 'ASSET#Test' })
        expect(suffix).toEqual('2020-01-01-001')
        expect(fileName).toEqual('Backups/Canon/Assets/Test/2020-01-01-001.tar.gz')
        expect(assetDBMock.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#Test',
            DataCategory: 'BACKUP#2020-01-01-001',
            fileName: 'Backups/Canon/Assets/Test/2020-01-01-001.tar.gz'
        })
    })

    it('should create next daily backup when some exist', async () => {
        assetDBMock.query.mockResolvedValue([
            { AssetId: 'ASSET#Test', DataCategory: 'BACKUP#2020-01-01-002' },
            { AssetId: 'ASSET#Test', DataCategory: 'BACKUP#2020-01-01-001' }
        ])
        internalCacheMock.Meta.get.mockResolvedValue([{ AssetId: 'ASSET#Test', address: { zone: 'Canon', subFolder: 'Assets', fileName: 'Test' } }])
        const { suffix, fileName } = await createEntry({ AssetId: 'ASSET#Test' })
        expect(suffix).toEqual('2020-01-01-003')
        expect(fileName).toEqual('Backups/Canon/Assets/Test/2020-01-01-003.tar.gz')
        expect(assetDBMock.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#Test',
            DataCategory: 'BACKUP#2020-01-01-003',
            fileName: 'Backups/Canon/Assets/Test/2020-01-01-003.tar.gz'
        })
    })

    it('should place library backups in library folder', async () => {
        assetDBMock.query.mockResolvedValue([])
        internalCacheMock.Meta.get.mockResolvedValue([{ AssetId: 'ASSET#Test', address: { zone: 'Library', subFolder: 'Assets', fileName: 'Test' } }])
        const { suffix, fileName } = await createEntry({ AssetId: 'ASSET#Test' })
        expect(suffix).toEqual('2020-01-01-001')
        expect(fileName).toEqual('Backups/Library/Assets/Test/2020-01-01-001.tar.gz')
        expect(assetDBMock.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#Test',
            DataCategory: 'BACKUP#2020-01-01-001',
            fileName: 'Backups/Library/Assets/Test/2020-01-01-001.tar.gz'
        })
    })

    it('should place personal backups in personal folder', async () => {
        assetDBMock.query.mockResolvedValue([])
        internalCacheMock.Meta.get.mockResolvedValue([{ AssetId: 'ASSET#Test', address: { zone: 'Personal', player: 'Tester', subFolder: 'Assets', fileName: 'Test' } }])
        const { suffix, fileName } = await createEntry({ AssetId: 'ASSET#Test' })
        expect(suffix).toEqual('2020-01-01-001')
        expect(fileName).toEqual('Backups/Personal/Tester/Assets/Test/2020-01-01-001.tar.gz')
        expect(assetDBMock.putItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#Test',
            DataCategory: 'BACKUP#2020-01-01-001',
            fileName: 'Backups/Personal/Tester/Assets/Test/2020-01-01-001.tar.gz'
        })
    })
})

