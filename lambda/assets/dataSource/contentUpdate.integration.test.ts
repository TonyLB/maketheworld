/**
 * Cross-boundary integration: a real WMLEventSerializer serialize/deserialize round trip
 * (the same serializer lambda/wml uses to publish, and lambda/assets/app.ts uses to receive)
 * feeding a real (unmocked) assetsDataSource.receiveEvents -> handleContentUpdate -> cacheAsset.
 *
 * Only leaf I/O is mocked (DynamoDB, S3-backed ReadOnlyAssetWorkspace, internalCache) -- unlike
 * index.test.ts's "should process WML content update events" test, `./caching` is NOT mocked here,
 * so this proves the resynced content actually reaches DynamoDB, not just that a function was called.
 *
 * Complements lambda/wml/dataSource/mtw-wml.test.ts's "WML Materialized View Finding Event
 * Processing" tests, which cover the publish side (streamEvent called with the right arguments)
 * but stop at the Lambda boundary.
 */
import { assetsDataSource } from './index'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../internalCache'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { WMLEventSerializer, WMLStreamingEventHeader } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        putItem: jest.fn(),
        getItem: jest.fn(),
        deleteItem: jest.fn(),
        query: jest.fn(),
        optimisticUpdate: jest.fn()
    }
}))

jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    eventBridgeClient: { send: jest.fn() }
}))

jest.mock('../clients', () => ({
    snsClient: { send: jest.fn() },
    sfnClient: { send: jest.fn() }
}))

jest.mock('../messageBus')

jest.mock('../componentTopology', () => ({
    emitTopologyInvalidatedForRoomTargets: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../player/heal', () => ({
    healPlayer: jest.fn(async () => ({ Characters: [], Assets: [], guestName: '', guestId: '' }))
}))

jest.mock('./components/verticals/healComponentVertical', () => ({
    healComponentVertical: jest.fn(async () => ({ assetId: 'ASSET#stub', universalKeysProcessed: 0 })),
}))

jest.mock('../internalCache', () => ({
    ...jest.requireActual('../internalCache'),
    AssetData: {
        get: jest.fn(),
        invalidate: jest.fn()
    },
    AssetMetaData: {
        get: jest.fn().mockResolvedValue([{ zone: 'Canon' }]),
        invalidate: jest.fn()
    },
    ComponentData: {
        get: jest.fn().mockResolvedValue([]),
        invalidate: jest.fn()
    },
    Graph: {
        get: jest.fn().mockResolvedValue({
            reverse: jest.fn().mockReturnValue({
                topologicalSort: jest.fn().mockReturnValue({ flat: jest.fn().mockReturnValue([]) })
            })
        })
    }
}))

let standardFormMock = new StandardForm('<Asset uuid=(test-asset) />')
const mockLoadJSON = jest.fn()

jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly', () => {
    const mockAssetWorkspaceClass = jest.fn().mockImplementation((address: any) => ({
        status: { json: 'Clean' },
        address,
        loadJSON: mockLoadJSON,
        get standard() { return standardFormMock }
    }));
    (mockAssetWorkspaceClass as any).fromUUID = jest.fn().mockImplementation(async (assetId: string) => ({
        status: { json: 'Clean' },
        address: { zone: 'Canon', fileName: assetId.replace('ASSET#', ''), subFolder: 'Assets' },
        assetId,
        loadJSON: mockLoadJSON,
        get standard() { return standardFormMock }
    }))
    return {
        __esModule: true,
        default: mockAssetWorkspaceClass,
        ReadOnlyAssetWorkspace: mockAssetWorkspaceClass
    }
})

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const internalCacheMock = jest.mocked(internalCache, { shallow: false })

const assetId = 'ASSET#test-asset'
const serializer = new WMLEventSerializer({ fetch: global.fetch })
const wmlHeader: WMLStreamingEventHeader = { dataSourceKey: 'mtw.wml', streamKey: assetId, timestamp: 0, type: 'Content Update' }

