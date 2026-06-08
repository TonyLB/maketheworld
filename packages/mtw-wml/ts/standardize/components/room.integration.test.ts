import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardRoom from './room'
import StandardCharacter from './character'
import { StandardLens } from './worldState'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardRoom integration', () => {
    describe('Removed Feature references', () => {
            it('should correctly round-trip a removed feature reference in a room', () => {
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(base) key=(base) />
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Remove><Feature key=(base) /></Remove>
                        </Room>
                    </Asset>
                `)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(base) key=(base) />
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Remove><Feature key=(base) /></Remove>
                        </Room>
                    </Asset>
                `))
            })

            it('should correctly round-trip a removed feature nested in a room', () => {
                const test = new StandardForm(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Remove>
                                <Feature uuid=(base) />
                            </Remove>
                        </Room>
                    </Asset>
                `)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <Remove><Feature uuid=(base) /></Remove>
                        </Room>
                    </Asset>
                `))
            })
    })

    describe('Lens in Room', () => {
            it('should correctly round-trip a room with lenses containing marks', () => {
                const testWML = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(testRoom) key=(testRoom)>
                            <ShortName>Test Room</ShortName>
                            <Lens uuid=(lens1)>
                                <ShortName>Test Lens</ShortName>
                                <Description>This is a test lens.</Description>
                                <Mark uuid=(mark1)>
                                    <ShortName>First Mark</ShortName>
                                    <Description>This is a first mark.</Description>
                                </Mark>
                                <Mark uuid=(mark2)>
                                    <ShortName>Second Mark</ShortName>
                                    <Description>This is a second mark.</Description>
                                </Mark>
                            </Lens>
                        </Room>
                    </Asset>
                `)
                const test = new StandardForm(testWML)
                expect(schemaToWML([test.schema])).toEqual(testWML)
                
                // Verify the room has the lens reference
                const room = test.byUniversalId['ROOM#testRoom'] as StandardRoom
                expect(room).toBeDefined()
                expect(room.lens.payload.length).toEqual(1)
                expect(room.lens.payload[0].universalKey).toEqual('LENS#lens1')
                expect(room.lens.payload[0].tag).toEqual('Lens')
                
                // Verify the lens has the mark references
                const lens = test.byUniversalId['LENS#lens1'] as StandardLens
                expect(lens).toBeDefined()
                expect(lens).toBeInstanceOf(StandardLens)
                expect(lens.marks.items.length).toEqual(2)
                expect(lens.marks.items[0].reference.universalKey).toEqual('MARK#mark1')
                expect(lens.marks.items[1].reference.universalKey).toEqual('MARK#mark2')
            })

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

    describe('Situation facets on Room', () => {
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
    })

    describe('Situation nesting', () => {
            it('should correctly return JSON for features nested in rooms', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Feature uuid=(testGlobal) key=(testGlobal) />
                    <Room uuid=(testRoom) key=(test)>
                        <Situation ref={0} uuid=(testRoomBase)><Description>One</Description></Situation>
                        <Feature uuid=(testLocal) key=(testLocal)>
                            <Situation uuid=(testLocalBase)><Description>Local</Description></Situation>
                        </Feature>
                        <Feature uuid=(testGlobal) key=(testGlobal)>
                            <Situation uuid=(testGlobalBase)><Description>Global</Description></Situation>
                        </Feature>
                    </Room>
                    <Room uuid=(testTwo) key=(testTwo) />
                </Asset>`)
                expect(test.toJSON()).toEqual({
                    universalKey: 'ASSET#Test',
                    metaData: [],
                    topLevel: [
                        'FEATURE#testGlobal',
                        'ROOM#testRoom',
                        'ROOM#testTwo'
                    ],
                    components: [{
                        tag: 'Feature',
                        key: 'testGlobal',
                        universalKey: 'FEATURE#testGlobal',
                        shortName: undefined,
                        situations: [{
                            reference: 'SITUATION#testGlobalBase',
                            payload: { description: ['Global'] }
                        }]
                    },
                    {
                        key: undefined,
                        tag: 'Situation',
                        universalKey: 'SITUATION#testGlobalBase',
                    },
                    {
                        tag: 'Room',
                        key: 'test',
                        universalKey: 'ROOM#testRoom',
                        shortName: undefined,
                        situations: [{
                            reference: {
                                universalKey: 'SITUATION#testRoomBase',
                                tag: 'Situation',
                                ref: 0
                            },
                            payload: { description: ['One'] }
                        }],
                        features: ['FEATURE#testLocal', 'FEATURE#testGlobal']
                    },
                    {
                        tag: 'Feature',
                        key: 'testLocal',
                        universalKey: 'FEATURE#testLocal',
                        shortName: undefined,
                        situations: [{
                            reference: 'SITUATION#testLocalBase',
                            payload: { description: ['Local'] }
                        }]
                    },
                    {
                        key: undefined,
                        tag: 'Situation',
                        universalKey: 'SITUATION#testLocalBase',
                    },
                    {
                        tag: 'Room',
                        key: 'testTwo',
                        universalKey: 'ROOM#testTwo',
                        shortName: undefined,
                    },
                    {
                        key: undefined,
                        universalKey: 'SITUATION#testRoomBase',
                        tag: 'Situation',
                    }]
                })
            })
            it('should correctly return JSON for situations nested in rooms', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Room uuid=(test) key=(test)>
                        <Situation ref={0} uuid=(testLocal)>
                            <Description>Description Test</Description>
                        </Situation>
                    </Room>
                    <Room uuid=(testTwo) key=(testTwo) />
                </Asset>`)
                expect(test.toJSON()).toEqual({
                    universalKey: 'ASSET#Test',
                    metaData: [],
                    topLevel: [
                        'ROOM#test',
                        'ROOM#testTwo'
                    ],
                    components: [{
                        tag: 'Room',
                        key: 'test',
                        universalKey: 'ROOM#test',
                        shortName: undefined,
                        situations: [{
                            reference: {
                                universalKey: 'SITUATION#testLocal',
                                tag: 'Situation',
                                ref: 0
                            },
                            payload: { description: ['Description Test'] }
                        }],
                    },
                    {
                        tag: 'Room',
                        key: 'testTwo',
                        universalKey: 'ROOM#testTwo',
                        shortName: undefined,
                    },
                    {
                        universalKey: 'SITUATION#testLocal',
                        tag: 'Situation',
                    }]
                })
            })
            it('should correctly return schema for features nested in rooms', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Feature uuid=(testGlobal) key=(testGlobal) />
                    <Room uuid=(test) key=(test)>
                        <Feature uuid=(testLocal) key=(testLocal)>
                            <Situation uuid=(testFeatureSituation)>
                                <Description>Local</Description>
                            </Situation>
                        </Feature>
                        <Feature key=(testGlobal)>
                            <Situation uuid=(testGlobalSituation)>
                                <Description>Global</Description>
                            </Situation>
                        </Feature>
                        <Situation ref={0} uuid=(testBase)><Description>One</Description></Situation>
                    </Room>
                    <Room uuid=(testTwo) key=(testTwo) />
                </Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Feature uuid=(testGlobal) key=(testGlobal)>
                            <Situation uuid=(testGlobalSituation)>
                                <Description>Global</Description>
                            </Situation>
                        </Feature>
                        <Room uuid=(test) key=(test)>
                            <Feature key=(testGlobal) />
                            <Feature uuid=(testLocal) key=(testLocal)>
                                <Situation uuid=(testFeatureSituation)>
                                    <Description>Local</Description>
                                </Situation>
                            </Feature>
                            <Situation uuid=(testBase) ref={0}>
                                <Description>One</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testTwo) key=(testTwo) />
                        <Situation uuid=(testBase) ref={0} />
                    </Asset>
                `))
            })
    })

    describe('Gate D hoisting', () => {
            it('hoists a room default Situation stub to asset scope in schema output (Gate D)', () => {
                const wml = deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room key=(r1)>
                            <Situation ref={0} uuid=(e1)><Description>x</Description></Situation>
                        </Room>
                    </Asset>
                `)
                const printed = schemaToWML([new StandardForm(wml).schema])
                expect(printed).toContain('Situation uuid=(e1) ref={0}')
                expect(printed).toContain('<Description>x</Description>')
            })
    })

    describe('Nested room render', () => {
            it('should combine render in nested rooms', () => {
                const test = new StandardForm(`<Asset uuid=(Test)>
                    <Room uuid=(test) key=(test)>
                        <Situation ref={0} uuid=(testBase) key=(base)>
                            <Description>
                                One
                                <br />
                            </Description>
                        </Situation>
                    </Room>
                    <Room uuid=(testTwo) key=(testTwo) />
                    <Message uuid=(testMessage) key=(testMessage)>
                        <Description>Test message</Description>
                        <Room uuid=(test) key=(test)>
                            <Situation key=(base) ref={0}>
                                <Description>
                                    Two
                                </Description>
                            </Situation>
                        </Room>
                    </Message>
                </Asset>`)
                expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room uuid=(test) key=(test)>
                            <Situation key=(base) ref={0}>
                                <Description>One<br />Two</Description>
                            </Situation>
                        </Room>
                        <Room uuid=(testTwo) key=(testTwo) />
                        <Message uuid=(testMessage) key=(testMessage)>
                            <Room key=(test) />
                            <Description>Test message</Description>
                        </Message>
                        <Situation uuid=(testBase) key=(base) ref={0} />
                    </Asset>
                `))
            })
    })

    describe('Character references', () => {
            it('should integrate characters with rooms in StandardForm.schema scenarios', () => {
                // Create a complex scenario with characters defined both as separate components
                // and as sub-components of rooms
                const testWML = deIndentWML(`
                    <Asset uuid=(test)>
                        <Character uuid=(char1) key=(char1)>
                            <ShortName>Alice</ShortName>
                            <DisplayName>Alice</DisplayName>
                        </Character>
                        <Character uuid=(char2) key=(char2)>
                            <ShortName>Bob</ShortName>
                            <DisplayName>Bob</DisplayName>
                        </Character>
                        <Room uuid=(room1) key=(room1)>
                            <Character key=(char3)>
                                <ShortName>Charlie</ShortName>
                                <DisplayName>Charlie</DisplayName>
                            </Character>
                            <Character uuid=(char1) />
                        </Room>
                        <Room uuid=(room2) key=(room2)>
                            <Character uuid=(char2) />
                            <Character key=(char4)>
                                <ShortName>David</ShortName>
                                <DisplayName>David</DisplayName>
                            </Character>
                        </Room>
                    </Asset>
                `)
                const test = new StandardForm(testWML).finalize()
                
                // Test that characters are correctly parsed and stored
                const room1 = test._lookup('ROOM#room1') as StandardRoom
                const room2 = test._lookup('ROOM#room2') as StandardRoom
                const char1 = test._lookup('CHARACTER#char1') as StandardCharacter
                const char2 = test._lookup('CHARACTER#char2') as StandardCharacter
                
                expect(room1).toBeInstanceOf(StandardRoom)
                expect(room2).toBeInstanceOf(StandardRoom)
                expect(char1).toBeInstanceOf(StandardCharacter)
                expect(char2).toBeInstanceOf(StandardCharacter)
                
                // Test that rooms have the correct character references
                expect(room1.characters).toBeDefined()
                expect(room1.characters!.payload.length).toBe(2)
                expect(room2.characters).toBeDefined()
                expect(room2.characters!.payload.length).toBe(2)
                
                // Test that character references include both local and universal keys
                const room1CharKeys = room1.characters!.payload.map(ref => ref.key || ref.universalKey)
                const room2CharKeys = room2.characters!.payload.map(ref => ref.key || ref.universalKey)
                
                expect(room1CharKeys).toContain('char3') // Local character in room1
                expect(room1CharKeys).toContain('CHARACTER#char1') // Universal character reference in room1
                expect(room2CharKeys).toContain('CHARACTER#char2') // Universal character reference in room2
                expect(room2CharKeys).toContain('char4') // Local character in room2
                
                // Test that StandardForm.schema includes character references in room contexts
                const schemaWML = schemaToWML([test.schema])
                
                // Verify that the schema includes character references within room contexts
                // Note: StandardForm.schema includes full character content, not just references
                expect(schemaWML).toEqual(deIndentWML(`
                    <Asset uuid=(test)>
                        <Character uuid=(char1) key=(char1)>
                            <ShortName>Alice</ShortName>
                            <DisplayName>Alice</DisplayName>
                        </Character>
                        <Character uuid=(char2) key=(char2)>
                            <ShortName>Bob</ShortName>
                            <DisplayName>Bob</DisplayName>
                        </Character>
                        <Room uuid=(room1) key=(room1)>
                            <Character key=(char1) />
                            <Character uuid=(mock-uuid-1) key=(char3)>
                                <ShortName>Charlie</ShortName>
                                <DisplayName>Charlie</DisplayName>
                            </Character>
                        </Room>
                        <Room uuid=(room2) key=(room2)>
                            <Character key=(char2) />
                            <Character uuid=(mock-uuid-2) key=(char4)>
                                <ShortName>David</ShortName>
                                <DisplayName>David</DisplayName>
                            </Character>
                        </Room>
                    </Asset>
                `))
            })

            it('should handle complex WML parsing with nested character references', () => {
                const complexWML = deIndentWML(`
                    <Asset uuid=(complex)>
                        <Character uuid=(global1) key=(global1)>
                            <ShortName>Global1</ShortName>
                            <DisplayName>Global Character 1</DisplayName>
                        </Character>
                        <Character uuid=(global2) key=(global2)>
                            <ShortName>Global2</ShortName>
                            <DisplayName>Global Character 2</DisplayName>
                        </Character>
                        <Room uuid=(mainRoom) key=(mainRoom)>
                            <Character key=(local1)>
                                <ShortName>Local1</ShortName>
                                <DisplayName>Local Character 1</DisplayName>
                            </Character>
                            <Character uuid=(global1) />
                            <Character key=(local2)>
                                <ShortName>Local2</ShortName>
                                <DisplayName>Local Character 2</DisplayName>
                            </Character>
                        </Room>
                        <Room uuid=(sideRoom) key=(sideRoom)>
                            <Character uuid=(global2) />
                            <Character key=(local3)>
                                <ShortName>Local3</ShortName>
                                <DisplayName>Local Character 3</DisplayName>
                            </Character>
                        </Room>
                    </Asset>
                `)
                
                const form = new StandardForm(complexWML)
                const mainRoom = form._lookup('ROOM#mainRoom') as StandardRoom
                const sideRoom = form._lookup('ROOM#sideRoom') as StandardRoom
                
                // Verify character counts
                expect(mainRoom.characters).toBeDefined()
                expect(mainRoom.characters!.payload.length).toBe(3)
                expect(sideRoom.characters).toBeDefined()
                expect(sideRoom.characters!.payload.length).toBe(2)
                
                // Verify character types (local vs universal)
                const mainRoomKeys = mainRoom.characters!.payload.map(ref => ref.key || ref.universalKey)
                const sideRoomKeys = sideRoom.characters!.payload.map(ref => ref.key || ref.universalKey)
                
                expect(mainRoomKeys).toContain('local1')
                expect(mainRoomKeys).toContain('CHARACTER#global1')
                expect(mainRoomKeys).toContain('local2')
                expect(sideRoomKeys).toContain('CHARACTER#global2')
                expect(sideRoomKeys).toContain('local3')
            })

            it('should perform complete serialization round-trip with character references', () => {
                const originalWML = deIndentWML(`
                    <Asset uuid=(roundtrip)>
                        <Character uuid=(char1) key=(char1)>
                            <ShortName>Test</ShortName>
                            <DisplayName>Test Character</DisplayName>
                        </Character>
                        <Room uuid=(room1) key=(room1)>
                            <Character key=(char1) />
                            <Character uuid=(local1) key=(local1)>
                                <ShortName>Local</ShortName>
                                <DisplayName>Local Character</DisplayName>
                            </Character>
                        </Room>
                    </Asset>
                `)
                
                // WML → StandardForm
                const form1 = new StandardForm(originalWML)
                
                // StandardForm → JSON
                const jsonData = form1.toJSON()
                
                // JSON → StandardForm
                const form2 = new StandardForm(jsonData)
                
                // Verify the round-trip preserved character references
                const room1 = form2._lookup('ROOM#room1') as StandardRoom
                expect(room1.characters!.payload.length).toBe(2)
                
                const charKeys = room1.characters!.payload.map(ref => ref.key || ref.universalKey)
                expect(charKeys).toContain('local1')
                expect(charKeys).toContain('char1')

                // StandardForm → WML
                const finalWML = schemaToWML([form2.schema])
                
                // Verify the final WML contains character references
                expect(finalWML).toEqual(originalWML)
            })

            it('should handle empty character lists correctly in integration', () => {
                const emptyWML = deIndentWML(`
                    <Asset uuid=(empty)>
                        <Room uuid=(room1) key=(room1)>
                            <DisplayName>Empty Room</DisplayName>
                        </Room>
                    </Asset>
                `)
                
                const form = new StandardForm(emptyWML)
                const room = form._lookup('ROOM#room1') as StandardRoom
                
                // Verify empty character list
                expect(room.characters.payload.length).toBe(0)
                
                // Verify serialization works with empty list
                const jsonData = form.toJSON()
                const reconstructedForm = new StandardForm(jsonData)
                const reconstructedRoom = reconstructedForm._lookup('ROOM#room1') as StandardRoom
                
                expect(reconstructedRoom.characters.payload.length).toBe(0)
            })

            it('should handle characters correctly', () => {
                const testSource = deIndentWML(`
                    <Asset uuid=(test)>
                        <Character key=(Tess)>
                            <DisplayName>Tess</DisplayName>
                            <Image key=(TessIcon) />
                        </Character>
                        <Image key=(TessIcon) />
                    </Asset>
                `)
                const test = new StandardForm(testSource)
                expect(test.byId.Tess instanceof StandardCharacter).toBe(true)
                expect(schemaToWML([test.schema])).toEqual(testSource)
            })
    })
})
