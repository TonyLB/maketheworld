import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardKnowledge from './knowledge'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardKnowledge ephemeraWire integration', () => {
    it('parses Render under Knowledge in ephemeraWire', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge key=(lore) uuid=(lore)>
                    <Render>
                        <DisplayName>Ancient lore</DisplayName>
                        <Summary>Short summary</Summary>
                        <Description>Full knowledge text.</Description>
                    </Render>
                </Knowledge>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const knowledge = sf._lookup('KNOWLEDGE#lore') as StandardKnowledge
        expect(knowledge.render).toEqual({
            displayName: 'Ancient lore',
            summary: ['Short summary'],
            description: ['Full knowledge text.'],
        })
    })

    it('round-trips Render under Knowledge in ephemeraWire', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge key=(lore) uuid=(lore)>
                    <Render>
                        <DisplayName>Ancient lore</DisplayName>
                        <Summary>Short summary</Summary>
                        <Description>Full knowledge text.</Description>
                    </Render>
                </Knowledge>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
    })

    it('round-trips Render under Knowledge with only DisplayName present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge key=(lore) uuid=(lore)>
                    <Render>
                        <DisplayName>Ancient lore</DisplayName>
                    </Render>
                </Knowledge>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const knowledge = sfAgain._lookup('KNOWLEDGE#lore') as StandardKnowledge
        expect(knowledge.render).toEqual({ displayName: 'Ancient lore' })
    })

    it('round-trips Render under Knowledge with only DisplayName and Description present (guest-character shape)', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge key=(lore) uuid=(lore)>
                    <Render>
                        <DisplayName>Ancient lore</DisplayName>
                        <Description>Full knowledge text.</Description>
                    </Render>
                </Knowledge>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const knowledge = sfAgain._lookup('KNOWLEDGE#lore') as StandardKnowledge
        expect(knowledge.render).toEqual({ displayName: 'Ancient lore', description: ['Full knowledge text.'] })
    })

    it('round-trips Render under Knowledge with only DisplayName and Summary present', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Knowledge key=(lore) uuid=(lore)>
                    <Render>
                        <DisplayName>Ancient lore</DisplayName>
                        <Summary>Short summary</Summary>
                    </Render>
                </Knowledge>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([sf.schema])
        expect(() => new StandardForm(printed, { standardizeMode: 'ephemeraWire' })).not.toThrow()
        const sfAgain = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(schemaToWML([sfAgain.schema])).toEqual(printed)
        const knowledge = sfAgain._lookup('KNOWLEDGE#lore') as StandardKnowledge
        expect(knowledge.render).toEqual({ displayName: 'Ancient lore', summary: ['Short summary'] })
    })
})
