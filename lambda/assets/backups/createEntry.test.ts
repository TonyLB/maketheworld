jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('./utils.ts')
import { getCurrentDateString } from './utils'

import { createEntry } from './creteEntry'

const assetDBMock = jest.mocked(assetDB)
const getCurrentDateStringMock = jest.mocked(getCurrentDateString)

describe('Backup createEntry', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        getCurrentDateStringMock.mockReturnValue('2020-01-01')
    })

    it('should create first daily backup when none exists', async () => {
        assetDBMock.query.mockResolvedValue([])
        const prefix = await createEntry({ AssetId: 'ASSET#Test' })
        expect(prefix).toEqual('2020-01-01-001')
    })

    it('should create next daily backup when some exist', async () => {
        assetDBMock.query.mockResolvedValue([
            { AssetId: 'ASSET#Test', DataCategory: 'BACKUP#2020-01-01-002' },
            { AssetId: 'ASSET#Test', DataCategory: 'BACKUP#2020-01-01-001' }
        ])
        const prefix = await createEntry({ AssetId: 'ASSET#Test' })
        expect(prefix).toEqual('2020-01-01-003')
    })
})

