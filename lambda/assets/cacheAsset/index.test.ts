import eventBridgeClient from '@tonylb/mtw-utilities/ts/eventBridge'
import { MessageBus } from '../messageBus/baseClasses'
import { cacheAssetMessage } from './index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import internalCache from '../internalCache'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        deleteItem: jest.fn(),
        putItem: jest.fn(),
        optimisticUpdate: jest.fn()
    }
}))

jest.mock('../internalCache', () => ({
    ...jest.requireActual('../internalCache'),
    AssetData: {
        get: jest.fn(),
        invalidate: jest.fn()
    },
    Meta: {
        get: jest.fn().mockResolvedValue([{ address: { zone: 'Draft', player: 'Test' } }]),
        invalidate: jest.fn()
    },
    ComponentData: {
        get: jest.fn(),
        invalidate: jest.fn()
    }
}))

const internalCacheMock = jest.mocked(internalCache, { shallow: false })

let standardFormMock = new StandardForm('<Asset key=(Test) />')
jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
            status: {
                json: 'Clean'
            },
            address,
            loadJSON: jest.fn(),
            standardForm: standardFormMock
        }
    })
})

jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    send: jest.fn()
}))

const eventBridgeSendMock = jest.mocked(eventBridgeClient.send, { shallow: false })

describe('Cache Asset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        standardFormMock = new StandardForm('<Asset key=(Test) />')
    })

    it('should publish Character Removed event', async () => {
        const event = {
            type: 'CacheAsset',
            assetId: 'Test'
        } as const

        internalCacheMock.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#Test',
            standardForm: new StandardForm([
                { tag: 'Asset', key: 'Test' },
                { tag: 'Character', key: 'TestCharacter', universalKey: 'CHARACTER#12345' },
            ])
        }])
        internalCacheMock.ComponentData.get.mockResolvedValue([])

        const messageBus = {
            send: jest.fn()
        } as unknown as MessageBus
        await cacheAssetMessage({ payloads: [event], messageBus })
        expect(eventBridgeSendMock).toHaveBeenCalledWith([
            {
                Source: 'mtw.assets',
                DetailType: 'Character Removed',
                Detail: { characterId: 'CHARACTER#12345' }
            }
        ])
    })

    it('should publish Character Updated event', async () => {
        const event = {
            type: 'CacheAsset',
            assetId: 'Test'
        } as const

        internalCacheMock.AssetData.get.mockResolvedValue([{
            AssetId: 'ASSET#Test',
            standardForm: new StandardForm([
                { tag: 'Asset', key: 'Test' },
                { tag: 'Character', key: 'TestCharacter', universalKey: 'CHARACTER#12345' },
            ])
        }])
        internalCacheMock.ComponentData.get.mockResolvedValue([{
            ComponentId: 'CHARACTER#12345',
            byAssets: [{ AssetId: 'ASSET#Test', component: new StandardCharacter('<Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character>') }]
        }])
        standardFormMock = new StandardForm('<Asset key=(Test)><Character uuid=(12345) key=(TestCharacter)><ShortName>Test</ShortName></Character></Asset>')

        const messageBus = {
            send: jest.fn()
        } as unknown as MessageBus
        await cacheAssetMessage({ payloads: [event], messageBus })
        expect(eventBridgeSendMock).toHaveBeenCalledWith([
            {
                Source: 'mtw.assets',
                DetailType: 'Character Updated',
                Detail: {
                    characterId: 'CHARACTER#12345',
                    byAssets: [{
                        AssetId: 'ASSET#Test',
                        component: {
                            key: 'TestCharacter',
                            tag: 'Character',
                            shortName: 'Test',
                            universalKey: 'CHARACTER#12345'
                        }
                    }]
                }
            }
        ])
    })
})