jest.mock('./clients')
import { s3Client } from './clients'
jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'
import { AssetWorkspaceException } from './errors'

import AssetWorkspace from '.'
import { StandardNDJSON } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardAuthorizationCollectionData } from '@tonylb/mtw-wml/ts/standardize/authorization/components/dataTypes'
import { StandardAuthorizationCollection, StandardAuthorizationCollectionNDJSON } from '@tonylb/mtw-wml/ts/standardize/authorization'

const s3ClientMock = s3Client as jest.Mocked<typeof s3Client>
const uuidv4Mock = uuidv4 as jest.Mock

const uuidMockFactory = () => {
    let index = 0
    return () => {
        const returnValue = `UUID-${index}`
        index += 1
        return returnValue
    }
}

// parseAssetWorkspaceAddress tests removed in Phase 1 migration
// With flat UUID-based storage, zone-based path parsing is no longer needed

describe('AssetWorkspace', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks();
        s3ClientMock.get.mockResolvedValue('')
        s3ClientMock.put.mockResolvedValue()
        s3ClientMock.putWithTags.mockResolvedValue()
    })

    describe('loadJSON', () => {
        it('should correctly parse and assign JSON properties', async () => {
            const lines: StandardNDJSON = [
                { tag: "Asset", universalKey: 'ASSET#Test' },
                {
                    tag: 'Room',
                    key: 'testRoom',
                    universalKey: 'ROOM#001',
                    shortName: 'Test Room',
                    exits: []
                }
            ]
            s3ClientMock.get.mockResolvedValue(lines.map((line) => (JSON.stringify(line))).join('\n'))
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadJSON()
            expect(testWorkspace.standard?.toJSON()).toMatchSnapshot()
        })

        it('should return empty on no JSON file', async () => {
            s3ClientMock.get.mockImplementation(() => {
                const error = new (class NoSuchKey extends Error {
                    Code: string;
                    constructor(message: string) {
                        super(message)
                        Object.setPrototypeOf(this, NoSuchKey.prototype)
                        this.Code = 'NoSuchKey'
                    }
                })('Test message')
                throw error
            })
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadJSON()
            expect(testWorkspace.standard?.toJSON()).toEqual({ key: '', universalKey: 'ASSET#', metaData: [], components: [] })
        })

    })

    describe('loadAuthorizationJSON', () => {
        it('should correctly parse and assign JSON properties', async () => {
            const json: StandardAuthorizationCollectionNDJSON[] = [
                { tag: 'Asset', universalKey: 'ASSET#Test' },
                { referenceStack: [{ tag: 'Room', key: 'Room1' }], grant: { tag: 'Grant', player: 'Player1', actions: ['action1'] } }
            ]
            s3ClientMock.get.mockResolvedValue(json.map((line) => (JSON.stringify(line))).join('\n'))
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadAuthorizationJSON()
            expect(testWorkspace.authorizations?.toJSON()).toMatchSnapshot()
        })

        it('should return empty on no JSON file', async () => {
            s3ClientMock.get.mockImplementation(() => {
                const error = new (class NoSuchKey extends Error {
                    Code: string;
                    constructor(message: string) {
                        super(message)
                        Object.setPrototypeOf(this, NoSuchKey.prototype)
                        this.Code = 'NoSuchKey'
                    }
                })('Test message')
                throw error
            })
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadAuthorizationJSON()
            expect(testWorkspace.authorizations?.toJSON()).toEqual({ key: '', grants: [] })
        })

    })

    describe('loadAuthorizationWML', () => {
        it('should correctly parse and assign WML authorizations', async () => {
            const wml = `
                <Asset uuid=(Test)>
                    <Room key=(Room1)>
                        <Grant player=(Player1) actions="action1" />
                    </Room>
                </Asset>
            `
            s3ClientMock.get.mockResolvedValue(wml)
    
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            await testWorkspace.loadAuthorizationWML()
            expect(testWorkspace.authorizations?.toJSON()).toEqual({
                key: 'Test',
                grants: [
                    {
                        referenceStack: [{ tag: 'Room', key: 'Room1' }],
                        grants: [{ tag: 'Grant', player: 'Player1', actions: ['action1'] }]
                    }
                ]
            })
        })
    })

    describe('setWML', () => {
        it('should correctly parse WML input', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            uuidv4Mock.mockImplementation(uuidMockFactory())
            await testWorkspace.setWML(`
                <Asset uuid=(Test)>
                    <Room key=(a123)>
                        <Exit to=(b456)>welcome</Exit>
                    </Room>
                    <Room key=(b456)>
                        <Exit to=(a123)>vortex</Exit>
                    </Room>
                </Asset>
            `)
            expect(testWorkspace.standard?.toJSON()).toMatchSnapshot()
        })

        it('should throw an exception on multi-asset file', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            uuidv4Mock.mockImplementation(uuidMockFactory())
            await expect(async () => {
                await testWorkspace.setWML(`
                    <Asset uuid=(TestOne)>
                        <Room key=(a123) />
                    </Asset>
                    <Asset uuid=(TestTwo)>
                        <Room key=(a123) />
                    </Asset>
                `)
            }).rejects.toThrow()
        })
    
    })

    describe('pushJSON', () => {
        it('should correctly push JSON content to player zone', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.assetId = 'ASSET#Test'
            testWorkspace.standard = new StandardForm('Test')
            testWorkspace.status.json = 'Dirty'
            await testWorkspace.pushJSON()
            expect(testWorkspace.status.json).toEqual('Clean')
            expect(s3ClientMock.putWithTags).toHaveBeenCalledWith({
                Key: 'Test.ndjson',
                Body: `{"tag":"Asset","universalKey":"ASSET#Test"}`,
                Tags: { Zone: 'Personal' },
                Metadata: { player: 'Test' }
            })
        })

        it('should correctly push JSON content to library zone', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            testWorkspace.assetId = 'ASSET#Test'
            testWorkspace.standard = new StandardForm('Test')
            testWorkspace.status.json = 'Dirty'
            await testWorkspace.pushJSON()
            expect(testWorkspace.status.json).toEqual('Clean')
            expect(s3ClientMock.putWithTags).toHaveBeenCalledWith({
                Key: 'Test.ndjson',
                Body: `{"tag":"Asset","universalKey":"ASSET#Test"}`,
                Tags: { Zone: 'Library' },
                Metadata: undefined
            })
        })

    })

    describe('pushAuthorizationJSON', () => {
        it('should correctly push NDJSON content', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Personal',
                player: 'Test'
            })
            testWorkspace.assetId = 'ASSET#Test'
            testWorkspace.authorizations = new StandardAuthorizationCollection(`
                <Asset uuid=(test)>
                    <Room key=(Room1)>
                        <Grant player=(Player1) actions="action1" />
                    </Room>
                </Asset>
            `)
            testWorkspace.authStatus.json = 'Dirty'
            await testWorkspace.pushAuthorizationJSON()
            expect(testWorkspace.authStatus.json).toEqual('Clean')
            expect(s3ClientMock.putWithTags).toHaveBeenCalledWith({
                Key: 'Test.auth.ndjson',
                Body: `{"tag":"Asset","universalKey":"ASSET#test"}\n{"referenceStack":[{"key":"Room1","tag":"Room"}],"grant":{"tag":"Grant","player":"Player1","actions":["action1"]}}`,
                Tags: { Zone: 'Personal' },
                Metadata: { player: 'Test' }
            })
        })

    })

    describe('pushWML', () => {
        it('should correctly push WML content', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testSource = `
                <Asset uuid=(Test)>
                    <Room uuid=(room1) key=(a123)><Exit to=(b456)>welcome</Exit></Room>
                    <Room uuid=(room2) key=(b456)><Exit to=(a123)>vortex</Exit></Room>
                </Asset>
            `
            await testWorkspace.setWML(testSource)

            await testWorkspace.pushWML()
            expect(testWorkspace.status.wml).toEqual('Clean')
            expect(testWorkspace.status.json).toEqual('Dirty')
            expect(s3ClientMock.putWithTags).toHaveBeenCalledWith({
                Key: 'Test.wml',
                Body: deIndentWML(testSource),
                Tags: { Zone: 'Library' },
                Metadata: undefined
            })
        })

    })

    describe('pushWML', () => {
        it('should correctly push WML content', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testWML = `
                <Asset uuid=(test)>
                    <Room key=(Room1)><Grant player=(Player1) actions="action1" /></Room>
                </Asset>
            `
            testWorkspace.authorizations = new StandardAuthorizationCollection(testWML)

            await testWorkspace.pushAuthorizationWML()
            expect(testWorkspace.authStatus.wml).toEqual('Clean')
            expect(testWorkspace.authStatus.json).toEqual('Dirty')
            expect(s3ClientMock.putWithTags).toHaveBeenCalledWith({
                Key: 'Test.auth.wml',
                Body: deIndentWML(testWML),
                Tags: { Zone: 'Library' },
                Metadata: undefined
            })
        })

    })

    describe('setWML', () => {
        it('should not set JSON dirty on no-op', async () => {
            const testWorkspace = new AssetWorkspace({
                fileName: 'Test',
                zone: 'Library'
            })
            uuidv4Mock.mockImplementation(uuidMockFactory())
            const testSource = `
                <Asset uuid=(Test)>
                    <Room uuid=(room1) key=(a123)><Exit to=(b456)>welcome</Exit></Room>
                    <Room uuid=(room2) key=(b456)><Exit to=(a123)>vortex</Exit></Room>
                </Asset>
            `
            await testWorkspace.setWML(testSource)

            expect(testWorkspace.status.json).toEqual('Dirty')
            testWorkspace.status.json = 'Clean'

            await testWorkspace.setWML(testSource)
            expect(testWorkspace.status.json).toEqual('Clean')

        })

    })
})
