import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardRoom from '../components/room'
import { ExitFacetList, StandardExitFacet } from '../keys/facets/exit'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardForm.standardizeMode', () => {
    it('uses standardizeMode from JSON data when constructor options also specify mode', () => {
        const sf = new StandardForm(
            {
                universalKey: 'ASSET#Test',
                metaData: [],
                components: [],
                standardizeMode: 'ephemeraWire',
            },
            { standardizeMode: 'asset' },
        )
        expect(sf.standardizeMode).toBe('ephemeraWire')
    })

    it('uses constructor options when data omits standardizeMode', () => {
        const sf = new StandardForm(
            {
                universalKey: 'ASSET#Test',
                metaData: [],
                components: [],
            },
            { standardizeMode: 'ephemeraWire' },
        )
        expect(sf.standardizeMode).toBe('ephemeraWire')
    })

    it('includes standardizeMode in toJSON when not asset', () => {
        const sf = new StandardForm(`<Asset uuid=(X)><Room key=(main) /></Asset>`).withStandardizeMode('ephemeraWire')
        expect(sf.toJSON().standardizeMode).toBe('ephemeraWire')
    })

    it('rejects Object under Room in asset mode', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Object uuid=(skates)>
                        <ShortName>roller skates</ShortName>
                    </Object>
                </Room>
            </Asset>
        `)
        expect(() => new StandardForm(wml)).toThrow(/Room objects are not allowed in asset mode/)
    })

    it('rejects top-level Object under Asset in asset mode', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                </Object>
            </Asset>
        `)
        expect(() => new StandardForm(wml)).toThrow(/Object components are not allowed in asset mode/)
    })

    it('allows top-level Object under Asset in ephemeraWire mode', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                </Object>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        expect(sf._lookup('OBJECT#skates')).toBeDefined()
    })

    it('serializes wire exits after in-memory mutation bypassing validate (mutation hazard)', () => {
        const sf = new StandardForm(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main) />
                <Room key=(target) uuid=(target) />
            </Asset>
        `))
        const room = sf._lookup('ROOM#main') as StandardRoom
        const mutated = room.clone() as StandardRoom
        mutated._payload._exits = new ExitFacetList([
            new StandardExitFacet({
                reference: { tag: 'Room', key: 'target' },
                payload: 'north',
            }),
        ])
        const roomIndex = sf._components.findIndex((c) => c.universalKey === 'ROOM#main')
        sf._components[roomIndex] = mutated
        expect(schemaToWML([sf.schema])).toContain('<Exit')
        expect((sf.toJSON().components.find((c) => c.tag === 'Room' && c.key === 'main') as { exits?: unknown }).exits).toBeDefined()
    })

    it('validate rejects asset form after in-memory wire mutation', () => {
        const sf = new StandardForm(deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main) />
                <Room key=(target) uuid=(target) />
            </Asset>
        `))
        const room = sf._lookup('ROOM#main') as StandardRoom
        const mutated = room.clone() as StandardRoom
        mutated._payload._exits = new ExitFacetList([
            new StandardExitFacet({
                reference: { tag: 'Room', key: 'target' },
                payload: 'north',
            }),
        ])
        const roomIndex = sf._components.findIndex((c) => c.universalKey === 'ROOM#main')
        sf._components[roomIndex] = mutated
        expect(() => sf.validate()).toThrow(/Room exits are not allowed in asset mode/)
    })

    it('rejects Exit under Room in asset mode', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Exit to=(north)>north</Exit>
                </Room>
            </Asset>
        `)
        expect(() => new StandardForm(wml)).toThrow(/Room exits are not allowed in asset mode/)
    })

    it('rejects Render under Room in asset mode', () => {
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
        expect(() => new StandardForm(wml)).toThrow(/Room render is not allowed in asset mode/)
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
