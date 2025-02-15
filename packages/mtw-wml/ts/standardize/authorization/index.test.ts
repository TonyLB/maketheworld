import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardAuthorizationCollectionData } from "./components/dataTypes"
import { StandardAuthorizationCollection } from "./index"
import { StandardAuthorizationResource } from "./resource"
import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"

describe('StandardAuthorizationCollection', () => {
    it('should initialize with a string key', () => {
        const collection = new StandardAuthorizationCollection('TestKey')
        expect(collection.key).toEqual('TestKey')
        expect(collection._grants).toEqual([])
    })

    it('should initialize with StandardAuthorizationCollectionData', () => {
        const data: StandardAuthorizationCollectionData = {
            key: 'TestKey',
            grants: [
                {
                    referenceStack: [{ key: 'Room1', tag: 'Room' }],
                    grants: []
                }
            ]
        }
        const collection = new StandardAuthorizationCollection(data)
        expect(collection.key).toEqual('TestKey')
        expect(collection._grants.length).toEqual(1)
        expect(collection._grants[0]).toBeInstanceOf(StandardAuthorizationResource)
    })

    it('should initialize with GenericTreeNode<SchemaTag>', () => {
        const node: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Asset', key: 'TestKey', Story: undefined },
            children: []
        }
        const collection = new StandardAuthorizationCollection(node)
        expect(collection.key).toEqual('TestKey')
        expect(collection._grants).toEqual([])
    })

    it('should throw error on invalid arguments', () => {
        expect(() => new StandardAuthorizationCollection(123 as any)).toThrow('Invalid arguments in StandardAuthorization constructor')
    })

    it('should return header', () => {
        const collection = new StandardAuthorizationCollection('TestKey')
        expect(collection.header).toEqual({
            tag: 'Asset',
            key: 'TestKey',
            universalKey: 'ASSET#TestKey'
        })
    })

    it('should return byId', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset key=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        expect(collection.byId).toEqual({
            'Room1': new StandardAuthorizationResource({
                referenceStack: [{ key: 'Room1', tag: 'Room' }],
                grants: [{
                    tag: 'Grant',
                    player: 'Player1',
                    actions: ['action1']
                }]
            })
        })
    })

    it('should return global resource', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset key=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        expect(collection.global).toEqual(new StandardAuthorizationResource({
            referenceStack: [],
            grants: [{
                tag: 'Grant',
                player: 'Player1',
                actions: ['action0']
            }]
        }))
    })

    it('should return empty global resource if none exists', () => {
        const collection = new StandardAuthorizationCollection('TestKey')
        expect(collection.global).toBeInstanceOf(StandardAuthorizationResource)
        expect(collection.global.referenceStack).toEqual([])
        expect(collection.global.grants).toEqual([])
    })

    it('should return JSON representation', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset key=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        expect(collection.toJSON()).toEqual({
            key: 'test',
            grants: [
                {
                    referenceStack: [],
                    grants: [{
                        tag: 'Grant',
                        player: 'Player1',
                        actions: ['action0']
                    }]
                },
                {
                    referenceStack: [{ key: 'Room1', tag: 'Room', exits: [] }],
                    grants: [{
                        tag: 'Grant',
                        player: 'Player1',
                        actions: ['action1']
                    }]
                }
            ]
        })
    })

    it('should return schema', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)><Grant player=(Player1) actions="action1" /></Room>
            </Asset>
        `)
        const collection = new StandardAuthorizationCollection(testWML)
        expect(schemaToWML([collection.schema])).toEqual(testWML)
    })

    it('should sort schema appropriately', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset key=(test)>
                <Feature key=(FeatureTwo)><Grant player=(Player1) actions="action2" /></Feature>
                <Room key=(Room1)><Grant player=(Player1) actions="action3" /></Room>
                <Feature key=(FeatureOne)><Grant player=(Player1) actions="action1" /></Feature>
            </Asset>
        `)
        expect(schemaToWML([collection.schema])).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(Room1)><Grant player=(Player1) actions="action3" /></Room>
                <Feature key=(FeatureOne)>
                    <Grant player=(Player1) actions="action1" />
                </Feature>
                <Feature key=(FeatureTwo)>
                    <Grant player=(Player1) actions="action2" />
                </Feature>
            </Asset>
        `))
    })

    it('should correctly render nested schema', () => {
        const testWML = deIndentWML(`
            <Asset key=(test)>
                <Room key=(Room1)>
                    <Feature key=(Feature2)>
                        <Grant player=(Player1) actions="action2" />
                    </Feature>
                </Room>
            </Asset>
        `)
        const collection = new StandardAuthorizationCollection(testWML)
        expect(schemaToWML([collection.schema])).toEqual(testWML)
    })

    it('should correctly sort nested schema', () => {
        const collection = new StandardAuthorizationCollection((`
            <Asset key=(test)>
                <Room key=(Room1)>
                    <Feature key=(FeatureTwo)>
                        <Grant player=(Player1) actions="action2" />
                    </Feature>
                    <Feature key=(FeatureOne)>
                        <Grant player=(Player1) actions="action1" />
                    </Feature>
                </Room>
            </Asset>
        `))
        expect(schemaToWML([collection.schema])).toEqual(deIndentWML(`
            <Asset key=(test)>
                <Room key=(Room1)>
                    <Feature key=(FeatureOne)>
                        <Grant player=(Player1) actions="action1" />
                    </Feature>
                    <Feature key=(FeatureTwo)>
                        <Grant player=(Player1) actions="action2" />
                    </Feature>
                </Room>
            </Asset>
        `))
    })

    it('should clone collection', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset key=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        const clone = collection._clone()
        expect(clone).toEqual(collection)
        expect(clone).not.toBe(collection)
        expect(clone._grants).not.toBe(collection._grants)
        expect(clone._grants[0]).not.toBe(collection._grants[0])
    })

    it('should merge collections', () => {
        const baseCollection = new StandardAuthorizationCollection(`
            <Asset key=(TestKey)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        const incomingCollection = new StandardAuthorizationCollection(`
            <Asset key=(TestKey)>
                <Grant player=(Player2) actions="action2" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action3" />
                </Room>  
            </Asset>
        `)
        const mergedCollection = baseCollection.merge(incomingCollection)
        expect(schemaToWML([mergedCollection.schema])).toEqual(deIndentWML(`
            <Asset key=(TestKey)>
                <Grant player=(Player1) actions="action0" />
                <Grant player=(Player2) actions="action2" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1, action3" />
                </Room>
            </Asset>
        `))
    })

    it('should diff collections', () => {
        const baseCollection = new StandardAuthorizationCollection(`
            <Asset key=(TestKey)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        const incomingCollection = new StandardAuthorizationCollection(`
            <Asset key=(TestKey)>
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action2" />
                </Room>  
            </Asset>
        `)
        const diffCollection = baseCollection.diff(incomingCollection)
        expect(schemaToWML([diffCollection.schema])).toEqual(deIndentWML(`
            <Asset key=(TestKey)>
                <Remove><Grant player=(Player1) actions="action0" /></Remove>
                <Room key=(Room1)>
                    <Replace><Grant player=(Player1) actions="action1" /></Replace>
                    <With><Grant player=(Player1) actions="action2" /></With>
                </Room>
            </Asset>
        `))
    })

    it('should rename keys', () => {

        const collection = new StandardAuthorizationCollection(`
            <Asset key=(TestKey)>
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        const renamedCollection = collection.renameKey([{ fromKey: 'Room1', toKey: 'testRoom' }])
        expect(schemaToWML([renamedCollection.schema])).toEqual(deIndentWML(`
            <Asset key=(TestKey)>
                <Room key=(testRoom)><Grant player=(Player1) actions="action1" /></Room>
            </Asset>
        `))
    })
})