// Round-trips a StandardForm through the real serializer, exactly as processWMLMaterializedViewFinding's
// streamEvent -> real PutEventsCommand -> lambda/assets/app.ts's WMLEventSerializer.deserialize would.
const roundTripContentUpdate = async (wml: string) => {
    const externalEvent = serializer.serialize({ content: { schema: new StandardForm(deIndentWML(wml)) }, header: wmlHeader })
    return serializer.deserialize({ content: externalEvent as { wml: string }, header: wmlHeader })
}

describe('Content Update -> cacheAsset (integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        assetDBMock.getItem.mockResolvedValue({ AssetId: assetId })
        internalCacheMock.AssetMetaData.get.mockResolvedValue([{ zone: 'Canon' }] as any)
        mockLoadJSON.mockResolvedValue(undefined)
    })

    it('writes the resynced content to DynamoDB after a real serialize/deserialize round trip', async () => {
        // Stale DynamoDB cache, as if written before the .wml/.ndjson resync
        internalCacheMock.AssetData.get.mockResolvedValue([{
            AssetId: assetId,
            standardForm: new StandardForm(deIndentWML(`
                <Asset uuid=(test-asset)>
                    <Room uuid=(VORTEX)><ShortName>Old Name</ShortName></Room>
                </Asset>
            `))
        }])

        // Freshly re-parsed .wml content, as if just written to .ndjson by processWMLMaterializedViewFinding
        standardFormMock = new StandardForm(deIndentWML(`
            <Asset uuid=(test-asset)>
                <Room uuid=(VORTEX)><ShortName>New Name</ShortName></Room>
            </Asset>
        `))

        const deserialized = await roundTripContentUpdate(`
            <Asset uuid=(test-asset)>
                <Room uuid=(VORTEX)><ShortName>New Name</ShortName></Room>
            </Asset>
        `)
        expect(deserialized).not.toBeNull()

        const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
        await assetsDataSource.receiveEvents!({
            events: [{
                header: wmlHeader,
                getContent: () => Promise.resolve(deserialized)
            }],
            streamEvent: mockStreamEvent,
            streamEnvelope: jest.fn().mockResolvedValue(undefined)
        })

        // The Room component was diffed and written with the resynced content
        expect(assetDBMock.putItem).toHaveBeenCalledWith(expect.objectContaining({ AssetId: 'ROOM#VORTEX' }))

        const componentUpdatedCall = mockStreamEvent.mock.calls.find((call) => call[0]?.header?.type === 'Component Updated')
        expect(componentUpdatedCall).toBeDefined()
        const componentUpdateWML = schemaToWML([componentUpdatedCall![0].update.component.schema])
        expect(componentUpdateWML).toContain('Old Name')
        expect(componentUpdateWML).toContain('New Name')

        // handleContentUpdate itself completed downstream of cacheAsset
        expect(mockStreamEvent).toHaveBeenCalledWith(expect.objectContaining({ header: { type: 'Asset Cached' } }))
    })

    it('is idempotent: re-running against already-matching content makes no DynamoDB writes to the room', async () => {
        const matchingForm = new StandardForm(deIndentWML(`
            <Asset uuid=(test-asset)>
                <Room uuid=(VORTEX)><ShortName>Stable Name</ShortName></Room>
            </Asset>
        `))

        internalCacheMock.AssetData.get.mockResolvedValue([{ AssetId: assetId, standardForm: matchingForm }])
        standardFormMock = matchingForm

        const deserialized = await roundTripContentUpdate(`
            <Asset uuid=(test-asset)>
                <Room uuid=(VORTEX)><ShortName>Stable Name</ShortName></Room>
            </Asset>
        `)

        const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
        await assetsDataSource.receiveEvents!({
            events: [{
                header: wmlHeader,
                getContent: () => Promise.resolve(deserialized)
            }],
            streamEvent: mockStreamEvent,
            streamEnvelope: jest.fn().mockResolvedValue(undefined)
        })

        expect(assetDBMock.putItem).not.toHaveBeenCalledWith(expect.objectContaining({ AssetId: 'ROOM#VORTEX' }))
        expect(assetDBMock.deleteItem).not.toHaveBeenCalled()
    })
})
