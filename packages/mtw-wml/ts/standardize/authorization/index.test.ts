import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardAuthorizationCollectionData } from "./components/dataTypes"
import { StandardAuthorizationCollection, StandardAuthorizationCollectionNDJSON } from "./index"
import { StandardAuthorizationResource } from "./resource"
import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"

describe('StandardAuthorizationCollection', () => {
    it('should initialize with a string key', () => {
        const collection = new StandardAuthorizationCollection('ASSET#TestKey')
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
            data: { tag: 'Asset', uuid: 'ASSET#TestKey', Story: undefined },
            children: []
        }
        const collection = new StandardAuthorizationCollection(node)
        expect(collection.key).toEqual('TestKey')
        expect(collection._grants).toEqual([])
    })

    it('should initialize with NDJSON', () => {
        const ndjson: StandardAuthorizationCollectionNDJSON[] = [
            { tag: 'Asset', universalKey: 'ASSET#Test' },
            { referenceStack: [], grant: { tag: 'Grant', player: 'Player1', actions: ['action0'] } },
            { referenceStack: [{ key: 'Room1', tag: 'Room' }], grant: { tag: 'Grant', player: 'Player1', actions: ['action1'] } },
            { referenceStack: [{ key: 'Room1', tag: 'Room' }], grant: { tag: 'Grant', player: 'Player2', actions: ['action2'] } },
            { referenceStack: [{ key: 'Room2', tag: 'Room' }], grant: { tag: 'Grant', player: 'Player1', actions: ['action3'] } }
        ]
        const collection = new StandardAuthorizationCollection(ndjson)
        expect(collection.toJSON()).toEqual({
            key: 'Test',
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
                    referenceStack: [{ key: 'Room1', tag: 'Room' }],
                    grants: [{
                        tag: 'Grant',
                        player: 'Player1',
                        actions: ['action1']
                    }, {
                        tag: 'Grant',
                        player: 'Player2',
                        actions: ['action2']
                    }]
                },
                {
                    referenceStack: [{ key: 'Room2', tag: 'Room' }],
                    grants: [{
                        tag: 'Grant',
                        player: 'Player1',
                        actions: ['action3']
                    }]
                }
            ]
        })
    })

    it('should throw error on invalid arguments', () => {
        expect(() => new StandardAuthorizationCollection(123 as any)).toThrow('Invalid arguments in StandardAuthorization constructor')
    })

    it('should return header', () => {
        const collection = new StandardAuthorizationCollection('ASSET#TestKey')
        expect(collection.header).toEqual({
            tag: 'Asset',
            universalKey: 'ASSET#TestKey'
        })
    })

    it('should return byId', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset uuid=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        expect(Object.keys(collection.byId)).toEqual(['Room1'])
        expect(collection.byId["Room1"].toJSON()).toEqual({
            referenceStack: [{ key: 'Room1', tag: 'Room' }],
            grants: [{
                tag: 'Grant',
                player: 'Player1',
                actions: ['action1']
            }]
        })
    })

    it('should return global resource', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset uuid=(test)>
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
        const collection = new StandardAuthorizationCollection('ASSET#TestKey')
        expect(collection.global).toBeInstanceOf(StandardAuthorizationResource)
        expect(collection.global.referenceStack).toEqual([])
        expect(collection.global.grants).toEqual([])
    })

    it('should return JSON representation', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset uuid=(test)>
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
                    referenceStack: [{ key: 'Room1', tag: 'Room' }],
                    grants: [{
                        tag: 'Grant',
                        player: 'Player1',
                        actions: ['action1']
                    }]
                }
            ]
        })
    })

    it('should return NDJSON representation', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset uuid=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        expect(collection.toNDJSON()).toEqual([
            { tag: 'Asset', universalKey: 'ASSET#test' },
            { referenceStack: [], grant: { tag: 'Grant', player: 'Player1', actions: ['action0'] } },
            { referenceStack: [{ key: 'Room1', tag: 'Room' }], grant: { tag: 'Grant', player: 'Player1', actions: ['action1'] } }
        ])
    })

    it('should return schema', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)><Grant player=(Player1) actions="action1" /></Room>
            </Asset>
        `)
        const collection = new StandardAuthorizationCollection(testWML)
        expect(schemaToWML([collection.schema])).toEqual(testWML)
    })

    it('should ignore non-authorization content', () => {
        const test = new StandardAuthorizationCollection(`
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Grant player=(testPlayer) actions="test" />
                    <Example key=(base)>
                        <Description>
                            One
                            <br />
                        </Description>
                    </Example>
                </Room>
            </Asset>
        `)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(test)><Grant player=(testPlayer) actions="test" /></Room>
            </Asset>
        `))
    })

    it('should sort schema appropriately', () => {
        const collection = new StandardAuthorizationCollection(`
            <Asset uuid=(test)>
                <Feature key=(FeatureTwo)><Grant player=(Player1) actions="action2" /></Feature>
                <Room key=(Room1)><Grant player=(Player1) actions="action3" /></Room>
                <Feature key=(FeatureOne)><Grant player=(Player1) actions="action1" /></Feature>
            </Asset>
        `)
        expect(schemaToWML([collection.schema])).toEqual(deIndentWML(`
            <Asset uuid=(test)>
                <Feature key=(FeatureOne)>
                    <Grant player=(Player1) actions="action1" />
                </Feature>
                <Feature key=(FeatureTwo)>
                    <Grant player=(Player1) actions="action2" />
                </Feature>
                <Room key=(Room1)><Grant player=(Player1) actions="action3" /></Room>
            </Asset>
        `))
    })

    it('should correctly render nested schema', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(test)>
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
            <Asset uuid=(test)>
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
            <Asset uuid=(test)>
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
            <Asset uuid=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        const clone = collection._clone()
        expect(schemaToWML([clone.schema])).toEqual(schemaToWML([collection.schema]))
        expect(clone).not.toBe(collection)
        expect(clone._grants).not.toBe(collection._grants)
        expect(clone._grants[0]).not.toBe(collection._grants[0])
    })

    it('should merge collections', () => {
        const baseCollection = new StandardAuthorizationCollection(`
            <Asset uuid=(TestKey)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        const incomingCollection = new StandardAuthorizationCollection(`
            <Asset uuid=(TestKey)>
                <Grant player=(Player2) actions="action2" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action3" />
                </Room>  
            </Asset>
        `)
        const mergedCollection = baseCollection.merge(incomingCollection)
        expect(schemaToWML([mergedCollection.schema])).toEqual(deIndentWML(`
            <Asset uuid=(TestKey)>
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
            <Asset uuid=(TestKey)>
                <Grant player=(Player1) actions="action0" />
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        const incomingCollection = new StandardAuthorizationCollection(`
            <Asset uuid=(TestKey)>
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action2" />
                </Room>  
            </Asset>
        `)
        const diffCollection = baseCollection.diff(incomingCollection)
        expect(schemaToWML([diffCollection.schema])).toEqual(deIndentWML(`
            <Asset uuid=(TestKey)>
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
            <Asset uuid=(TestKey)>
                <Room key=(Room1)>
                    <Grant player=(Player1) actions="action1" />
                </Room>
            </Asset>
        `)
        const renamedCollection = collection.renameKey([{ fromKey: 'Room1', toKey: 'testRoom' }])
        expect(schemaToWML([renamedCollection.schema])).toEqual(deIndentWML(`
            <Asset uuid=(TestKey)>
                <Room key=(testRoom)><Grant player=(Player1) actions="action1" /></Room>
            </Asset>
        `))
    })
})