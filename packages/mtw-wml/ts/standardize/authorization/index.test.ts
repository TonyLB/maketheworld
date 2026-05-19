import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardAuthorizationCollectionData } from "./components/dataTypes"
import { StandardAuthorizationCollection, StandardAuthorizationCollectionNDJSON } from "./index"
import { StandardAuthorizationResource } from "./resource"
import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import StandardGrant from "./components/grant"

describe('StandardAuthorizationCollection', () => {
    it('should initialize with a string universalKey', () => {
        const collection = new StandardAuthorizationCollection('ASSET#TestKey')
        expect(collection.universalKey).toEqual('ASSET#TestKey')
        expect(collection._grants).toEqual([])
    })

    it('should initialize with StandardAuthorizationCollectionData', () => {
        const data: StandardAuthorizationCollectionData = {
            universalKey: 'ASSET#TestKey',
            grants: [
                {
                    component: { key: 'Room1', tag: 'Room' },
                    grants: []
                }
            ]
        }
        const collection = new StandardAuthorizationCollection(data)
        expect(collection.universalKey).toEqual('ASSET#TestKey')
        expect(collection._grants.length).toEqual(1)
        expect(collection._grants[0]).toBeInstanceOf(StandardAuthorizationResource)
    })

    it('should initialize with GenericTreeNode<SchemaTag>', () => {
        const node: GenericTreeNode<SchemaTag> = {
            data: { tag: 'Asset', uuid: 'ASSET#TestKey', Story: undefined },
            children: []
        }
        const collection = new StandardAuthorizationCollection(node)
        expect(collection.universalKey).toEqual('ASSET#TestKey')
        expect(collection._grants).toEqual([])
    })

    it('should initialize with NDJSON', () => {
        const ndjson: StandardAuthorizationCollectionNDJSON[] = [
            { tag: 'Asset', universalKey: 'ASSET#Test' },
            { component: undefined, grant: { tag: 'Grant', player: 'Player1', actions: ['action0'] } },
            { component: { key: 'Room1', tag: 'Room' }, grant: { tag: 'Grant', player: 'Player1', actions: ['action1'] } },
            { component: { key: 'Room1', tag: 'Room' }, grant: { tag: 'Grant', player: 'Player2', actions: ['action2'] } },
            { component: { key: 'Room2', tag: 'Room' }, grant: { tag: 'Grant', player: 'Player1', actions: ['action3'] } }
        ]
        const collection = new StandardAuthorizationCollection(ndjson)
        expect(collection.toJSON()).toEqual({
            universalKey: 'ASSET#Test',
            grants: [
                {
                    component: undefined,
                    grants: [{
                        tag: 'Grant',
                        player: 'Player1',
                        actions: ['action0']
                    }]
                },
                {
                    component: { key: 'Room1', tag: 'Room' },
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
                    component: { key: 'Room2', tag: 'Room' },
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
            component: { key: 'Room1', tag: 'Room' },
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
        expect(collection.global).toEqual([
            new StandardGrant({
                tag: 'Grant',
                player: 'Player1',
                actions: ['action0']
            })
        ])
    })

    it('should return empty global grants if none exist', () => {
        const collection = new StandardAuthorizationCollection('ASSET#TestKey')
        expect(collection.global).toEqual([])
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
            universalKey: 'ASSET#test',
            grants: [
                {
                    component: undefined,
                    grants: [{
                        tag: 'Grant',
                        player: 'Player1',
                        actions: ['action0']
                    }]
                },
                {
                    component: { key: 'Room1', tag: 'Room' },
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
            { component: undefined, grant: { tag: 'Grant', player: 'Player1', actions: ['action0'] } },
            { component: { key: 'Room1', tag: 'Room' }, grant: { tag: 'Grant', player: 'Player1', actions: ['action1'] } }
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

    it('should round-trip WML with uuid attributes', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(test)>
                <Grant player=(Player1) actions="action0" />
                <Room uuid=(Room1)><Grant player=(Player1) actions="action1" /></Room>
            </Asset>
        `)
        const collection = new StandardAuthorizationCollection(testWML)
        expect(schemaToWML([collection.schema])).toEqual(testWML)
    })

    it('should round-trip JSON with universalKey', () => {
        const originalJSON: StandardAuthorizationCollectionData = {
            universalKey: 'ASSET#test',
            grants: [
                {
                    component: 'ROOM#Room1',
                    grants: [{ tag: 'Grant', player: 'Player1', actions: ['action1'] }]
                }
            ]
        }
        const collection = new StandardAuthorizationCollection(originalJSON)
        expect(collection.toJSON()).toEqual(originalJSON)
    })

    it('should round-trip NDJSON with universalKey', () => {
        const originalNDJSON: StandardAuthorizationCollectionNDJSON[] = [
            { tag: 'Asset', universalKey: 'ASSET#test' },
            { component: 'ROOM#Room1', grant: { tag: 'Grant', player: 'Player1', actions: ['action1'] } }
        ]
        const collection = new StandardAuthorizationCollection(originalNDJSON)
        expect(collection.toNDJSON()).toEqual(originalNDJSON)
    })

    it('should ignore non-authorization content', () => {
        const test = new StandardAuthorizationCollection(`
            <Asset uuid=(Test)>
                <Room key=(test)>
                    <Grant player=(testPlayer) actions="test" />
                    <Situation key=(base)>
                        <Description>
                            One
                            <br />
                        </Description>
                    </Situation>
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

    it('should parse nested WML but output flat schema', () => {
        const inputWML = deIndentWML(`
            <Asset uuid=(test)>
                <Room key=(Room1)>
                    <Feature key=(Feature2)>
                        <Grant player=(Player1) actions="action2" />
                    </Feature>
                </Room>
            </Asset>
        `)
        const collection = new StandardAuthorizationCollection(inputWML)
        // Output is flat - only Feature has grants, so only Feature appears
        expect(schemaToWML([collection.schema])).toEqual(deIndentWML(`
            <Asset uuid=(test)>
                <Feature key=(Feature2)>
                    <Grant player=(Player1) actions="action2" />
                </Feature>
            </Asset>
        `))
    })

    it('should correctly sort flat schema', () => {
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
        // Output is flat and sorted by component key
        expect(schemaToWML([collection.schema])).toEqual(deIndentWML(`
            <Asset uuid=(test)>
                <Feature key=(FeatureOne)>
                    <Grant player=(Player1) actions="action1" />
                </Feature>
                <Feature key=(FeatureTwo)>
                    <Grant player=(Player1) actions="action2" />
                </Feature>
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
        // Flat output with merged grants
        const resultWML = schemaToWML([mergedCollection.schema])
        expect(resultWML).toContain('<Grant player=(Player1) actions="action0" />')
        expect(resultWML).toContain('<Grant player=(Player2) actions="action2" />')
        expect(resultWML).toContain('<Room key=(Room1)>')
        expect(resultWML).toContain('<Grant player=(Player1) actions="action1, action3" />')
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
        // Flat output with diff edits
        const resultWML = schemaToWML([diffCollection.schema])
        expect(resultWML).toContain('<Remove><Grant player=(Player1) actions="action0" /></Remove>')
        expect(resultWML).toContain('<Room key=(Room1)>')
        expect(resultWML).toContain('<Replace><Grant player=(Player1) actions="action1" /></Replace>')
        expect(resultWML).toContain('<With><Grant player=(Player1) actions="action2" /></With>')
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