import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardRoomData } from "./dataTypes/room"
import StandardRoom from './room'
import { mergeTest } from "./utils/testing"
import StandardReference, { StandardKey } from "./reference"

describe('StandardRoom class', () => {

    it('should construct StandardRoom from WML', () => {
        const testSource = deIndentWML(`
            <Room uuid=(123) key=(test)>
                <ShortName>ShortName Test</ShortName>
                <Feature key=(testFeature) />
                <Example key=(base) />
                <Exit to=(testTwo)>Exit test</Exit>
            </Room>
        `)
        const testRoom = new StandardRoom(testSource)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.features.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature' }])
        expect(testRoom.shortName?.schema).toEqual([{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }])
        expect(testRoom.exits.map((exit) => (exit.toJSON()))).toEqual([{ to: { key: 'testTwo', tag: 'Room' }, description: 'Exit test' }])
        expect(testRoom.universalKey).toEqual('ROOM#123')
        expect(schemaToWML([testRoom.schema])).toEqual(testSource)
    })

    it('should construct StandardRoom from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Room uuid=(123) key=(test)>
                <ShortName>ShortName Test</ShortName>
                <Feature key=(testFeature) />
                <Example uuid=(base) />
                <Exit to=(testTwo)>Exit test</Exit>
            </Room>
        `)
        schema.loadWML(testSource)
        const testRoom = new StandardRoom(schema.schema[0])
        expect(testRoom.key).toEqual('test')
        expect(testRoom.features.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature'}])
        expect(testRoom.examples.toJSON()).toEqual(['EXAMPLE#base'])
        expect(testRoom.shortName?.schema).toEqual([{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }])
        expect(testRoom.exits.map((exit) => (exit.toJSON()))).toEqual([{ to: { key: 'testTwo', tag: 'Room' }, description: 'Exit test' }])
        expect(testRoom.universalKey).toEqual('ROOM#123')
        expect(schemaToWML([testRoom.schema])).toEqual(testSource)
    })

    it('should ignore Position tags', () => {
        const testSource = deIndentWML(`
            <Room key=(test)>
                <Position x="0" y="100" />
            </Room>
        `)
        const testRoom = new StandardRoom(testSource)
        expect(testRoom.key).toEqual('test')
        expect(schemaToWML([testRoom.schema])).toEqual(deIndentWML(`
            <Room key=(test) />
        `))
    })

    it('should construct StandardRoom from StandardRoomData', () => {
        const testRoomData: StandardRoomData = {
            key: 'test',
            tag: 'Room',
            shortName: 'ShortName Test',
            exits: [{ to: { key: 'testTwo', tag: 'Room' }, description: 'Exit test' }],
            features: [{ tag: 'Feature', key: 'testFeature' }]
        }
        const testRoom = new StandardRoom(testRoomData)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.features.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature' }])
        expect(testRoom.shortName?.toJSON()).toEqual('ShortName Test')
        expect(testRoom.exits.map((exit) => exit.toJSON())).toEqual([{ to: { key: 'testTwo', tag: 'Room' }, description: 'Exit test' }])
        expect(testRoom.toJSON()).toEqual(testRoomData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Room key=(testRoomOne)>
                <Example key=(base)>
                    <Name>Lobby</Name>
                    <Description>A plain lobby.</Description>
                </Example>
            </Room>`,
            StandardRoom,
            `<Room key=(testRoomOne)>
                <Feature key=(testFeature) />
                <Example key=(base)>
                    <Replace><Name>Lobby</Name></Replace><With><Name>Spooky Lobby</Name></With>
                    <Description><Space />Shadows cling to the corners of the room.</Description>
                </Example>
            </Room>`
        )).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature key=(testFeature) />
                <Example key=(base) />
            </Room>
        `))
    })

    it('should correctly parse exits with universalKey targets', () => {
        const test = new StandardRoom(`
            <Room key=(testRoomOne)>
                <Exit to=(ROOM#testRoomTwo)>exit</Exit>
            </Room>
        `)
        expect(test.exits.map((exit) => (exit.toJSON()))).toEqual([{ to: 'ROOM#testRoomTwo', description: 'exit' }])
        expect(test.referencedKeys().map(({ key, ...rest }) => ({ key: key.toJSON(), ...rest }))).toEqual([{ key: 'ROOM#testRoomTwo', referenceType: 'Exit' }])
    })

    // it('should map contents on exits correctly', () => {
    //     const test = new StandardRoom(`
    //         <Room key=(testRoomOne)>
    //             <Example key=(base)>
    //                 <Name>Lobby</Name>
    //                 <Summary>A lobby</Summary>
    //                 <Description>A plain lobby.</Description>
    //             </Example>
    //             <Exit to=(testRoomTwo)>exit</Exit>
    //         </Room>
    //     `)
    //     const callback = (tree) => {
    //         return tree.map((node) => {
    //             if (treeNodeTypeguard(isSchemaExit)(node)) {
    //                 return {
    //                     ...node,
    //                     children: [...node.children, { data: { tag: 'String', value: 'Narf!' }, children: [] }]
    //                 }
    //             }
    //             else {
    //                 return {
    //                     ...node,
    //                     children: callback(node.children)
    //                 }
    //             }
    //         })
    //     }
    //     expect(schemaToWML([test.mapContents(callback).schema])).toEqual(deIndentWML(`
    //         <Room key=(testRoomOne)>
    //             <Example key=(base) />
    //             <Exit to=(testRoomTwo)>
    //                 exit
    //                 Narf!
    //             </Exit>
    //         </Room>
    //     `))
    // })

    it('should map references to universal keys correctly', () => {
        const test = new StandardRoom(`
            <Room uuid=(Room1) key=(testRoomOne)>
                <Example uuid=(Example1) key=(base) />
                <Exit to=(testRoomTwo)>exit</Exit>
            </Room>
        `)
        const remapped = test.withMapping([
            new StandardKey({ universalKey: 'ROOM#Room1', tag: 'Room', key: 'testRoomOne'}),
            new StandardKey({ universalKey: 'EXAMPLE#Example1', tag: 'Example', key: 'base', context: ['ROOM#Room1'] }),
            new StandardKey({ universalKey: 'ROOM#testRoomTwo', tag: 'Room', key: 'testRoomTwo' })
        ]).remapReferences('universal')
        expect(schemaToWML([remapped.schema])).toEqual(deIndentWML(`
            <Room uuid=(Room1) key=(testRoomOne)>
                <Example uuid=(Example1) />
                <Exit to=(ROOM#testRoomTwo)>exit</Exit>
            </Room>
        `))
    })

    it('should map references to local keys correctly', () => {
        const test = new StandardRoom(`
            <Room key=(testRoomOne)>
                <Example uuid=(Example1) />
                <Feature uuid=(Feature1) />
            </Room>
        `)
        expect(schemaToWML([
            test.withMapping([
                new StandardKey({ universalKey: 'ROOM#Room1', tag: 'Room', key: 'testRoomOne' }),
                new StandardKey({ universalKey: 'EXAMPLE#Example1', tag: 'Example', key: 'base' }),
                new StandardKey({ universalKey: 'FEATURE#Feature1', tag: 'Feature', key: 'featureOne' })
            ]).remapReferences('key').schema
        ])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature key=(featureOne) />
                <Example key=(base) />
            </Room>
        `))
    })

    it('should correctly add a feature reference to a room', () => {
        const test = new StandardRoom(`
            <Room key=(testRoomOne)>
                <Example uuid=(Example1) />
                <Feature uuid=(Feature1) />
            </Room>
        `)
        const feature = new StandardKey({ tag: 'Feature', key: 'featureTwo' })
        const added = test.withChild(new StandardReference(feature))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature uuid=(Feature1) />
                <Feature key=(featureTwo) />
                <Example uuid=(Example1) />
            </Room>
        `))
    })

    it('should correctly add an example reference to a room', () => {
        const test = new StandardRoom(`
            <Room key=(testRoomOne)>
                <Example uuid=(Example1) />
                <Feature uuid=(Feature1) />
            </Room>
        `)
        const example = new StandardKey("EXAMPLE#Example2")
        const added = test.withChild(new StandardReference(example))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature uuid=(Feature1) />
                <Example uuid=(Example1) />
                <Example uuid=(Example2) />
            </Room>
        `))
    })

})