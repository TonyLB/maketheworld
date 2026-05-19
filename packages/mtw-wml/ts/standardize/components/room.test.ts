import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardRoomData } from "./dataTypes/room"
import StandardRoom from './room'
import { mergeTest } from "./utils/testing"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"
import { StandardExplicitParent } from "../explicit"
import { StandardLens } from "./worldState"
import { StandardForm } from "../"

describe('StandardRoom class', () => {

    it('should construct StandardRoom from WML', () => {
        const testSource = deIndentWML(`
            <Room uuid=(123) key=(test)>
                <ShortName>ShortName Test</ShortName>
                <Feature key=(testFeature) />
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
                <Exit to=(testTwo)>Exit test</Exit>
            </Room>
        `)
        const testRoom = new StandardRoom(testSource)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.features).toBeDefined()
        expect(testRoom.features!.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature' }])
        expect(testRoom.shortName?.schema).toEqual([{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }])
        expect(testRoom.exits.toJSON()).toEqual([{ reference: { tag: 'Room', key: 'testTwo' }, payload: 'Exit test' }])
        expect(testRoom.universalKey).toEqual('ROOM#123')
        expect(schemaToWML([testRoom.schema])).toEqual(testSource)
    })

    it('should construct StandardRoom from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Room uuid=(123) key=(test)>
                <ShortName>ShortName Test</ShortName>
                <Feature key=(testFeature) />
                <Situation uuid=(DEFAULT)><DisplayName>Base</DisplayName></Situation>
                <Exit to=(testTwo)>Exit test</Exit>
            </Room>
        `)
        schema.loadWML(testSource)
        const testRoom = new StandardRoom(schema.schema[0])
        expect(testRoom.key).toEqual('test')
        expect(testRoom.features).toBeDefined()
        expect(testRoom.features!.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature'}])
        expect(testRoom.situations.length).toBe(1)
        expect(testRoom.situations.items[0].reference.universalKey).toBe('SITUATION#DEFAULT')
        expect(testRoom.situations.items[0].payload.toJSON()).toMatchObject({ displayName: 'Base' })
        expect(testRoom.shortName?.schema).toEqual([{ data: { tag: 'String', value: 'ShortName Test' }, children: [] }])
        expect(testRoom.exits.toJSON()).toEqual([{ reference: { tag: 'Room', key: 'testTwo' }, payload: 'Exit test' }])
        expect(testRoom.universalKey).toEqual('ROOM#123')
        expect(schemaToWML([testRoom.schema])).toEqual(testSource)
    })

    it('should ignore Position tags', () => {
        const testSource = deIndentWML(`
            <Room key=(test)>
                <Position {0, 100} />
            </Room>
        `)
        const testRoom = new StandardRoom(testSource)
        expect(testRoom.key).toEqual('test')
        expect(schemaToWML([testRoom.schema])).toEqual(deIndentWML(`
            <Room key=(test) />
        `))
    })

    it('should throw when Room contains unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Room key=(test)>
                <ShortName>Name</ShortName>
                <Map />
            </Room>
        `)
        expect(() => new StandardRoom(testSource)).toThrow(/Unconsumed child tags/)
        expect(() => new StandardRoom(testSource)).toThrow(/Map/)
    })

    it('should construct StandardRoom from StandardRoomData', () => {
        const testRoomData: StandardRoomData = {
            key: 'test',
            tag: 'Room',
            shortName: 'ShortName Test',
            exits: [{ reference: { tag: 'Room', key: 'testTwo' }, payload: 'Exit test' }],
            features: [{ tag: 'Feature', key: 'testFeature' }]
        }
        const testRoom = new StandardRoom(testRoomData)
        expect(testRoom.key).toEqual('test')
        expect(testRoom.features).toBeDefined()
        expect(testRoom.features!.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature' }])
        expect(testRoom.shortName?.toJSON()).toEqual('ShortName Test')
        expect(testRoom.exits.toJSON()).toEqual([{ reference: { tag: 'Room', key: 'testTwo' }, payload: 'Exit test' }])
        expect(testRoom.toJSON()).toEqual(testRoomData)
    })

    it('should construct StandardRoom from StandardRoomData with situations', () => {
        const testRoomData: StandardRoomData = {
            key: 'test',
            tag: 'Room',
            situations: [
                {
                    reference: { tag: 'Situation', key: 'bright', universalKey: 'SITUATION#bright' },
                    payload: { displayName: 'Bright Lobby' }
                }
            ]
        }
        const testRoom = new StandardRoom(testRoomData)
        expect(testRoom.situations).toBeDefined()
        expect(testRoom.situations.length).toBe(1)
        expect(testRoom.situations.items[0].reference.key).toBe('bright')
        expect(testRoom.situations.items[0].payload.toJSON()).toMatchObject({ displayName: 'Bright Lobby' })
        const roomJSON = testRoom.toJSON() as StandardRoomData
        expect(roomJSON.situations).toBeDefined()
        expect(roomJSON.situations).toHaveLength(1)
    })

    it('should parse Room with Situation facet from WML and round-trip', () => {
        const testSource = deIndentWML(`
            <Room key=(lobby) uuid=(123)>
                <ShortName>Lobby</ShortName>
                <Situation key=(bright) ref={0}>
                    <DisplayName>Bright Lobby</DisplayName>
                </Situation>
            </Room>
        `)
        const testRoom = new StandardRoom(testSource)
        expect(testRoom.key).toBe('lobby')
        expect(testRoom.situations.length).toBe(1)
        expect(testRoom.situations.items[0].reference.key).toBe('bright')
        const roundTrip = schemaToWML([testRoom.schema])
        expect(roundTrip).toContain('Situation')
        expect(roundTrip).toContain('key=(bright)')
    })

    it('should produce a non-no-op diff when SituationFacet summary has content removed', () => {
        const baseRoom = new StandardRoom(deIndentWML(`
            <Room uuid=(123) key=(tavern)>
                <Situation key=(daylight)>
                    <Summary>A cheery tavern by daylight</Summary>
                </Situation>
            </Room>
        `))

        const incomingRoom = new StandardRoom(deIndentWML(`
            <Room uuid=(123) key=(tavern)>
                <Situation key=(daylight)>
                    <Summary>A cheery tavern</Summary>
                </Situation>
            </Room>
        `))

        const diff = baseRoom.diff(incomingRoom) as StandardRoom | undefined

        expect(diff).toBeDefined()
        expect(diff!.situations.length).toBe(1)
        expect(diff!.situations.items[0].reference.key).toBe('daylight')

        const facetPayloadJSON = diff!.situations.items[0].payload.toJSON()
        expect(facetPayloadJSON.summary).toBeDefined()
        // The diff should represent removal of content; summary should be a Remove edit (object with tag: 'Remove').
        // If the round-trip is misinterpreted as no-op, the issue may be that summary is not in the expected
        // shape (e.g. single-element array containing the Remove record) for downstream apply/merge.
        expect(facetPayloadJSON.summary).toMatchObject({ tag: 'Remove' })
        expect((facetPayloadJSON.summary as { tag: string; match?: unknown }).match).toBeDefined()

        const merged = baseRoom.merge(diff!) as StandardRoom
        expect(merged.equals(incomingRoom)).toBe(true)
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
        expect(testRoom.features).toBeDefined()
        expect(testRoom.features!.toJSON()).toEqual([{ tag: 'Feature', key: 'testFeature' }])
        expect(testRoom.shortName?.toJSON()).toEqual('ShortName Test')
        expect(testRoom.exits.length).toEqual(0)  // Should default to empty list
        
        // The JSON output should omit exits when empty (omission-over-empty pattern)
        const outputJSON = testRoom.toJSON() as StandardRoomData
        expect(outputJSON.exits).toBeUndefined()
    })

    it('should correctly render a removed feature reference', () => {
        const test = new StandardRoom(`
            <Room key=(testRoomOne)>
                <Remove><Feature key=(base) /></Remove>
            </Room>
        `)

        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)><Remove><Feature key=(base) /></Remove></Room>
        `))
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Room key=(testRoomOne)>
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Lobby</DisplayName>
                    <Description>A plain lobby.</Description>
                </Situation>
            </Room>`,
            StandardRoom,
            `<Room key=(testRoomOne) ref={0}>
                <Feature key=(testFeature) />
                <Situation uuid=(DEFAULT) ref={0}>
                    <Replace><DisplayName>Lobby</DisplayName></Replace><With><DisplayName>Spooky Lobby</DisplayName></With>
                    <Description><Space />Shadows cling to the corners of the room.</Description>
                </Situation>
            </Room>`
        )).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature key=(testFeature) />
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Spooky Lobby</DisplayName>
                    <Description>
                        A plain lobby. Shadows cling to the corners of the room.
                    </Description>
                </Situation>
            </Room>
        `))
    })

    it('should correctly parse exits with universalKey targets', () => {
        const test = new StandardRoom(`
            <Room key=(testRoomOne)>
                <Exit to=(ROOM#testRoomTwo)>exit</Exit>
            </Room>
        `)
        expect(test.exits.toJSON()).toEqual([{ reference: 'ROOM#testRoomTwo', payload: 'exit' }])
        expect(test.referencedKeys().map(({ reference, ...rest }) => ({ key: reference.standardKey.toJSON(), ...rest }))).toEqual([{ key: 'ROOM#testRoomTwo', referenceType: 'Exit' }])
    })

    // it('should map contents on exits correctly', () => {
    //     const test = new StandardRoom(`
    //         <Room key=(testRoomOne)>
    //             <Situation key=(base)>
    //                 <DisplayName>Lobby</DisplayName>
    //                 <Summary>A lobby</Summary>
    //                 <Description>A plain lobby.</Description>
    //             </Situation>
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
    //             <Situation key=(base) />
    //             <Exit to=(testRoomTwo)>
    //                 exit
    //                 Narf!
    //             </Exit>
    //         </Room>
    //     `))
    // })

    it('should map references to universal keys correctly', () => {
        const test = new StandardRoom({
            tag: 'Room',
            key: 'testRoomOne',
            universalKey: 'ROOM#Room1',
            guidance: [{ tag: 'Guidance', key: 'base', universalKey: 'GUIDANCE#Guide1' }],
            exits: [{ reference: { tag: 'Room', key: 'testRoomTwo' }, payload: 'exit' }],
        })
        const remapped = test.withMapping([
            new StandardReference({ universalKey: 'ROOM#Room1', key: 'testRoomOne', tag: 'Room'}),
            new StandardReference({ universalKey: 'GUIDANCE#Guide1', key: 'base', tag: 'Guidance' }),
            new StandardReference({ universalKey: 'ROOM#testRoomTwo', key: 'testRoomTwo', tag: 'Room' })
        ]).remapReferences('universal')
        expect(schemaToWML([remapped.schema])).toEqual(deIndentWML(`
            <Room uuid=(Room1) key=(testRoomOne)>
                <Guidance uuid=(Guide1) />
                <Exit to=(testRoomTwo)>exit</Exit>
            </Room>
        `))
    })

    it('should map references to local keys correctly', () => {
        const test = new StandardRoom({
            tag: 'Room',
            key: 'testRoomOne',
            guidance: [{ tag: 'Guidance', universalKey: 'GUIDANCE#Guide1' }],
            features: [{ tag: 'Feature', universalKey: 'FEATURE#Feature1' }],
        })
        expect(schemaToWML([
            test.withMapping([
                new StandardReference({ universalKey: 'ROOM#Room1', tag: 'Room', key: 'testRoomOne' }),
                new StandardReference({ universalKey: 'GUIDANCE#Guide1', tag: 'Guidance', key: 'guideOne' }),
                new StandardReference({ universalKey: 'FEATURE#Feature1', tag: 'Feature', key: 'featureOne' })
            ]).remapReferences('key').schema
        ])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature key=(featureOne) />
                <Guidance key=(guideOne) />
            </Room>
        `))
    })

    it('should correctly add a feature reference to a room', () => {
        const test = new StandardRoom({
            tag: 'Room',
            key: 'testRoomOne',
            guidance: [{ tag: 'Guidance', universalKey: 'GUIDANCE#Guide1' }],
            features: [{ tag: 'Feature', universalKey: 'FEATURE#Feature1' }],
        })
        const feature = new StandardKey({ key: 'featureTwo' })
        const added = test.withChild(new StandardReference(feature, 'Feature'))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature uuid=(Feature1) />
                <Feature key=(featureTwo) />
                <Guidance uuid=(Guide1) />
            </Room>
        `))
    })

    it('should correctly add a character reference to a room', () => {
        const test = new StandardRoom({
            tag: 'Room',
            key: 'testRoomOne',
            guidance: [{ tag: 'Guidance', universalKey: 'GUIDANCE#Guide1' }],
            features: [{ tag: 'Feature', universalKey: 'FEATURE#Feature1' }],
        })
        const character = new StandardKey("CHARACTER#Character1")
        const added = test.withChild(new StandardReference(character))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Room key=(testRoomOne)>
                <Feature uuid=(Feature1) />
                <Guidance uuid=(Guide1) />
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
            expect(room.characters).toBeDefined()
            expect(room.characters!.payload.length).toBe(2)
            expect(room.characters!.toJSON()).toEqual([
                { tag: 'Character', key: 'char1' },
                'CHARACTER#uuid123' // Universal key only returns string
            ])
        })

        it('should construct StandardRoom from WML with Character sub-components', () => {
            const testSource = deIndentWML(`
                <Room key=(testRoom)>
                    <Character key=(char1)>
                        <DisplayName>Character One</DisplayName>
                    </Character>
                    <Character uuid=(CHARACTER#uuid123)>
                        <DisplayName>Character Two</DisplayName>
                    </Character>
                </Room>
            `)
            const room = new StandardRoom(testSource)
            expect(room.characters).toBeDefined()
            expect(room.characters!.payload.length).toBe(2)
            expect(room.characters!.payload[0].key).toBe('char1')
            expect(room.characters!.payload[1].universalKey).toBe('CHARACTER#uuid123')
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
            expect(merged.characters).toBeDefined()
            expect(merged.characters!.payload.length).toBe(2)
            expect(merged.characters!.payload.map(ref => ref.key)).toContain('char1')
            expect(merged.characters!.payload.map(ref => ref.key)).toContain('char2')
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
            expect(diff!.characters).toBeDefined()
            expect(diff!.characters!.payload.length).toBeGreaterThan(0)
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
            expect(referencedKeys.map((ref) => ref.reference.standardKey.toJSON())).toEqual([{ key: 'feat1' }, { key: 'char1' }, 'CHARACTER#uuid123'])
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
                .map((ref) => ref.reference.standardKey.toJSON())
            
            expect(featureKeys).toContainEqual({ key: 'removedFeature' })
        })

        it('should include Link refs from Situation facet prose when mapping resolves link targets', () => {
            const wml = deIndentWML(`
                <Room key=(tavern)>
                    <Situation key=(day)>
                        <DisplayName>Daytime</DisplayName>
                        <Summary>A scene with <Link to=(linkedFeature)>a feature</Link>.</Summary>
                    </Situation>
                </Room>
            `)
            const mapping = [
                new StandardReference({ key: 'linkedFeature', tag: 'Feature', universalKey: 'FEATURE#linkedFeature' }),
                new StandardReference({ key: 'day', tag: 'Situation', universalKey: 'SITUATION#day' }),
            ]
            const room = new StandardRoom(wml).withMapping(mapping)
            const refs = room.referencedKeys()
            expect(refs.some((r) => r.referenceType === 'Direct' && r.reference.key === 'day')).toBe(true)
            const linkRefs = refs.filter((r) => r.referenceType === 'Link')
            expect(linkRefs.length).toBe(1)
            expect(linkRefs[0].reference.standardKey.toJSON()).toEqual({ key: 'linkedFeature', universalKey: 'FEATURE#linkedFeature' })
        })

        it('should include Link refs from ephemera render when mapping resolves link targets', () => {
            const mapping = [new StandardReference({ key: 'otherRoom', tag: 'Room', universalKey: 'ROOM#other' })]
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: 'lobby',
                render: {
                    displayName: 'Lobby',
                    summary: [{ data: { tag: 'Link', to: 'otherRoom', text: 'Elsewhere' }, children: [] }],
                },
            }
            const room = new StandardRoom(roomData).withMapping(mapping)
            const linkRefs = room.referencedKeys().filter((r) => r.referenceType === 'Link')
            expect(linkRefs.length).toBe(1)
            expect(linkRefs[0].reference.standardKey.toJSON()).toEqual({ key: 'otherRoom', universalKey: 'ROOM#other' })
        })

        it('should provide access to characters via getter', () => {
            const room = new StandardRoom(`
                <Room key=(testRoom)>
                    <Character key=(char1) />
                    <Character key=(char2) />
                </Room>
            `)
            expect(room.characters).toBeDefined()
            expect(room.characters!.payload.length).toBe(2)
            expect(room.characters!.payload[0].key).toBe('char1')
            expect(room.characters!.payload[1].key).toBe('char2')
        })

        it('should handle empty character lists correctly', () => {
            const room = new StandardRoom(`<Room key=(testRoom) />`)
            // Empty characters list returns empty ReferenceList
            expect(room.characters.payload.length).toBe(0)
            
            const json = room.toJSON() as StandardRoomData
            expect(json.characters).toBeUndefined() // Empty lists are not serialized (omission-over-empty pattern)
        })

    })

    describe('Guidance references', () => {
        it('should handle guidance references', () => {
            const wml = deIndentWML(`
                <Room key=(tavern)>
                    <Guidance key=(darkGuidance)/>
                    <Guidance key=(moonlightGuidance)/>
                </Room>
            `)
            const room = new StandardRoom(wml)
            expect(room.guidance.payload.length).toBe(2)
        })

        it('should serialize guidance references correctly', () => {
            const room = new StandardRoom({
                tag: 'Room',
                key: 'tavern',
                guidance: [
                    { tag: 'Guidance', key: 'darkGuidance', ref: 1 }
                ]
            })
            const json = room.toJSON()
            expect((json as any).guidance).toBeDefined()
            expect((json as any).guidance?.length).toBe(1)
        })

        it('should merge guidance references', () => {
            const room1 = new StandardRoom({
                tag: 'Room',
                key: 'tavern',
                guidance: [{ tag: 'Guidance', key: 'guidance1', ref: 1 }]
            })
            const room2 = new StandardRoom({
                tag: 'Room',
                key: 'tavern',
                guidance: [{ tag: 'Guidance', key: 'guidance2', ref: 1 }]
            })
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.guidance.payload.length).toBe(2)
        })

        it('should assure guidance references correctly', () => {
            const room = new StandardRoom({
                tag: 'Room',
                key: 'tavern'
            })
            const guidanceRef = new StandardReference({
                tag: 'Guidance',
                key: 'testGuidance',
                ref: 1
            })
            const { payload: withReferences } = room._payload.assureReferences([guidanceRef])
            expect(withReferences.guidance.payload.length).toBe(1)
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
                exits: [{ reference: { tag: 'Room', key: 'target' }, payload: 'Exit description' }],
                features: [{ tag: 'Feature', key: 'feat1' }],
                characters: [{ tag: 'Character', key: 'char1' }]
            }
            const room = new StandardRoom(roomData)
            const inverted = room._payload.invert()
            
            // All fields should be inverted (Add → Remove)
            expect(schemaToWML([inverted.schema('test')])).toEqual(deIndentWML(`
                <Room key=(test)>
                    <Remove><ShortName>Test Room</ShortName></Remove>
                    <Remove><Feature key=(feat1) /></Remove>
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
                    <Remove><Character key=(char1) /></Remove>
                </Room>
            `))
            const inverted = roomWithRemoves._payload.invert()
            
            // Inverted room: ShortName becomes Remove, removed references become added
            expect(schemaToWML([inverted.schema('test')])).toEqual(deIndentWML(`
                <Room key=(test)>
                    <Remove><ShortName>Test</ShortName></Remove>
                    <Feature key=(feat1) />
                    <Character key=(char1) />
                </Room>
            `))
        })

        it('should satisfy double-inversion property (invert.invert returns equivalent)', () => {
            const roomData: StandardRoomData = {
                key: 'test',
                tag: 'Room',
                shortName: 'Test Room',
                exits: [{ reference: { tag: 'Room', key: 'target' }, payload: 'Exit' }],
                features: [{ tag: 'Feature', key: 'feat1' }],
            }
            const room = new StandardRoom(roomData)
            const doubleInverted = room._payload.invert().invert()
            
            // Double inversion should return to original (within merge equivalence)
            // We compare JSON output since the objects may not be strictly equal
            expect(doubleInverted.shortName?.toJSON()).toEqual(room._payload.shortName?.toJSON())
            expect(doubleInverted.exits.toJSON()).toEqual(room._payload.exits.toJSON())
            expect(doubleInverted.features.toJSON()).toEqual(room._payload.features.toJSON())
        })

        it('should invert an empty room', () => {
            const emptyRoom = new StandardRoom(deIndentWML(`<Room key=(test) />`))
            const inverted = emptyRoom._payload.invert()
            
            expect(inverted.shortName).toBeUndefined()
            expect(inverted.exits.length).toEqual(0)
            expect(inverted.features.toJSON()).toEqual([])
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
            expect(inverted.exits.length).toEqual(0)
            expect(inverted.features.toJSON()).toEqual([{ tag: 'Feature', key: 'feat1', ref: -1 }])
            expect(inverted.characters.toJSON()).toEqual([])
        })
    })

    describe('explicitKey', () => {
        it('should construct StandardRoom from WML with Key tag (simple)', () => {
            const testSource = deIndentWML(`
                <Room uuid=(123) key=(testRoom)>
                    <Key>testRoom</Key>
                    <ShortName>Test Room</ShortName>
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            expect(testRoom.key).toEqual('testRoom')
            expect(testRoom.universalKey).toEqual('ROOM#123')
            // Simple key should render as key=(value) attribute only, no Key tag in children
            expect(schemaToWML([testRoom.schema])).toEqual(deIndentWML(`
                <Room uuid=(123) key=(testRoom)><ShortName>Test Room</ShortName></Room>
            `))
        })

        it('should construct StandardRoom from WML with Remove Key tag', () => {
            const testSource = deIndentWML(`
                <Room uuid=(123) key=(testRoom)>
                    <Remove><Key>testRoom</Key></Remove>
                    <ShortName>Test Room</ShortName>
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            expect(testRoom.key).toEqual('testRoom') // key getter returns match key
            expect(testRoom.universalKey).toEqual('ROOM#123')
            // Remove key should render as key=(matchValue) attribute AND Key tag in Remove wrapper
            expect(schemaToWML([testRoom.schema])).toEqual(deIndentWML(`
                <Room uuid=(123) key=(testRoom)>
                    <Remove><Key>testRoom</Key></Remove>
                    <ShortName>Test Room</ShortName>
                </Room>
            `))
        })

        it('should construct StandardRoom from WML with Replace Key tag', () => {
            const testSource = deIndentWML(`
                <Room uuid=(123) key=(oldRoom)>
                    <Replace><Key>oldRoom</Key></Replace>
                    <With><Key>newRoom</Key></With>
                    <ShortName>Test Room</ShortName>
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            expect(testRoom.key).toEqual('oldRoom') // key getter returns match key
            expect(testRoom.universalKey).toEqual('ROOM#123')
            // Replace key should render as key=(matchValue) attribute AND Key tags in Replace wrapper
            expect(schemaToWML([testRoom.schema])).toEqual(deIndentWML(`
                <Room uuid=(123) key=(oldRoom)>
                    <Replace><Key>oldRoom</Key></Replace><With><Key>newRoom</Key></With>
                    <ShortName>Test Room</ShortName>
                </Room>
            `))
        })

        it('should construct StandardRoom from JSON with simple key (string)', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: 'testRoom',
                shortName: 'Test Room'
            }
            const testRoom = new StandardRoom(roomData)
            expect(testRoom.key).toEqual('testRoom')
            expect(testRoom.toJSON().key).toBe('testRoom')
        })

        it('should construct StandardRoom from JSON with Remove key edit', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: { tag: 'Remove', match: 'testRoom' },
                shortName: 'Test Room'
            }
            const testRoom = new StandardRoom(roomData)
            expect(testRoom.key).toEqual('testRoom')
            const keyJSON = testRoom.toJSON().key
            expect(keyJSON).toEqual({ tag: 'Remove', match: 'testRoom' })
        })

        it('should construct StandardRoom from JSON with Replace key edit', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: { tag: 'Replace', match: 'oldRoom', payload: 'newRoom' },
                shortName: 'Test Room'
            }
            const testRoom = new StandardRoom(roomData)
            expect(testRoom.key).toEqual('oldRoom')
            const keyJSON = testRoom.toJSON().key
            expect(keyJSON).toEqual({ tag: 'Replace', match: 'oldRoom', payload: 'newRoom' })
        })

        it('should prefer Key tag over key attribute when both are present in WML', () => {
            const testSource = deIndentWML(`
                <Room uuid=(123) key=(attributeKey)>
                    <Key>tagKey</Key>
                </Room>
            `)
            const testRoom = new StandardRoom(testSource)
            // Key tag should take precedence
            expect(testRoom.key).toEqual('tagKey')
            expect(schemaToWML([testRoom.schema])).toEqual(deIndentWML(`
                <Room uuid=(123) key=(tagKey) />
            `))
        })

        it('should merge components with identical simple keys', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <ShortName>Room One</ShortName>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <ShortName>Room Two</ShortName>
                </Room>
            `))
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.key).toEqual('testRoom')
            // Keys should be preserved (idempotent)
            expect(merged.toJSON().key).toBe('testRoom')
        })

        it('should throw error when merging components with different simple keys', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(room1) />
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(room2) />
            `))
            expect(() => room1.merge(room2)).toThrow('Merge of two unequal keys')
        })

        it('should merge component with simple key and component with Remove key (same value)', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room uuid=(123) key=(testRoom) />
            `))
            const room2Data: StandardRoomData = {
                tag: 'Room',
                universalKey: 'ROOM#123',
                key: { tag: 'Remove', match: 'testRoom' }
            }
            const room2 = new StandardRoom(room2Data)
            // Merging Simple with Remove (same value) should cancel out - key is removed
            const merged = room1.merge(room2) as StandardRoom
            expect(merged.key).toBeUndefined()
            // The merge result should have no key (canceled out)
            const keyJSON = merged.toJSON().key
            expect(keyJSON).toBeUndefined()
        })

        it('should merge component without key and component with Remove key', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room uuid=(123) />
            `))
            const room2Data: StandardRoomData = {
                tag: 'Room',
                universalKey: 'ROOM#123',
                key: { tag: 'Remove', match: 'testRoom' }
            }
            const room2 = new StandardRoom(room2Data)
            // Merging component without key with Remove key should preserve the Remove operation
            const merged = room1.merge(room2) as StandardRoom
            // The key getter should return the match value from Remove operation
            expect(merged.key).toEqual('testRoom')
            // The merge result should preserve the Remove operation
            const keyJSON = merged.toJSON().key
            expect(keyJSON).toEqual({ tag: 'Remove', match: 'testRoom' })
        })

        it('should diff component with key and component without key', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room uuid=(123) key=(testRoom) />
            `))
            const room2 = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#123'
            })
            const diff = room1.diff(room2) as StandardRoom
            expect(diff).toBeDefined()
            // Diff should include Remove operation for the key
            const keyJSON = diff!.toJSON().key
            expect(keyJSON).toEqual({ tag: 'Remove', match: 'testRoom' })
        })

        it('should diff component without key and component with key', () => {
            const room1 = new StandardRoom({
                tag: 'Room',
                universalKey: 'ROOM#123'
            })
            const room2 = new StandardRoom(deIndentWML(`
                <Room uuid=(123) key=(testRoom) />
            `))
            const diff = room1.diff(room2) as StandardRoom
            expect(diff).toBeDefined()
            // Diff should include the new key
            expect(diff!.key).toEqual('testRoom')
            expect(diff!.toJSON().key).toBe('testRoom')
        })

        it('should preserve key in diff when both components have identical simple keys', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <ShortName>Room One</ShortName>
                </Room>
            `))
            const room2 = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <ShortName>Room Two</ShortName>
                </Room>
            `))
            const diff = room1.diff(room2) as StandardRoom
            expect(diff).toBeDefined()
            // Key should be preserved (idempotent behavior)
            expect(diff!.key).toEqual('testRoom')
            expect(diff!.toJSON().key).toBe('testRoom')
        })

        it('should diff component with simple key and component with Remove key (same value)', () => {
            const room1 = new StandardRoom(deIndentWML(`
                <Room uuid=(123) key=(testRoom) />
            `))
            const room2Data: StandardRoomData = {
                tag: 'Room',
                universalKey: 'ROOM#123',
                key: { tag: 'Remove', match: 'testRoom' }
            }
            const room2 = new StandardRoom(room2Data)
            const diff = room1.diff(room2) as StandardRoom
            expect(diff).toBeDefined()
            // Diff should show the change from Simple to Remove
            const keyJSON = diff!.toJSON().key
            expect(keyJSON).toEqual({ tag: 'Remove', match: 'testRoom' })
        })

        it('should clone explicit key edits correctly', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: { tag: 'Replace', match: 'oldRoom', payload: 'newRoom' }
            }
            const testRoom = new StandardRoom(roomData)
            const cloned = testRoom.clone() as StandardRoom
            expect(cloned.key).toEqual('oldRoom')
            expect(cloned.toJSON().key).toEqual({ tag: 'Replace', match: 'oldRoom', payload: 'newRoom' })
            // Should be a new instance, not the same reference
            expect(cloned).not.toBe(testRoom)
        })

        it('should not invert simple keys (idempotent behavior)', () => {
            const room = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <ShortName>Test</ShortName>
                </Room>
            `))
            const inverted = room.invert() as StandardRoom
            // Simple key should be preserved, not inverted to Remove
            expect(inverted.key).toEqual('testRoom')
            expect(inverted.toJSON().key).toBe('testRoom')
        })

        it('should invert Remove key to Simple key', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: { tag: 'Remove', match: 'testRoom' }
            }
            const room = new StandardRoom(roomData)
            const inverted = room.invert() as StandardRoom
            // Remove should invert to Simple
            expect(inverted.key).toEqual('testRoom')
            expect(inverted.toJSON().key).toBe('testRoom')
        })

        it('should invert Replace key (swap match and payload)', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: { tag: 'Replace', match: 'oldRoom', payload: 'newRoom' }
            }
            const room = new StandardRoom(roomData)
            const inverted = room.invert() as StandardRoom
            // Replace should invert by swapping match and payload
            expect(inverted.key).toEqual('newRoom') // After invert, match is now 'newRoom'
            const keyJSON = inverted.toJSON().key
            expect(keyJSON).toEqual({ tag: 'Replace', match: 'newRoom', payload: 'oldRoom' })
        })

        it('should round-trip through WML for Remove key edit', () => {
            const originalWML = deIndentWML(`
                <Room uuid=(123) key=(testRoom)><Remove><Key>testRoom</Key></Remove></Room>
            `)
            const room = new StandardRoom(originalWML)
            const roundTrip = schemaToWML([room.schema])
            expect(roundTrip).toEqual(originalWML)
        })

        it('should round-trip through WML for Replace key edit', () => {
            const originalWML = deIndentWML(`
                <Room uuid=(123) key=(oldRoom)>
                    <Replace><Key>oldRoom</Key></Replace><With><Key>newRoom</Key></With>
                </Room>
            `)
            const room = new StandardRoom(originalWML)
            const roundTrip = schemaToWML([room.schema])
            expect(roundTrip).toEqual(originalWML)
        })

        it('should round-trip through JSON for Remove key edit', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: { tag: 'Remove', match: 'testRoom' }
            }
            const room = new StandardRoom(roomData)
            const json = room.toJSON() as StandardRoomData
            expect(json.key).toEqual({ tag: 'Remove', match: 'testRoom' })
            // Round-trip: create new room from JSON
            const roundTrip = new StandardRoom(json)
            expect(roundTrip.toJSON().key).toEqual({ tag: 'Remove', match: 'testRoom' })
        })

        it('should round-trip through JSON for Replace key edit', () => {
            const roomData: StandardRoomData = {
                tag: 'Room',
                key: { tag: 'Replace', match: 'oldRoom', payload: 'newRoom' }
            }
            const room = new StandardRoom(roomData)
            const json = room.toJSON() as StandardRoomData
            expect(json.key).toEqual({ tag: 'Replace', match: 'oldRoom', payload: 'newRoom' })
            // Round-trip: create new room from JSON
            const roundTrip = new StandardRoom(json)
            expect(roundTrip.toJSON().key).toEqual({ tag: 'Replace', match: 'oldRoom', payload: 'newRoom' })
        })

        it('should use withKey to set a new simple key', () => {
            const room = new StandardRoom(deIndentWML(`
                <Room key=(oldKey) />
            `))
            const withNewKey = room.withKey('newKey') as StandardRoom
            expect(withNewKey.key).toEqual('newKey')
            expect(withNewKey.toJSON().key).toBe('newKey')
        })
    })

    describe('assureReferences method', () => {
        it('should return unchanged room when children array is empty', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const { payload: result, inlineRemainder } = room._payload.assureReferences([])
            
            expect(result.features.payload.length).toBe(0)
            expect(result.characters.payload.length).toBe(0)
            expect(inlineRemainder).toEqual([])
            // Verify it's a clone (original unchanged)
            expect(room._payload.features.payload.length).toBe(0)
        })
        
        it('should add children with ref={0} when they do not exist', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const markRef = new StandardReference({ tag: 'Mark', key: 'mark1' })
            const charRef = new StandardReference({ tag: 'Character', key: 'char1' })
            
            const { payload: result, inlineRemainder } = room._payload.assureReferences([featureRef, markRef, charRef])
            
            expect(inlineRemainder.length).toBe(1)
            expect(inlineRemainder[0].tag).toBe('Mark')
            expect(result.features.payload.length).toBe(1)
            expect(result.features.payload[0].ref).toBe(0)
            expect(result.features.payload[0].sameKey(featureRef)).toBe(true)
            
            expect(result.characters.payload.length).toBe(1)
            expect(result.characters.payload[0].ref).toBe(0)
            expect(result.characters.payload[0].sameKey(charRef)).toBe(true)
        })
        
        it('should leave existing references with non-zero ref unchanged', () => {
            const room = new StandardRoom({
                tag: 'Room',
                key: 'test',
                features: [{ tag: 'Feature', key: 'feat1' }],
                guidance: [{ tag: 'Guidance', key: 'g1', ref: 2 }],
            })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const guidanceRef = new StandardReference({ tag: 'Guidance', key: 'g1', ref: 2 })
            
            const { payload: result } = room._payload.assureReferences([featureRef, guidanceRef])
            
            expect(result.features.payload.length).toBe(1)
            expect(result.features.payload[0].ref).toBe(1)
            
            expect(result.guidance.payload.length).toBe(1)
            expect(result.guidance.payload[0].ref).toBe(2)
        })
        
        it('should handle mixed scenarios (some exist, some do not)', () => {
            const room = new StandardRoom(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(existingFeat) />
                </Room>
            `))
            const existingFeature = new StandardReference({ tag: 'Feature', key: 'existingFeat' })
            const newFeature = new StandardReference({ tag: 'Feature', key: 'newFeat' })
            const newGuidance = new StandardReference({ tag: 'Guidance', key: 'newGuide' })
            
            const { payload: result } = room._payload.assureReferences([existingFeature, newFeature, newGuidance])
            
            expect(result.features.payload.length).toBe(2)
            const existingFeatInResult = result.features.payload.find(ref => ref.sameKey(existingFeature))
            expect(existingFeatInResult?.ref).toBe(1)
            
            const newFeatInResult = result.features.payload.find(ref => ref.sameKey(newFeature))
            expect(newFeatInResult?.ref).toBe(0)
            
            expect(result.guidance.payload.length).toBe(1)
            expect(result.guidance.payload[0].ref).toBe(0)
            expect(result.guidance.payload[0].sameKey(newGuidance)).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const originalFeaturesLength = room._payload.features.payload.length
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            
            const { payload: result } = room._payload.assureReferences([featureRef])
            
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
            const guidanceRef = new StandardReference({ tag: 'Guidance', key: 'g1' })
            
            const { payload: firstPayload } = room._payload.assureReferences([featureRef, guidanceRef])
            const { payload: secondPayload } = firstPayload.assureReferences([featureRef, guidanceRef])
            
            expect(firstPayload.features.payload.length).toBe(1)
            expect(secondPayload.features.payload.length).toBe(1)
            expect(firstPayload.features.payload[0].sameKey(secondPayload.features.payload[0])).toBe(true)
            expect(firstPayload.features.payload[0].ref).toBe(0)
            expect(secondPayload.features.payload[0].ref).toBe(0)
            
            expect(firstPayload.guidance.payload.length).toBe(1)
            expect(secondPayload.guidance.payload.length).toBe(1)
            expect(firstPayload.guidance.payload[0].sameKey(secondPayload.guidance.payload[0])).toBe(true)
            expect(firstPayload.guidance.payload[0].ref).toBe(0)
            expect(secondPayload.guidance.payload[0].ref).toBe(0)
        })
        
        it('should dispatch children to correct buckets based on tag', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const guidanceRef = new StandardReference({ tag: 'Guidance', key: 'g1' })
            const charRef = new StandardReference({ tag: 'Character', key: 'char1' })
            
            const { payload: result } = room._payload.assureReferences([featureRef, guidanceRef, charRef])
            
            expect(result.features.payload.length).toBe(1)
            expect(result.features.payload[0].sameKey(featureRef)).toBe(true)
            
            expect(result.guidance.payload.length).toBe(1)
            expect(result.guidance.payload[0].sameKey(guidanceRef)).toBe(true)
            
            expect(result.characters.payload.length).toBe(1)
            expect(result.characters.payload[0].sameKey(charRef)).toBe(true)
            
            expect(result.exits.length).toBe(0)
        })

        it('should put non-bucket children in inlineRemainder with ref={0}', () => {
            const room = new StandardRoom({ tag: 'Room', key: 'test' })
            const markRef = new StandardReference({ tag: 'Mark', key: 'mark1' })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })

            const { payload: result, inlineRemainder } = room._payload.assureReferences([markRef, featureRef])

            // Feature goes to bucket
            expect(result.features.payload.length).toBe(1)
            expect(result.features.payload[0].sameKey(featureRef)).toBe(true)
            // Mark goes to remainder (Room has no Mark bucket)
            expect(inlineRemainder.length).toBe(1)
            expect(inlineRemainder[0].tag).toBe('Mark')
            expect(inlineRemainder[0].sameKey(markRef)).toBe(true)
            expect(inlineRemainder[0].ref).toBe(0)
        })
    })

    describe('removeReferences method', () => {
        it('should remove matching references from all buckets', () => {
            const room = new StandardRoom({
                tag: 'Room',
                key: 'test',
                features: [
                    { tag: 'Feature', key: 'feat1' },
                    { tag: 'Feature', key: 'feat2' },
                ],
                guidance: [{ tag: 'Guidance', key: 'g1' }],
                characters: [{ tag: 'Character', key: 'char1' }],
            })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const guidanceRef = new StandardReference({ tag: 'Guidance', key: 'g1' })
            
            const result = room._payload.removeReferences([featureRef, guidanceRef])
            
            expect(result.features.payload.length).toBe(1)
            expect(result.features.payload[0].sameKey(new StandardReference({ tag: 'Feature', key: 'feat2' }))).toBe(true)
            
            expect(result.guidance.payload.length).toBe(0)
            
            expect(result.characters.payload.length).toBe(1)
            expect(result.characters.payload[0].sameKey(new StandardReference({ tag: 'Character', key: 'char1' }))).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const room = new StandardRoom(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                </Room>
            `))
            const originalFeaturesLength = room._payload.features.payload.length
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            
            const result = room._payload.removeReferences([featureRef])
            
            // Original should be unchanged
            expect(room._payload.features.payload.length).toBe(originalFeaturesLength)
            // Result should have the reference removed
            expect(result.features.payload.length).toBe(0)
            // They should be different objects
            expect(result).not.toBe(room._payload)
        })
        
        it('should return unchanged when references array is empty', () => {
            const room = new StandardRoom(deIndentWML(`
                <Room key=(test)>
                    <Feature key=(feat1) />
                </Room>
            `))
            
            const result = room._payload.removeReferences([])
            
            expect(result.features.payload.length).toBe(1)
            expect(result.guidance.payload.length).toBe(0)
            expect(result.characters.payload.length).toBe(0)
        })
    })

    describe('Lens output in schema', () => {
        it('should round-trip Room with Lens containing ShortName', () => {
            const testSource = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(room1) key=(testRoom)>
                        <ShortName>Test Room</ShortName>
                        <Lens uuid=(lens1) key=(testLens)>
                            <ShortName>Test Lens</ShortName>
                        </Lens>
                    </Room>
                </Asset>
            `)
            const testForm = new StandardForm(testSource)
            expect(schemaToWML([testForm.schema])).toEqual(testSource)
        })

        it('should round-trip Room with Lens containing ShortName and Description', () => {
            const testSource = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(room1) key=(testRoom)>
                        <Lens uuid=(lens1) key=(testLens)>
                            <ShortName>Test Lens</ShortName>
                            <Description>Test description.</Description>
                        </Lens>
                    </Room>
                </Asset>
            `)
            const testForm = new StandardForm(testSource)
            expect(schemaToWML([testForm.schema])).toEqual(testSource)
        })

        it('should round-trip Room with Lens containing Marks', () => {
            const testSource = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(room1) key=(testRoom)>
                        <Lens uuid=(lens1) key=(testLens)>
                            <ShortName>Test Lens</ShortName>
                            <Mark uuid=(mark1) key=(mark1)>
                                <ShortName>Test Mark</ShortName>
                            </Mark>
                        </Lens>
                    </Room>
                </Asset>
            `)
            const testForm = new StandardForm(testSource)
            expect(schemaToWML([testForm.schema])).toEqual(testSource)
        })
    })

})