import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardRoomData } from "./dataTypes/room"
import StandardRoom from './room'
import { mergeTest } from "./utils/testing"
import StandardReference, { StandardKey } from "./reference"
import { StandardExplicitParent } from "../explicit"

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
        expect(testRoom.exits.map((exit) => (exit.toJSON()))).toEqual([{ to: { key: 'testTwo' }, description: 'Exit test' }])
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
        expect(testRoom.exits.map((exit) => (exit.toJSON()))).toEqual([{ to: { key: 'testTwo' }, description: 'Exit test' }])
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
            exits: [{ to: { key: 'testTwo' }, description: 'Exit test' }],
            features: [{ tag: 'Feature', key: 'testFeature' }]
        }
        const testRoom = new StandardRoom(testRoomData)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.features.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature' }])
        expect(testRoom.shortName?.toJSON()).toEqual('ShortName Test')
        expect(testRoom.exits.map((exit) => exit.toJSON())).toEqual([{ to: { key: 'testTwo' }, description: 'Exit test' }])
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

    it('should correctly render a removed example reference', () => {
        const test = new StandardRoom(`
            <Room key=(testRoomOne)>
                <Remove><Example key=(base) /></Remove>
            </Room>
        `)

        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)><Remove><Example key=(base) /></Remove></Room>
        `))
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
            `<Room key=(testRoomOne) ref={0}>
                <Feature key=(testFeature) />
                <Example key=(base) ref={0}>
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
            new StandardKey({ universalKey: 'ROOM#Room1', key: 'testRoomOne'}),
            new StandardKey({ universalKey: 'EXAMPLE#Example1', key: 'base' }),
            new StandardKey({ universalKey: 'ROOM#testRoomTwo', key: 'testRoomTwo' })
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
        const feature = new StandardKey({ key: 'featureTwo' })
        const added = test.withChild(new StandardReference(feature, 'Feature'))
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
                    'CHARACTER#uuid123'
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
            expect(room.characters.payload[0].key).toBe('char1')
            expect(room.characters.payload[1].universalKey).toBe('CHARACTER#uuid123')
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
            expect(merged.characters.payload.map(ref => ref.key)).toContain('char1')
            expect(merged.characters.payload.map(ref => ref.key)).toContain('char2')
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
            expect(referencedKeys.map((ref) => ref.key.toJSON())).toEqual([{ key: 'feat1' }, { key: 'char1' }, 'CHARACTER#uuid123'])
        })

        it('should include Features from Remove tags in referencedKeys', () => {
            const room = new StandardRoom(`
                <Room key=(testRoom)>
                    <Remove>
                        <Feature key=(removedFeature) />
                    </Remove>
                </Room>
            `)
            const referencedKeys = room.referencedKeys()
            const featureKeys = referencedKeys
                .filter((ref) => ref.referenceType === 'Direct')
                .map((ref) => ref.key.toJSON())
            
            expect(featureKeys).toContainEqual({ key: 'removedFeature' })
        })

        it('should provide access to characters via getter', () => {
            const room = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                    <Character key=(char2) />
                </Room>
            `)
            expect(room.characters.payload.length).toBe(2)
            expect(room.characters.payload[0].key).toBe('char1')
            expect(room.characters.payload[1].key).toBe('char2')
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

        it('should handle empty Parent tag (explicitly asset level)', () => {
            const testSource = deIndentWML(`
                <Room key=(testRoom)>
                    <Parent />
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            expect(testRoom.key).toEqual('testRoom')
            expect(testRoom.explicitParent).toBeDefined()
            expect(testRoom.explicitParent?.toJSON()).toBe('ASSET')
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

        it('should throw error when merging explicitParent with conflicting parent values', () => {
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
            expect(() => room1.merge(room2)).toThrow('Parent values can only be merged if they match exactly')
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

        it('should handle explicitParent with empty Parent tag (explicitly asset level)', () => {
            const testRoom = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent />
                </Room>
            `))
            expect(testRoom.explicitParent).toBeDefined()
            expect(testRoom.explicitParent?.toJSON()).toBe('ASSET')
        })

        it('should diff explicitParent correctly', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room uuid=(ROOM#test-room)>
                    <Parent>ROOM#old-parent</Parent>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room uuid=(ROOM#test-room)>
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


        it('should accept legalKey format in Parent tag', () => {
            const testSource = deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>parentRoom</Parent>
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            expect(testRoom.explicitParent).toBeDefined()
            const parentJSON = testRoom.explicitParent?.toJSON()
            // Should return StandardKeyData object with key property
            expect(parentJSON).toEqual({ key: 'parentRoom' })
        })

        it('should accept ComponentUUID format in Parent tag', () => {
            const testSource = deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>ROOM#parent-room</Parent>
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            expect(testRoom.explicitParent).toBeDefined()
            // ComponentUUID format should return string for backward compatibility
            expect(testRoom.explicitParent?.toJSON()).toBe('ROOM#parent-room')
        })

        it('should merge explicitParent correctly with legalKey format', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>parentRoom</Parent>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>parentRoom</Parent>
                </Room>
            `))
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.explicitParent).toBeDefined()
            expect(merged.explicitParent?.toJSON()).toEqual({ key: 'parentRoom' })
        })

        it('should generate schema correctly for legalKey format', () => {
            const testRoom = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <Parent>parentRoom</Parent>
                </Room>
            `))
            const schemaOutput = schemaToWML([testRoom.schema])
            expect(schemaOutput).toContain('<Parent>parentRoom</Parent>')
        })
    })

    describe('invert method', () => {
        it('should invert a room with shortName, exits, and reference lists', () => {
            const roomData: StandardRoomData = {
                key: 'test',
                tag: 'Room',
                shortName: 'Test Room',
                exits: [{ to: { key: 'target' }, description: 'Exit description' }],
                features: [{ tag: 'Feature', key: 'feat1' }],
                examples: [{ tag: 'Example', key: 'ex1' }],
                characters: [{ tag: 'Character', key: 'char1' }]
            }
            const room = new StandardRoom(roomData)
            const inverted = room._payload.invert()
            
            // All fields should be inverted (Add → Remove)
            expect(schemaToWML([inverted.schema('test')])).toEqual(deIndentWML(`
                <Room key=(test)>
                    <Remove><ShortName>Test Room</ShortName></Remove>
                    <Remove><Feature key=(feat1) /></Remove>
                    <Remove><Example key=(ex1) /></Remove>
                    <Remove><Character key=(char1) /></Remove>
                    <Remove><Exit to=(target)>Exit description</Exit></Remove>
                </Room>
            `))
        })

        it('should invert a room with removed references', () => {
            const roomWithRemoves = new StandardRoom(deIndentWML(`
                <Room key=(test)>
                    <ShortName>Test</ShortName>
                    <Remove><Feature key=(feat1) /></Remove>
                    <Remove><Example key=(ex1) /></Remove>
                </Room>
            `))
            const inverted = roomWithRemoves._payload.invert()
            
            // Inverted room: ShortName becomes Remove, removed references become added
            expect(schemaToWML([inverted.schema('test')])).toEqual(deIndentWML(`
                <Room key=(test)>
                    <Remove><ShortName>Test</ShortName></Remove>
                    <Feature key=(feat1) />
                    <Example key=(ex1) />
                </Room>
            `))
        })

        it('should satisfy double-inversion property (invert.invert returns equivalent)', () => {
            const roomData: StandardRoomData = {
                key: 'test',
                tag: 'Room',
                shortName: 'Test Room',
                exits: [{ to: { key: 'target' }, description: 'Exit' }],
                features: [{ tag: 'Feature', key: 'feat1' }],
                examples: [{ tag: 'Remove', match: { tag: 'Example', key: 'ex1' } }]
            }
            const room = new StandardRoom(roomData)
            const doubleInverted = room._payload.invert().invert()
            
            // Double inversion should return to original (within merge equivalence)
            // We compare JSON output since the objects may not be strictly equal
            expect(doubleInverted.shortName?.toJSON()).toEqual(room._payload.shortName?.toJSON())
            expect(doubleInverted.exits.map(e => e.toJSON())).toEqual(room._payload.exits.map(e => e.toJSON()))
            expect(doubleInverted.features.toJSON()).toEqual(room._payload.features.toJSON())
            expect(doubleInverted.examples.toJSON()).toEqual(room._payload.examples.toJSON())
        })

        it('should invert an empty room', () => {
            const emptyRoom = new StandardRoom(deIndentWML(`<Room key=(test) />`))
            const inverted = emptyRoom._payload.invert()
            
            expect(inverted.shortName).toBeUndefined()
            expect(inverted.exits).toEqual([])
            expect(inverted.features.toJSON()).toEqual([])
            expect(inverted.examples.toJSON()).toEqual([])
            expect(inverted.characters.toJSON()).toEqual([])
        })

        it('should invert only the fields that are present', () => {
            const roomWithOnlyFeatures = new StandardRoom(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                </Room>
            `))
            const inverted = roomWithOnlyFeatures._payload.invert()
            
            expect(inverted.shortName).toBeUndefined()
            expect(inverted.exits).toEqual([])
            expect(inverted.features.toJSON()).toEqual([{ tag: 'Feature', key: 'feat1', ref: -1 }])
            expect(inverted.examples.toJSON()).toEqual([])
            expect(inverted.characters.toJSON()).toEqual([])
        })
    })

    describe('assureReferences method', () => {
        it('should return unchanged room when children array is empty', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const result = room._payload.assureReferences([])
            
            expect(result.features.payload.length).toBe(0)
            expect(result.examples.payload.length).toBe(0)
            expect(result.characters.payload.length).toBe(0)
            // Verify it's a clone (original unchanged)
            expect(room._payload.features.payload.length).toBe(0)
        })
        
        it('should add children with ref={0} when they do not exist', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            const charRef = new StandardReference({ tag: 'Character', key: 'char1' })
            
            const result = room._payload.assureReferences([featureRef, exampleRef, charRef])
            
            // Verify references were added with ref={0}
            expect(result.features.payload.length).toBe(1)
            expect(result.features.payload[0].ref).toBe(0)
            expect(result.features.payload[0].sameKey(featureRef)).toBe(true)
            
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].ref).toBe(0)
            expect(result.examples.payload[0].sameKey(exampleRef)).toBe(true)
            
            expect(result.characters.payload.length).toBe(1)
            expect(result.characters.payload[0].ref).toBe(0)
            expect(result.characters.payload[0].sameKey(charRef)).toBe(true)
        })
        
        it('should leave existing references with non-zero ref unchanged', () => {
            const room = new StandardRoom(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                    <Example key=(ex1) ref={2} />
                </Room>
            `))
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1', ref: 2 })
            
            const result = room._payload.assureReferences([featureRef, exampleRef])
            
            // Verify existing references were left unchanged
            expect(result.features.payload.length).toBe(1)
            expect(result.features.payload[0].ref).toBe(1) // Original ref value (default)
            
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].ref).toBe(2) // Original ref value
        })
        
        it('should handle mixed scenarios (some exist, some do not)', () => {
            const room = new StandardRoom(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(existingFeat) />
                </Room>
            `))
            const existingFeature = new StandardReference({ tag: 'Feature', key: 'existingFeat' })
            const newFeature = new StandardReference({ tag: 'Feature', key: 'newFeat' })
            const newExample = new StandardReference({ tag: 'Example', key: 'newEx' })
            
            const result = room._payload.assureReferences([existingFeature, newFeature, newExample])
            
            // Existing feature should be unchanged
            expect(result.features.payload.length).toBe(2)
            const existingFeatInResult = result.features.payload.find(ref => ref.sameKey(existingFeature))
            expect(existingFeatInResult?.ref).toBe(1) // Original ref value
            
            // New feature should be added with ref={0}
            const newFeatInResult = result.features.payload.find(ref => ref.sameKey(newFeature))
            expect(newFeatInResult?.ref).toBe(0)
            
            // New example should be added with ref={0}
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].ref).toBe(0)
            expect(result.examples.payload[0].sameKey(newExample)).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const originalFeaturesLength = room._payload.features.payload.length
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            
            const result = room._payload.assureReferences([featureRef])
            
            // Original should be unchanged
            expect(room._payload.features.payload.length).toBe(originalFeaturesLength)
            // Result should have the new reference
            expect(result.features.payload.length).toBe(1)
            // They should be different objects
            expect(result).not.toBe(room._payload)
        })
        
        it('should be idempotent (calling multiple times with same children produces same result)', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const firstCall = room._payload.assureReferences([featureRef, exampleRef])
            const secondCall = firstCall.assureReferences([featureRef, exampleRef])
            
            // Both calls should produce the same result
            expect(firstCall.features.payload.length).toBe(1)
            expect(secondCall.features.payload.length).toBe(1)
            expect(firstCall.features.payload[0].sameKey(secondCall.features.payload[0])).toBe(true)
            expect(firstCall.features.payload[0].ref).toBe(0)
            expect(secondCall.features.payload[0].ref).toBe(0)
            
            expect(firstCall.examples.payload.length).toBe(1)
            expect(secondCall.examples.payload.length).toBe(1)
            expect(firstCall.examples.payload[0].sameKey(secondCall.examples.payload[0])).toBe(true)
            expect(firstCall.examples.payload[0].ref).toBe(0)
            expect(secondCall.examples.payload[0].ref).toBe(0)
        })
        
        it('should dispatch children to correct buckets based on tag', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            const charRef = new StandardReference({ tag: 'Character', key: 'char1' })
            
            const result = room._payload.assureReferences([featureRef, exampleRef, charRef])
            
            // Verify each reference went to the correct bucket
            expect(result.features.payload.length).toBe(1)
            expect(result.features.payload[0].sameKey(featureRef)).toBe(true)
            
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].sameKey(exampleRef)).toBe(true)
            
            expect(result.characters.payload.length).toBe(1)
            expect(result.characters.payload[0].sameKey(charRef)).toBe(true)
            
            // Verify other buckets are empty
            expect(result.exits.length).toBe(0)
        })
    })

})