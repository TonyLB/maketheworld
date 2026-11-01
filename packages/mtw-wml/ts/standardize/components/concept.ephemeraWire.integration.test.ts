import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import StandardConcept from './concept'
import StandardObject from './object'
import StandardRoom from './room'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

const keysOf = (refs: { payload: { universalKey?: string }[] }) => refs.payload.map((ref) => ref.universalKey).sort()

describe('StandardConcept ephemeraWire integration', () => {
    it('parses a top-level Concept', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Concept uuid=(habitatControl)>
                    <ShortName>habitat control system</ShortName>
                </Concept>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const concept = sf._lookup('CONCEPT#habitatControl') as StandardConcept
        expect(concept).toBeInstanceOf(StandardConcept)
        expect(concept.shortName?._payload?.plain?.toJSON()).toBe('habitat control system')
    })

    it('carries a room-hosted Concept as a top-level component, referenced by the room ludicGraph', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(ring) uuid=(ring)>
                    <Concept uuid=(habitatControl)>
                        <ShortName>habitat control system</ShortName>
                    </Concept>
                </Room>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const room = sf._lookup('ROOM#ring') as StandardRoom
        expect(keysOf(room.ludicGraph.nodesByTag('Concept'))).toEqual(['CONCEPT#habitatControl'])
        expect(sf._components.filter((c) => c instanceof StandardConcept)).toHaveLength(1)
        expect((sf._lookup('CONCEPT#habitatControl') as StandardConcept).shortName?._payload?.plain?.toJSON()).toBe('habitat control system')
    })

    it('names its members by nested reference, and the terminal can sit under both the Room and the Concept', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(ring) uuid=(ring)>
                    <Object uuid=(terminal)>
                        <ShortName>terminal</ShortName>
                    </Object>
                    <Concept uuid=(habitatControl)>
                        <ShortName>habitat control system</ShortName>
                        <Object uuid=(terminal) />
                    </Concept>
                </Room>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const room = sf._lookup('ROOM#ring') as StandardRoom
        const concept = sf._lookup('CONCEPT#habitatControl') as StandardConcept
        expect(keysOf(room.ludicGraph.nodesByTag('Object'))).toEqual(['OBJECT#terminal'])
        expect(keysOf(room.ludicGraph.nodesByTag('Concept'))).toEqual(['CONCEPT#habitatControl'])
        expect(keysOf(concept.ludicGraph.nodesByTag('Object'))).toEqual(['OBJECT#terminal'])
        expect(sf._components.filter((c) => c instanceof StandardObject)).toHaveLength(1)
        expect((sf._lookup('OBJECT#terminal') as StandardObject).shortName?._payload?.plain?.toJSON()).toBe('terminal')
    })

    it('promotes a terminal defined inline under a Concept', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Concept uuid=(habitatControl)>
                    <Object uuid=(terminal)>
                        <ShortName>terminal</ShortName>
                    </Object>
                </Concept>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const concept = sf._lookup('CONCEPT#habitatControl') as StandardConcept
        expect(keysOf(concept.ludicGraph.nodesByTag('Object'))).toEqual(['OBJECT#terminal'])
        expect((sf._lookup('OBJECT#terminal') as StandardObject).shortName?._payload?.plain?.toJSON()).toBe('terminal')
    })

    it('nests a Concept inside a Concept (the design library within the system)', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Concept uuid=(moonbaseComputer)>
                    <Concept uuid=(designLibrary)>
                        <ShortName>design library</ShortName>
                    </Concept>
                </Concept>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const outer = sf._lookup('CONCEPT#moonbaseComputer') as StandardConcept
        expect(keysOf(outer.ludicGraph.nodesByTag('Concept'))).toEqual(['CONCEPT#designLibrary'])
        expect(sf._lookup('CONCEPT#designLibrary')).toBeInstanceOf(StandardConcept)
    })

    it('declares a Concept relevant to an Object', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(terminal)>
                    <ShortName>terminal</ShortName>
                    <Concept uuid=(habitatControl)>
                        <ShortName>habitat control system</ShortName>
                    </Concept>
                </Object>
            </Asset>
        `)
        const sf = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const object = sf._lookup('OBJECT#terminal') as StandardObject
        expect(keysOf(object.ludicGraph.nodesByTag('Concept'))).toEqual(['CONCEPT#habitatControl'])
        expect(sf._lookup('CONCEPT#habitatControl')).toBeInstanceOf(StandardConcept)
    })

    it('round-trips a Room, its Concept and the terminal through WML', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(ring) uuid=(ring)>
                    <Object uuid=(terminal)>
                        <ShortName>terminal</ShortName>
                    </Object>
                    <Concept uuid=(habitatControl)>
                        <ShortName>habitat control system</ShortName>
                        <Object uuid=(terminal) />
                    </Concept>
                </Room>
            </Asset>
        `)
        const first = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const printed = schemaToWML([first.schema])
        const second = new StandardForm(printed, { standardizeMode: 'ephemeraWire' })
        expect(second.equals(first)).toBe(true)
        expect(schemaToWML([second.schema])).toEqual(printed)
    })

    it('survives a JSON round trip', () => {
        const wml = deIndentWML(`
            <Asset uuid=(Test)>
                <Room key=(ring) uuid=(ring)>
                    <Concept uuid=(habitatControl)>
                        <ShortName>habitat control system</ShortName>
                    </Concept>
                </Room>
            </Asset>
        `)
        const first = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const second = new StandardForm(first.toJSON())
        expect(second.equals(first)).toBe(true)
        expect(keysOf((second._lookup('ROOM#ring') as StandardRoom).ludicGraph.nodesByTag('Concept'))).toEqual(['CONCEPT#habitatControl'])
    })
})
