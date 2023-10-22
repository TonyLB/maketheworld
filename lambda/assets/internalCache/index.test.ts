jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
jest.mock('@tonylb/mtw-asset-workspace/dist/readOnly', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
            status: {
                json: 'Clean'
            },
            address,
            get fileNameBase() {
                if (address.zone === 'Personal') {
                    return 'Personal/Test/Test'
                }
                else {
                    return 'Library/Test'
                }
            },
            loadJSON: jest.fn(),
            normal: {
                'Import-0': {
                    tag: 'Import',
                },
                Test: {
                    tag: 'Asset'
                }
            },
            namespaceIdToDB: [
                { internalKey: 'VORTEX', universalKey: 'ROOM#VORTEX' }
            ]
        }
    })
})

import { CacheBase } from './baseClasses'
import { CacheConnection } from '.'

const connectionDBMock = jest.mocked(connectionDB)

describe('Internal Cache', () => {
    it('should handle mixins', async () => {
        const MixedCache = CacheConnection(CacheBase)
        connectionDBMock.getItem.mockResolvedValue({
            player: 'TestPlayer'
        })
        const cache = new MixedCache()
        cache.Connection.set({ key: 'connectionId', value: 'Test' })
        expect(await cache.Connection.get('connectionId')).toEqual('Test')
        expect(await cache.Connection.get('player')).toEqual('TestPlayer')
    })
})