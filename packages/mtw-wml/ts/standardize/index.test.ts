import { Schema, schemaToWML, treeFromWML } from '../schema'
import { StandardForm, hasShortName } from '.'
import { deIndentWML } from '../schema/utils'
import { GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from './components/room'
import StandardKnowledge from './components/knowledge'
import StandardCharacter from './components/character'
import { ReferenceList } from './keys/referenceList'
import StandardReference from './keys/reference'
import { StandardKey } from './keys/key'
import StandardFeature from './components/feature'
import StandardSituation from './components/situation'
import { StandardLiteral } from './literal'
import StandardMap from './components/map'
import StandardMark, { StandardLens } from './components/worldState'
import { StandardMarkFacet } from './keys/facets/mark'
import { StandardExplicitKey } from './explicit/key'
import { isStandardForm, isStandardFormInput, StandardFormData } from './components/dataTypes'
jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardForm', () => {
    describe('standardizeMode', () => {
        it('defaults to asset', () => {
            expect(new StandardForm('ASSET#TestAsset').standardizeMode).toBe('asset')
        })

        it('accepts ephemeraWire via constructor options', () => {
            const sf = new StandardForm(`<Asset uuid=(X) />`, { standardizeMode: 'ephemeraWire' })
            expect(sf.standardizeMode).toBe('ephemeraWire')
        })

        it('includes standardizeMode in toJSON when not asset', () => {
            const sf = new StandardForm(`<Asset uuid=(X)><Room key=(main) /></Asset>`).withStandardizeMode('ephemeraWire')
            expect(sf.toJSON().standardizeMode).toBe('ephemeraWire')
        })

        it('parses Object children under Room in ephemeraWire', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                        <Object uuid=(shovel)>
                            <ShortName>shovel</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            const room = sf._lookup('ROOM#main') as StandardRoom
            expect(room.objects).toEqual([
                { uuid: 'OBJECT#skates', shortName: 'roller skates' },
                { uuid: 'OBJECT#shovel', shortName: 'shovel' },
            ])
            expect((room.toJSON() as { objects?: { uuid: string; shortName: string }[] }).objects).toEqual([
                { uuid: 'OBJECT#skates', shortName: 'roller skates' },
                { uuid: 'OBJECT#shovel', shortName: 'shovel' },
            ])
        })

        it('normalizes Object uuid=(OBJECT#id) same as bare id in ephemeraWire', () => {
            const wmlBare = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const wmlPrefixed = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(OBJECT#skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const roomBare = (new StandardForm(wmlBare, { standardizeMode: 'ephemeraWire' })._lookup('ROOM#main') as StandardRoom)
            const roomPrefixed = (new StandardForm(wmlPrefixed, { standardizeMode: 'ephemeraWire' })._lookup('ROOM#main') as StandardRoom)
            expect(roomBare.objects).toEqual(roomPrefixed.objects)
            expect(roomBare.objects[0].uuid).toBe('OBJECT#skates')
        })

        it('throws when Object uuid has wrong typed prefix', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(ROOM#x)>
                            <ShortName>thing</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            expect(() => treeFromWML(wml)).toThrow(/Invalid type \(ROOM\) in typed string/)
        })

        it('round-trips Object uuid as bare key in WML output', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const tree = treeFromWML(wml)
            const printed = schemaToWML(tree)
            expect(printed).toContain('uuid=(skates)')
            expect(printed).not.toContain('uuid=(OBJECT#')
        })

        it('rejects Object under Room in asset mode (unconsumed tag)', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(skates)>
                            <ShortName>roller skates</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            expect(() => new StandardForm(wml)).toThrow(/Unconsumed child tags: Object/)
        })

        it('throws when Object ShortName is whitespace-only inside Room', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Object uuid=(o1)>
                            <ShortName>   </ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            expect(() => treeFromWML(wml)).toThrow(/Object ShortName must contain non-empty text/)
        })

        it('parses Render under Room in ephemeraWire', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            const room = sf._lookup('ROOM#main') as StandardRoom
            expect(room.render).toEqual({
                displayName: 'Parlor',
                summary: ['A quiet room'],
                description: ['Full prose here.'],
            })
            expect((room.toJSON() as { render?: { displayName: string; summary: unknown; description: unknown } }).render).toEqual({
                displayName: 'Parlor',
                summary: ['A quiet room'],
                description: ['Full prose here.'],
            })
        })

        it('round-trips Render under Room in ephemeraWire', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
            const printed = schemaToWML([sf.schema])
            const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
            expect(schemaToWML([sfAgain.schema])).toEqual(printed)
            const roomAgain = sfAgain._lookup('ROOM#main') as StandardRoom
            expect(roomAgain.render).toEqual({
                displayName: 'Parlor',
                summary: ['A quiet room'],
                description: ['Full prose here.'],
            })
        })

        it('rejects Render under Room in asset mode (unconsumed tag)', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>X</DisplayName>
                            <Summary>Y</Summary>
                            <Description>Z</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            expect(() => new StandardForm(wml)).toThrow(/Unconsumed child tags: Render/)
        })

        it('throws when more than one Render under Room in ephemeraWire', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>A</DisplayName>
                            <Summary>B</Summary>
                            <Description>C</Description>
                        </Render>
                        <Render>
                            <DisplayName>D</DisplayName>
                            <Summary>E</Summary>
                            <Description>F</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            expect(() => new StandardForm(wml, { standardizeMode: 'ephemeraWire' })).toThrow(/Room must contain at most one Render tag/)
        })

        it('throws when Render DisplayName is whitespace-only inside Room', () => {
            const wml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>   </DisplayName>
                            <Summary>Y</Summary>
                            <Description>Z</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            expect(() => treeFromWML(wml)).toThrow(/Render DisplayName must contain non-empty text/)
        })

        /**
         * Ephemera split: one form carries `<Render>` prose; another carries affordances (`<Character>`, `<Object>`).
         * Merge on the same `ROOM#` should combine render payload with objects and character references.
         */
        it('merges ephemeraWire render form with affordance form for the same room UUID', () => {
            const renderWml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
            `)
            const affordanceWml = deIndentWML(`
                <Asset uuid=(Test)>
                    <Room key=(main) uuid=(main)>
                        <Character key=(ally) />
                        <Character key=(npc) />
                        <Object uuid=(crate)>
                            <ShortName>wooden crate</ShortName>
                        </Object>
                        <Object uuid=(lantern)>
                            <ShortName>brass lantern</ShortName>
                        </Object>
                    </Room>
                </Asset>
            `)
            const render = new StandardForm(renderWml, { standardizeMode: 'ephemeraWire' })
            const affordance = new StandardForm(affordanceWml, { standardizeMode: 'ephemeraWire' })
            const final = render.merge(affordance)
            expect(schemaToWML([final.schema])).toEqual(
                deIndentWML(`
                <Asset uuid=(Test)>
                    <Room uuid=(main) key=(main) ref={2}>
                        <Character key=(ally) />
                        <Character key=(npc) />
                        <Object uuid=(crate)><ShortName>wooden crate</ShortName></Object>
                        <Object uuid=(lantern)><ShortName>brass lantern</ShortName></Object>
                        <Render>
                            <DisplayName>Parlor</DisplayName>
                            <Summary>A quiet room</Summary>
                            <Description>Full prose here.</Description>
                        </Render>
                    </Room>
                </Asset>
                `)
            )
        })
    })

    it('should return an empty wrapper unchanged', () => {
        const test = new StandardForm(`<Asset uuid=(Test) />`)
        expect(test.header).toEqual({ tag: 'Asset', universalKey: 'ASSET#Test', topLevel: [] })
        expect(schemaToWML([test.schema])).toEqual(`<Asset uuid=(Test) />`)
    })

    it('should accept parsed schema', () => {
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Situation uuid=(testFeatureBase)>
                        <Description>Four</Description>
                    </Situation>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(DEFAULT) ref={0} />
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Test Room</DisplayName>
                        <Summary>One<br />Two</Summary>
                        <Description>Three</Description>
                    </Situation>
                </Room>
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testSource)
        const test = new StandardForm(schema.schema[0])
        const roomStubByIdWML = deIndentWML(`
            <Room uuid=(test) key=(test)>
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Test Room</DisplayName>
                    <Summary>One<br />Two</Summary>
                    <Description>Three</Description>
                </Situation>
            </Room>
        `)
        expect(schemaToWML([test.byId.test.schema])).toEqual(roomStubByIdWML)
        expect(schemaToWML([test.byUniversalId['ROOM#test'].schema])).toEqual(roomStubByIdWML)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

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

    it('should correctly round-trip a standalone Lens component', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Lens uuid=(lens1) key=(lens1)>
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
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        
        // Verify the lens component
        const lens = test.byUniversalId['LENS#lens1'] as StandardLens
        expect(lens).toBeDefined()
        expect(lens).toBeInstanceOf(StandardLens)
        expect(lens.shortName?.toJSON()).toEqual('Test Lens')
        expect(lens.description?.toJSON()).toEqual(['This is a test lens.'])
        
        // Verify the lens has the mark references
        expect(lens.marks.items.length).toEqual(2)
        expect(lens.marks.items[0].reference.universalKey).toEqual('MARK#mark1')
        expect(lens.marks.items[1].reference.universalKey).toEqual('MARK#mark2')
        
        // Verify the mark components exist
        const mark1 = test.byUniversalId['MARK#mark1'] as StandardMark
        const mark2 = test.byUniversalId['MARK#mark2'] as StandardMark
        expect(mark1).toBeDefined()
        expect(mark1).toBeInstanceOf(StandardMark)
        expect(mark2).toBeDefined()
        expect(mark2).toBeInstanceOf(StandardMark)
        expect(mark1.shortName?.toJSON()).toEqual('First Mark')
        expect(mark2.shortName?.toJSON()).toEqual('Second Mark')
    })

    it('should correctly round-trip a standalone Mark component', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Mark uuid=(mark1) key=(mark1)>
                    <ShortName>Test Mark</ShortName>
                    <Description>This is a test mark.</Description>
                </Mark>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        
        // Verify the mark component
        const mark = test.byUniversalId['MARK#mark1'] as StandardMark
        expect(mark).toBeDefined()
        expect(mark).toBeInstanceOf(StandardMark)
        expect(mark.shortName?.toJSON()).toEqual('Test Mark')
        expect(mark.description?.toJSON()).toEqual(['This is a test mark.'])
    })

    it('should correctly round-trip a Situation with Mark facets', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Mark uuid=(mark1) key=(mark1)>
                    <ShortName>Condition Mark</ShortName>
                    <Description>This is a condition mark.</Description>
                </Mark>
                <Situation uuid=(situation1) key=(situation1)>
                    <ShortName>Situation label</ShortName>
                    <Mark key=(mark1)><Match>Condition narrative</Match></Mark>
                </Situation>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
        
        const mark = test.byUniversalId['MARK#mark1'] as StandardMark
        expect(mark).toBeDefined()
        expect(mark).toBeInstanceOf(StandardMark)
        
        const situation = test.byUniversalId['SITUATION#situation1'] as StandardSituation
        expect(situation).toBeDefined()
        expect(situation).toBeInstanceOf(StandardSituation)
        expect(situation.marks.length).toEqual(1)
        
        const facet = situation.marks.items[0] as StandardMarkFacet
        expect((facet.reference as StandardReference).key).toEqual('mark1')
        expect(facet.payload.toJSON()).toEqual('Condition narrative')
        expect(situation.shortName?.toJSON()).toEqual('Situation label')
    })

    it('should correctly parse Situation with ShortName and hasShortName', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Situation uuid=(situation1) key=(situation1)>
                    <ShortName>Tab label</ShortName>
                </Situation>
            </Asset>
        `)
        const test = new StandardForm(testWML)
        const situation = test.byUniversalId['SITUATION#situation1'] as StandardSituation
        expect(situation).toBeDefined()
        expect(situation).toBeInstanceOf(StandardSituation)
        expect(hasShortName(situation)).toBe(true)
        expect(situation.shortName?.toJSON()).toEqual('Tab label')
    })

    it('should combine exits in rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(testRoom) key=(test)>
                <Situation ref={0} uuid=(testRoomBase) key=(base)>
                    <Description>
                        One
                        <br />
                    </Description>
                </Situation>
            </Room>
            <Room uuid=(testTwo) key=(testTwo) />
            <Room key=(test) ref={0}>
                <Exit to=(testTwo)>Test Exit</Exit>
            </Room>
            <Room key=(testTwo) ref={0}>
                <Exit to=(test)>Test Return</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoom) key=(test)>
                    <Situation key=(base) ref={0}>
                        <Description>One<br /></Description>
                    </Situation>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
                <Room uuid=(testTwo) key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
                <Situation uuid=(testRoomBase) key=(base) ref={0} />
            </Asset>
        `))
    })

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

    it('should correctly return JSON for examples nested in rooms', () => {
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

    it('should correctly return JSON for examples nested in Knowledge', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Knowledge uuid=(test) key=(test)>
                <Situation uuid=(testLocal)>
                    <Description>Description Test</Description>
                </Situation>
            </Knowledge>
        </Asset>`)
        expect(test.toJSON()).toEqual({
            universalKey: 'ASSET#Test',
            metaData: [],
            topLevel: ['KNOWLEDGE#test'],
            components: [{
                tag: 'Knowledge',
                key: 'test',
                universalKey: 'KNOWLEDGE#test',
                situations: [{
                    reference: 'SITUATION#testLocal',
                    payload: { description: ['Description Test'] }
                }]
            },
            {
                universalKey: 'SITUATION#testLocal',
                tag: 'Situation',
            }]
        })
    })

    it('should correct return JSON for examples nested in features nested in rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Feature uuid=(testFeature) key=(testFeature)>
                    <Situation uuid=(testLocal) key=(testLocal)>
                        <Description>Description Test</Description>
                    </Situation>
                </Feature>
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
                features: ['FEATURE#testFeature']
            },
            {
                tag: 'Feature',
                key: 'testFeature',
                universalKey: 'FEATURE#testFeature',
                situations: [{
                    reference: 'SITUATION#testLocal',
                    payload: { description: ['Description Test'] }
                }]
            },
            {
                key: 'testLocal',
                universalKey: 'SITUATION#testLocal',
                tag: 'Situation',
            },
            {
                tag: 'Room',
                key: 'testTwo',
                universalKey: 'ROOM#testTwo',
            }]
        })
    })

    it('should correctly return schema for features nested in rooms', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Feature uuid=(testGlobal) key=(testGlobal) />
            <Room uuid=(test) key=(test)>
                <Feature uuid=(testLocal) key=(testLocal)>
                    <Situation uuid=(testFeatureExample)>
                        <Description>Local</Description>
                    </Situation>
                </Feature>
                <Feature key=(testGlobal)>
                    <Situation uuid=(testGlobalExample)>
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
                    <Situation uuid=(testGlobalExample)>
                        <Description>Global</Description>
                    </Situation>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Feature key=(testGlobal) />
                    <Feature uuid=(testLocal) key=(testLocal)>
                        <Situation uuid=(testFeatureExample)>
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

    it('should correctly return schema for examples nested in knowledge', () => {
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge uuid=(test) key=(test)>
                    <Situation key=(testLocal)>
                        <Description>Description Test</Description>
                    </Situation>
                </Knowledge>
            </Asset>
        `)
        const test = new StandardForm(testSource)
        expect(schemaToWML([test.schema])).toEqual(testSource)
    })

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

    it('should correctly return schema for examples nested in features nested in rooms', () => {
        const testWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(test) key=(test)>
                    <Feature uuid=(testFeature) key=(testFeature)>
                        <Situation key=(testLocal)>
                            <Description>Description Test</Description>
                        </Situation>
                    </Feature>
                </Room>
                <Room uuid=(testTwo) key=(testTwo) />
            </Asset>
        `)
        const test = new StandardForm(testWML)
        expect(schemaToWML([test.schema])).toEqual(testWML)
    })

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
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
            </Message>
            <Room key=(testTwo) ref={0}>
                <Exit to=(test)>Test Return</Exit>
            </Room>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(test) key=(test)>
                    <Situation key=(base) ref={0}>
                        <Description>One<br />Two</Description>
                    </Situation>
                    <Exit to=(testTwo)>Test Exit</Exit>
                </Room>
                <Room uuid=(testTwo) key=(testTwo)>
                    <Exit to=(test)>Test Return</Exit>
                </Room>
                <Message uuid=(testMessage) key=(testMessage)>
                    <Room key=(test) />
                    <Description>Test message</Description>
                </Message>
                <Situation uuid=(testBase) key=(base) ref={0} />
            </Asset>
        `))
    })

    it('should render features and links correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Situation ref={0} uuid=(testBase)>
                    <Description>
                        <Link to=(testFeatureOne)>test</Link>
                    </Description>
                </Situation>
            </Room>
            <Feature uuid=(testFeatureOne) key=(testFeatureOne)>
                <Situation uuid=(testFeatureOneBase)>
                    <DisplayName>TestOne</DisplayName>
                    <Description><Link to=(testFeatureTwo)>two</Link></Description>
                </Situation>
            </Feature>
            <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                <Situation uuid=(testFeatureTwoBase)>
                    <DisplayName>TestTwo</DisplayName>
                    <Description>Test</Description>
                </Situation>
            </Feature>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Feature uuid=(testFeatureOne) key=(testFeatureOne)>
                    <Situation uuid=(testFeatureOneBase)>
                        <DisplayName>TestOne</DisplayName>
                        <Description><Link to=(testFeatureTwo)>two</Link></Description>
                    </Situation>
                </Feature>
                <Feature uuid=(testFeatureTwo) key=(testFeatureTwo)>
                    <Situation uuid=(testFeatureTwoBase)>
                        <DisplayName>TestTwo</DisplayName>
                        <Description>Test</Description>
                    </Situation>
                </Feature>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(testBase) ref={0}>
                        <Description><Link to=(testFeatureOne)>test</Link></Description>
                    </Situation>
                </Room>
                <Situation uuid=(testBase) ref={0} />
            </Asset>
        `))
    })

    it('should render knowledge correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Room uuid=(test) key=(test)>
                <Situation ref={0} uuid=(testBase)>
                    <Description>
                        <Link to=(testKnowledgeOne)>test</Link>
                    </Description>
                </Situation>
            </Room>
            <Knowledge uuid=(testKnowledgeOne) key=(testKnowledgeOne)>
                <Situation uuid=(testKnowledgeOneBase)>
                    <DisplayName>TestOne</DisplayName>
                    <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                </Situation>
            </Knowledge>
            <Knowledge uuid=(testKnowledgeTwo) key=(testKnowledgeTwo)>
                <Situation uuid=(testKnowledgeTwoBase)>
                    <DisplayName>TestTwo</DisplayName>
                    <Description>Test</Description>
                </Situation>
            </Knowledge>
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge uuid=(testKnowledgeOne) key=(testKnowledgeOne)>
                    <Situation uuid=(testKnowledgeOneBase)>
                        <DisplayName>TestOne</DisplayName>
                        <Description><Link to=(testKnowledgeTwo)>two</Link></Description>
                    </Situation>
                </Knowledge>
                <Knowledge uuid=(testKnowledgeTwo) key=(testKnowledgeTwo)>
                    <Situation uuid=(testKnowledgeTwoBase)>
                        <DisplayName>TestTwo</DisplayName>
                        <Description>Test</Description>
                    </Situation>
                </Knowledge>
                <Room uuid=(test) key=(test)>
                    <Situation uuid=(testBase) ref={0}>
                        <Description><Link to=(testKnowledgeOne)>test</Link></Description>
                    </Situation>
                </Room>
                <Situation uuid=(testBase) ref={0} />
            </Asset>
        `))
    })

    it('should render maps correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Map uuid=(testMap) key=(testMap)>
                <ShortName>Test map</ShortName>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Position {0, 0} />
                    <Situation ref={0} uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomOne) key=(testRoomOne) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Position {-100, 0} />
                    <Situation ref={0} uuid=(testRoomTwoBase)>
                        <Description>Test Room Two</Description>
                    </Situation>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) />
                <Image key=(mapBackground) />
            </Map>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) />
            <Room uuid=(testRoomThree) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomThree) key=(testRoomThree) />
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation uuid=(testRoomTwoBase) ref={0}>
                        <Description>Test Room Two</Description>
                    </Situation>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
                <Map uuid=(testMap) key=(testMap)>
                    <ShortName>Test map</ShortName>
                    <Image key=(mapBackground) />
                    <Room key=(testRoomOne)><Position {0, 0} /></Room>
                    <Room key=(testRoomTwo)><Position {-100, 0} /></Room>
                </Map>
                <Situation uuid=(testRoomOneBase) ref={0} />
                <Situation uuid=(testRoomTwoBase) ref={0} />
            </Asset>
        `))
    })

    it('should render empty maps', () => {
        const test = new StandardForm(`<Asset uuid=(Test)><Map uuid=(testMap) key=(testMap) /></Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)><Map uuid=(testMap) key=(testMap) /></Asset>
        `))
    })

    it('should render messages correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Message uuid=(testMessage) key=(testMessage)>
                <Description>Test message</Description>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation ref={0} uuid=(testRoomOneBase)>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation ref={0} uuid=(testRoomTwoBase)>
                        <Description>Test Room Two</Description>
                    </Situation>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
            </Message>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo)>
                    <Situation uuid=(testRoomTwoBase) ref={0}>
                        <Description>Test Room Two</Description>
                    </Situation>
                    <Exit to=(testRoomOne)>one</Exit>
                </Room>
                <Message uuid=(testMessage) key=(testMessage)>
                    <Room key=(testRoomOne) />
                    <Room key=(testRoomTwo) />
                    <Description>Test message</Description>
                </Message>
                <Situation uuid=(testRoomOneBase) ref={0} />
                <Situation uuid=(testRoomTwoBase) ref={0} />
            </Asset>
        `))
    })

    it('should render moments correctly', () => {
        const test = new StandardForm(`<Asset uuid=(Test)>
            <Moment uuid=(testMoment) key=(testMoment)>
                <Message uuid=(testMessage) key=(testMessage)>
                    <Description>Test message</Description>
                    <Room uuid=(testRoomOne) key=(testRoomOne)>
                        <Situation ref={0} uuid=(testRoomOneBase)>
                            <Description>Test Room One</Description>
                        </Situation>
                        <Exit to=(testRoomTwo)>two</Exit>
                    </Room>
                </Message>
            </Moment>
            <Room uuid=(testRoomOne) />
            <Room uuid=(testRoomTwo) key=(testRoomTwo) />
        </Asset>`)
        expect(schemaToWML([test.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(testRoomOne) key=(testRoomOne)>
                    <Situation uuid=(testRoomOneBase) ref={0}>
                        <Description>Test Room One</Description>
                    </Situation>
                    <Exit to=(testRoomTwo)>two</Exit>
                </Room>
                <Room uuid=(testRoomTwo) key=(testRoomTwo) />
                <Moment uuid=(testMoment) key=(testMoment)>
                    <Message uuid=(testMessage) key=(testMessage)>
                        <Room key=(testRoomOne) />
                        <Description>Test message</Description>
                    </Message>
                </Moment>
                <Situation uuid=(testRoomOneBase) ref={0} />
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

    it('should allow nested Situation facet edits in edit mode', () => {
        const baseForm = new StandardForm(`<Asset uuid=(Test)>
            <Room key=(testRoom)>
                <Situation ref={0} uuid=(room-example)>
                    <DisplayName>Lobby</DisplayName>
                    <Description>A sterile corporate lobby.</Description>
                </Situation>
            </Room>
        </Asset>`)

        const editForm = new StandardForm(`<Asset uuid=(Test)>
            <Room key=(testRoom) ref={0}>
                <Situation uuid=(room-example) ref={0}>
                    <Replace><DisplayName>Lobby</DisplayName></Replace><With><DisplayName>Grand Foyer</DisplayName></With>
                </Situation>
            </Room>
        </Asset>`)

        const mergedForm = baseForm.merge(editForm)
        
        expect(schemaToWML([mergedForm.schema])).toEqual(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(testRoom)>
                    <Situation uuid=(room-example) ref={0}>
                        <DisplayName>Grand Foyer</DisplayName>
                        <Description>A sterile corporate lobby.</Description>
                    </Situation>
                </Room>
            </Asset>
        `))
    })

})
