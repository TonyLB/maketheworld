import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardRoom from '../components/room'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardForm.standardizeMode', () => {
    it('includes standardizeMode in toJSON when not asset', () => {
        const sf = new StandardForm(`<Asset uuid=(X)><Room key=(main) /></Asset>`).withStandardizeMode('ephemeraWire')
        expect(sf.toJSON().standardizeMode).toBe('ephemeraWire')
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
