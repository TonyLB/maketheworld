import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardRoomData } from "./dataTypes/room"
import StandardRoom from './room'
import { mergeTest } from "./utils/testing"
import StandardReference, { StandardKey } from "./reference"
import { StandardExplicitParent } from "../explicit"
import { StandardRemove, StandardReplace } from "./edits"

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

    it('should construct StandardRoom from StandardRoomData with missing exits', () => {
        const testRoomDataWithoutExits: StandardRoomData = {
            key: 'test',
            tag: 'Room',
            shortName: 'ShortName Test',
            // exits property is missing - this should not crash
            features: [{ tag: 'Feature', key: 'testFeature' }]
        }
        const testRoom = new StandardRoom(testRoomDataWithoutExits)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.features.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature' }])
        expect(testRoom.shortName?.toJSON()).toEqual('ShortName Test')
        expect(testRoom.exits).toEqual([])  // Should default to empty array
        
        // The JSON output should omit exits when empty (omission-over-empty pattern)
        const outputJSON = testRoom.toJSON() as StandardRoomData
        expect(outputJSON.exits).toBeUndefined()
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

    it('should correctly add a character reference to a room', () => {
        const test = new StandardRoom(`
            <Room key=(testRoomOne)>
                <Example uuid=(Example1) />
                <Feature uuid=(Feature1) />
            </Room>
        `)
        const character = new StandardKey("CHARACTER#Character1")
        const added = test.withChild(new StandardReference(character))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature uuid=(Feature1) />
                <Example uuid=(Example1) />
                <Character uuid=(Character1) />
            </Room>
        `))
    })

    // Phase 5: Comprehensive Character Integration Tests

    describe('Character Integration', () => {

        it('should construct StandardRoom from JSON with characters property', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: 'testRoom',
                exits: [],
                characters: [
                    { tag: 'Character', key: 'char1' },
                    { tag: 'Character', universalKey: 'CHARACTER#uuid123' }
                ]
            }
            const room = new StandardRoom(roomData)
            expect(room.characters.payload.length).toBe(2)
            expect(room.characters.toJSON()).toEqual([
                { tag: 'Character', key: 'char1' },
                'CHARACTER#uuid123' // Universal key only returns string
            ])
        })

        it('should construct StandardRoom from WML with Character sub-components', () => {
            const testSource = deIndentWML(`
                <Room key=(testRoom)>
                    <Character key=(char1)>
                        <Name>Character One</Name>
                    </Character>
                    <Character uuid=(CHARACTER#uuid123)>
                        <Name>Character Two</Name>
                    </Character>
                </Room>
            `)
            const room = new StandardRoom(testSource)
            expect(room.characters.payload.length).toBe(2)
            expect(room.characters.payload[0]._payload.plain.key).toBe('char1')
            expect(room.characters.payload[1]._payload.plain.universalKey).toBe('CHARACTER#uuid123')
        })

        it('should serialize characters to JSON correctly', () => {
            const room = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                    <Character uuid=(CHARACTER#uuid123) />
                </Room>
            `)
            const json = room.toJSON() as StandardRoomData
            expect(json.characters).toEqual([
                { tag: 'Character', key: 'char1' },
                'CHARACTER#uuid123' // Universal key only returns string
            ])
        })

        it('should include characters in schema output', () => {
            const room = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                    <Character uuid=(CHARACTER#uuid123) />
                </Room>
            `)
            const schemaOutput = schemaToWML([room.schema])
            expect(schemaOutput).toContain('<Character key=(char1) />')
            expect(schemaOutput).toContain('<Character uuid=(uuid123) />') // Schema uses just the UUID part
        })

        it('should merge character references correctly', () => {
            const room1 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                </Room>
            `)
            const room2 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char2) />
                </Room>
            `)
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.characters.payload.length).toBe(2)
            expect(merged.characters.payload.map(ref => ref._payload.plain.key)).toContain('char1')
            expect(merged.characters.payload.map(ref => ref._payload.plain.key)).toContain('char2')
        })

        it('should detect character differences in diff operation', () => {
            const room1 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                </Room>
            `)
            const room2 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char2) />
                </Room>
            `)
            const diff = room1.diff(room2) as StandardRoom
            expect(diff).toBeDefined()
            expect(diff!.characters.payload.length).toBeGreaterThan(0)
        })

        it('should return undefined diff when characters are identical', () => {
            const room1 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                </Room>
            `)
            const room2 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                </Room>
            `)
            const diff = room1.diff(room2)
            expect(diff).toBeUndefined()
        })

        it('should compare character references correctly in equals method', () => {
            const room1 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                </Room>
            `)
            const room2 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                </Room>
            `)
            const room3 = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char2) />
                </Room>
            `)
            expect(room1.equals(room2)).toBe(true)
            expect(room1.equals(room3)).toBe(false)
        })

        it('should include characters in referencedKeys', () => {
            const room = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                    <Character uuid=(CHARACTER#uuid123) />
                    <Feature key=(feat1) />
                </Room>
            `)
            const referencedKeys = room.referencedKeys()
            const characterKeys = referencedKeys.filter(ref => ref.key.tag === 'Character')
            expect(characterKeys.length).toBe(2)
            expect(characterKeys.some(ref => ref.key.key === 'char1')).toBe(true)
            expect(characterKeys.some(ref => ref.key.universalKey === 'CHARACTER#uuid123')).toBe(true)
            expect(characterKeys.every(ref => ref.referenceType === 'Direct')).toBe(true)
        })

        it('should provide access to characters via getter', () => {
            const room = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                    <Character key=(char2) />
                </Room>
            `)
            expect(room.characters.payload.length).toBe(2)
            expect(room.characters.payload[0]._payload.plain.key).toBe('char1')
            expect(room.characters.payload[1]._payload.plain.key).toBe('char2')
        })

        it('should handle empty character lists correctly', () => {
            const room = new StandardRoom(`<Room key=(testRoom) />`)
            expect(room.characters.payload.length).toBe(0)
            expect(room.characters.toJSON()).toEqual([])
            
            const json = room.toJSON() as StandardRoomData
            expect(json.characters).toBeUndefined() // Empty lists are not serialized (omission-over-empty pattern)
        })

    })

    describe('explicitParent', () => {
        it('should construct StandardRoom from WML with Parent tag', () => {
            const testSource = deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                    <ShortName>Test Room</ShortName>
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            expect(testRoom.key).toEqual('testRoom')
            expect(testRoom.explicitParent).toBeDefined()
            expect(testRoom.explicitParent?.toJSON()).toBe('ROOM#parent-room')
        })

        it('should construct StandardRoom from schema with Parent tag', () => {
            const schema = new Schema()
            const testSource = deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>MAP#parent-map</Parent>
                </Room>
            `)
            schema.loadWML(testSource)
            const testRoom = new StandardRoom(schema.schema[0])
            expect(testRoom.key).toEqual('testRoom')
            expect(testRoom.explicitParent).toBeDefined()
            expect(testRoom.explicitParent?.toJSON()).toBe('MAP#parent-map')
        })

        it('should handle empty Parent tag (no parent)', () => {
            const testSource = deIndentWML(`
                <Room key=(testRoom)>
                    <Parent />
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            expect(testRoom.key).toEqual('testRoom')
            expect(testRoom.explicitParent).toBeDefined()
            expect(testRoom.explicitParent?.toJSON()).toBeUndefined()
        })

        it('should clone explicitParent correctly', () => {
            const testRoom = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const cloned = testRoom.clone() as StandardRoom
            expect(cloned.explicitParent).toBeDefined()
            expect(cloned.explicitParent?.toJSON()).toBe('ROOM#parent-room')
            // Should be a new instance, not the same reference
            expect(cloned.explicitParent).not.toBe(testRoom.explicitParent)
        })

        it('should merge explicitParent correctly when both have same parent', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.explicitParent).toBeDefined()
            expect(merged.explicitParent?.toJSON()).toBe('ROOM#parent-room')
        })

        it('should merge explicitParent correctly when replacing parent', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#old-parent</Parent>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#new-parent</Parent>
                </Room>
            `))
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.explicitParent).toBeDefined()
            expect(merged.explicitParent?.toJSON()).toBe('ROOM#new-parent')
        })

        it('should merge explicitParent when only one has parent', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom) />
            `))
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.explicitParent).toBeDefined()
            expect(merged.explicitParent?.toJSON()).toBe('ROOM#parent-room')
        })

        it('should merge when incoming has parent and base does not', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom) />
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.explicitParent).toBeDefined()
            expect(merged.explicitParent?.toJSON()).toBe('ROOM#parent-room')
        })

        it('should include Parent tag in schema output', () => {
            const testRoom = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const schemaOutput = schemaToWML([testRoom.schema])
            expect(schemaOutput).toContain('<Parent>ROOM#parent-room</Parent>')
        })

        it('should include empty Parent tag in schema when explicitParent is empty', () => {
            const testRoom = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent />
                </Room>
            `))
            const schemaOutput = schemaToWML([testRoom.schema])
            expect(schemaOutput).toContain('<Parent />')
        })

        it('should not include Parent tag in schema when explicitParent is undefined', () => {
            const testRoom = new StandardRoom(deIndentWML(`
                <Room key=(testRoom) />
            `))
            const schemaOutput = schemaToWML([testRoom.schema])
            expect(schemaOutput).not.toContain('<Parent')
        })

        it('should set explicitParent programmatically', () => {
            const testRoom = new StandardRoom(deIndentWML(`
                <Room key=(testRoom) />
            `))
            const parent = new StandardExplicitParent('ROOM#parent-room')
            const withParent = testRoom.clone() as StandardRoom
            withParent.explicitParent = parent
            expect(withParent.explicitParent?.toJSON()).toBe('ROOM#parent-room')
        })

        it('should handle explicitParent with AssetUUID', () => {
            const testRoom = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ASSET#parent-asset</Parent>
                </Room>
            `))
            expect(testRoom.explicitParent).toBeDefined()
            expect(testRoom.explicitParent?.toJSON()).toBe('ASSET#parent-asset')
        })

        it('should diff explicitParent correctly', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#old-parent</Parent>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#new-parent</Parent>
                </Room>
            `))
            const diff = room1.diff(room2) as StandardRoom
            expect(diff).toBeDefined()
            // The diff should show the parent change
            expect(diff!.explicitParent).toBeDefined()
        })

        it('should return undefined diff when explicitParent is identical', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const diff = room1.diff(room2)
            expect(diff).toBeUndefined()
        })

        it('should handle explicitParent in Remove operations', () => {
            const room = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `))
            const remove = new StandardRemove(room)
            expect(remove.explicitParent).toBeDefined()
            expect(remove.explicitParent?.toJSON()).toBe('ROOM#parent-room')
        })

        it('should handle explicitParent in Replace operations', () => {
            const match = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#old-parent</Parent>
                </Room>
            `))
            const payload = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#new-parent</Parent>
                </Room>
            `))
            const replace = new StandardReplace(match, payload)
            // Should use explicitParent from match if available, otherwise from payload
            expect(replace.explicitParent).toBeDefined()
            expect(replace.explicitParent?.toJSON()).toBe('ROOM#old-parent')
        })
    })

})