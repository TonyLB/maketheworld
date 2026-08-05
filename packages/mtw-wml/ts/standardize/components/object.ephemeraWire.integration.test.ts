import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardObject from './object'
import StandardRoom from './room'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardObject ephemeraWire integration', () => {
    it('parses top-level Object under Asset in ephemeraWire', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                </Object>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = sf._lookup('OBJECT#skates') as StandardObject
        expect(object).toBeInstanceOf(StandardObject)
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
        expect(sf._components.filter((c) => c instanceof StandardObject)).toHaveLength(1)
    })

    it('keeps room-nested Object on StandardRoom.objects, not top-level components', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(main) uuid=(main)>
                    <Object uuid=(skates)>
                        <ShortName>roller skates</ShortName>
                    </Object>
                </Room>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const room = sf._lookup('ROOM#main') as StandardRoom
        expect(room.objects).toEqual([{ uuid: 'OBJECT#skates', shortName: 'roller skates' }])
        expect(sf._components.filter((c) => c instanceof StandardObject)).toHaveLength(0)
    })
})

describe('StandardObject Render round-trip', () => {
    it('round-trips Render under Object with all three fields present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>Skateboard</ShortName>
                    <Render>
                        <DisplayName>Skateboard</DisplayName>
                        <Summary>A rocket skateboard</Summary>
                        <Description>Rocket motor on the rear.</Description>
                    </Render>
                </Object>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const object = sfAgain._lookup('OBJECT#skates') as StandardObject
        expect(object.render).toEqual({
            displayName: 'Skateboard',
            summary: ['A rocket skateboard'],
            description: ['Rocket motor on the rear.'],
        })
    })

    it('round-trips Render under Object with only DisplayName present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>Skateboard</ShortName>
                    <Render>
                        <DisplayName>Skateboard</DisplayName>
                    </Render>
                </Object>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const object = sfAgain._lookup('OBJECT#skates') as StandardObject
        expect(object.render).toEqual({ displayName: 'Skateboard' })
    })

    it('round-trips Render under Object with only DisplayName and Description present (guest-character shape)', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>Skateboard</ShortName>
                    <Render>
                        <DisplayName>Skateboard</DisplayName>
                        <Description>Rocket motor on the rear.</Description>
                    </Render>
                </Object>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const object = sfAgain._lookup('OBJECT#skates') as StandardObject
        expect(object.render).toEqual({ displayName: 'Skateboard', description: ['Rocket motor on the rear.'] })
    })

    it('round-trips Render under Object with only DisplayName and Summary present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>Skateboard</ShortName>
                    <Render>
                        <DisplayName>Skateboard</DisplayName>
                        <Summary>A rocket skateboard</Summary>
                    </Render>
                </Object>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const object = sfAgain._lookup('OBJECT#skates') as StandardObject
        expect(object.render).toEqual({ displayName: 'Skateboard', summary: ['A rocket skateboard'] })
    })
})
