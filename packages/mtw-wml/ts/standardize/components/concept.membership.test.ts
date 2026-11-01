import { StandardForm } from '..'
import { deIndentWML } from '../../schema/utils'
import { LUDIC_GRAPH_NODE_TAGS } from './dataTypes/ludicGraph'
import StandardConcept from './concept'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('Concept membership through the generic ludicGraph node tags', () => {
    it('is a ludicGraph node tag', () => {
        expect(LUDIC_GRAPH_NODE_TAGS).toContain('Concept')
    })

    it.each([
        ['Area', 'AREA#host', '<Area uuid=(host)><Concept uuid=(system)><ShortName>system</ShortName></Concept></Area>'],
        ['Feature', 'FEATURE#host', '<Feature key=(host) uuid=(host)><Concept uuid=(system)><ShortName>system</ShortName></Concept></Feature>'],
        ['Character', 'CHARACTER#host', '<Character key=(host) uuid=(host)><Concept uuid=(system)><ShortName>system</ShortName></Concept></Character>'],
    ])('lists a Concept nested under a %s as a ludicGraph member', (_tag, hostKey, body) => {
        const sf = new StandardForm(`<Asset uuid=(Test)>${body}</Asset>`, { standardizeMode: 'ephemeraWire' })
        const host = sf._lookup(hostKey) as any
        expect(host.ludicGraph.nodesByTag('Concept').payload.map((ref: any) => ref.universalKey)).toEqual(['CONCEPT#system'])
        expect(sf._lookup('CONCEPT#system')).toBeInstanceOf(StandardConcept)
    })
})

describe('Concept in StandardForm merge and diff', () => {
    const base = deIndentWML(`
        <Asset uuid=(Test)>
            <Concept uuid=(habitatControl)>
                <ShortName>habitat control system</ShortName>
            </Concept>
        </Asset>
    `)
    const addition = deIndentWML(`
        <Asset uuid=(Test)>
            <Concept uuid=(habitatControl)>
                <Object uuid=(terminal)>
                    <ShortName>terminal</ShortName>
                </Object>
            </Concept>
        </Asset>
    `)

    it('merges a Concept defined in two forms', () => {
        const merged = new StandardForm(base, { standardizeMode: 'ephemeraWire' }).merge(new StandardForm(addition, { standardizeMode: 'ephemeraWire' }))
        const concept = merged._lookup('CONCEPT#habitatControl') as StandardConcept
        expect(concept.shortName?._payload?.plain?.toJSON()).toBe('habitat control system')
        expect(concept.ludicGraph.nodesByTag('Object').payload.map((ref) => ref.universalKey)).toEqual(['OBJECT#terminal'])
    })

    it('diffs to the added membership and nothing else', () => {
        const before = new StandardForm(base, { standardizeMode: 'ephemeraWire' })
        const after = before.merge(new StandardForm(addition, { standardizeMode: 'ephemeraWire' }))
        const diff = before.diff(after)
        const concept = diff._lookup('CONCEPT#habitatControl') as StandardConcept
        expect(concept.ludicGraph.nodesByTag('Object').payload.map((ref) => ref.universalKey)).toEqual(['OBJECT#terminal'])
        expect(concept.shortName).toBeUndefined()
    })
})
