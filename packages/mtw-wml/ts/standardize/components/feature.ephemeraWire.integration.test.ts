import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardFeature from './feature'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardFeature ephemeraWire integration', () => {
    it('parses Render under Feature in ephemeraWire', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature key=(fountain) uuid=(fountain)>
                    <Render>
                        <DisplayName>Fountain</DisplayName>
                        <Summary>Sparkling water</Summary>
                        <Description>A marble fountain.</Description>
                    </Render>
                </Feature>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const feature = sf._lookup('FEATURE#fountain') as StandardFeature
        expect(feature.render).toEqual({
            displayName: 'Fountain',
            summary: ['Sparkling water'],
            description: ['A marble fountain.'],
        })
    })

    it('round-trips Render under Feature in ephemeraWire', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature key=(fountain) uuid=(fountain)>
                    <Render>
                        <DisplayName>Fountain</DisplayName>
                        <Summary>Sparkling water</Summary>
                        <Description>A marble fountain.</Description>
                    </Render>
                </Feature>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
    })

    it('round-trips Render under Feature with only DisplayName present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature key=(fountain) uuid=(fountain)>
                    <Render>
                        <DisplayName>Fountain</DisplayName>
                    </Render>
                </Feature>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const feature = sfAgain._lookup('FEATURE#fountain') as StandardFeature
        expect(feature.render).toEqual({ displayName: 'Fountain' })
    })

    it('round-trips Render under Feature with only DisplayName and Description present (guest-character shape)', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature key=(fountain) uuid=(fountain)>
                    <Render>
                        <DisplayName>Fountain</DisplayName>
                        <Description>A marble fountain.</Description>
                    </Render>
                </Feature>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const feature = sfAgain._lookup('FEATURE#fountain') as StandardFeature
        expect(feature.render).toEqual({ displayName: 'Fountain', description: ['A marble fountain.'] })
    })

    it('round-trips Render under Feature with only DisplayName and Summary present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Feature key=(fountain) uuid=(fountain)>
                    <Render>
                        <DisplayName>Fountain</DisplayName>
                        <Summary>Sparkling water</Summary>
                    </Render>
                </Feature>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const feature = sfAgain._lookup('FEATURE#fountain') as StandardFeature
        expect(feature.render).toEqual({ displayName: 'Fountain', summary: ['Sparkling water'] })
    })
})
