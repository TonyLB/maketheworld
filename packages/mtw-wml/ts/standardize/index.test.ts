import { Schema, schemaToWML, treeFromWML } from '../schema'
import { StandardForm } from '.'
import { deIndentWML } from '../schema/utils'
import StandardRoom from './components/room'
import StandardSituation from './components/situation'

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
})
