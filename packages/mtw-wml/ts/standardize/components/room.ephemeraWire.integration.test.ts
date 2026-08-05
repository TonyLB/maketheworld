import { schemaToWML, treeFromWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardRoom from './room'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardRoom ephemeraWire integration', () => {
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

    it('round-trips Render under Room with only DisplayName present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Render>
                        <DisplayName>Parlor</DisplayName>
                    </Render>
                </Room>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const roomAgain = sfAgain._lookup('ROOM#main') as StandardRoom
        expect(roomAgain.render).toEqual({ displayName: 'Parlor' })
    })

    it('round-trips Render under Room with only DisplayName and Description present (guest-character shape)', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Render>
                        <DisplayName>Parlor</DisplayName>
                        <Description>Full prose here.</Description>
                    </Render>
                </Room>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const roomAgain = sfAgain._lookup('ROOM#main') as StandardRoom
        expect(roomAgain.render).toEqual({ displayName: 'Parlor', description: ['Full prose here.'] })
    })

    it('round-trips Render under Room with only DisplayName and Summary present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Render>
                        <DisplayName>Parlor</DisplayName>
                        <Summary>A quiet room</Summary>
                    </Render>
                </Room>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const roomAgain = sfAgain._lookup('ROOM#main') as StandardRoom
        expect(roomAgain.render).toEqual({ displayName: 'Parlor', summary: ['A quiet room'] })
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

    it('parses legacy Exit to= under Room in ephemeraWire', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Exit to=(target)>exit label</Exit>
                </Room>
                <Room key=(target) uuid=(target) />
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const room = sf._lookup('ROOM#main') as StandardRoom
        expect(room.exits.toJSON()).toEqual([{ reference: { tag: 'Room', key: 'target' }, payload: 'exit label' }])
    })

    it('round-trips Exit under Room in ephemeraWire schema', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Exit to=(target)>north</Exit>
                </Room>
                <Room key=(target) uuid=(target) />
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(printed).toContain('<Exit to=(target)>north</Exit>')
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        const roomAgain = sfAgain._lookup('ROOM#main') as StandardRoom
        expect(roomAgain.exits.toJSON()).toEqual([{ reference: { tag: 'Room', key: 'target' }, payload: 'north' }])
    })

    it('collapses a whitespace-only Render DisplayName to absent (RA-2) at the schema-converter layer', () => {
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
        const expectedWML = deIndentWML(`
            <Asset uuid=(Test)>
                <Room uuid=(main) key=(main)>
                    <Render>
                        <Summary>Y</Summary>
                        <Description>Z</Description>
                    </Render>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(treeFromWML(wml))).toEqual(expectedWML)
    })
})
