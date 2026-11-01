import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardConceptData } from "./dataTypes/concept"
import StandardConcept from "./concept"
import { standardComponentFactory } from "../componentFactory"
import StandardReference from "../keys/reference"

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardConcept class', () => {
    it('constructs from JSON data', () => {
        const data: StandardConceptData = {
            tag: 'Concept',
            universalKey: 'CONCEPT#habitatControl',
            shortName: 'habitat control system',
        }
        const concept = new StandardConcept(data)
        expect(concept.universalKey).toBe('CONCEPT#habitatControl')
        expect(concept.shortName?._payload?.plain?.toJSON()).toBe('habitat control system')
    })

    it('is built by the component factory from JSON data', () => {
        const { component } = standardComponentFactory({ tag: 'Concept', universalKey: 'CONCEPT#habitatControl' })
        expect(component).toBeInstanceOf(StandardConcept)
    })

    it('constructs from schema node and prints back', () => {
        const schema = new Schema()
        schema.loadWML(deIndentWML(`
            <Asset uuid=(Test)>
                <Concept uuid=(habitatControl)>
                    <ShortName>habitat control system</ShortName>
                    <Gloss>the moonbase's life support</Gloss>
                </Concept>
            </Asset>
        `))
        const concept = new StandardConcept(schema.schema[0].children[0])
        expect(concept.shortName?._payload?.plain?.toJSON()).toBe('habitat control system')
        const printed = schemaToWML([concept.schema])
        expect(printed).toContain('Concept uuid=(habitatControl)')
        expect(printed).toContain('<ShortName>habitat control system</ShortName>')
        expect(printed).toContain("<Gloss>the moonbase's life support</Gloss>")
    })

    it('requires a uuid', () => {
        const schema = new Schema()
        expect(() => schema.loadWML(`<Asset uuid=(Test)><Concept key=(habitatControl) /></Asset>`)).toThrow(/Concept tag must have a non-empty uuid/)
    })

    it('serializes to JSON with omission-over-empty', () => {
        const empty = new StandardConcept({ tag: 'Concept', universalKey: 'CONCEPT#habitatControl' })
        const json = empty.toJSON()
        expect(json.tag).toBe('Concept')
        expect('shortName' in json).toBe(false)
        expect('gloss' in json).toBe(false)
        expect('ludicGraph' in json).toBe(false)
    })

    it('reports isEmpty and round-trips membership through JSON', () => {
        expect(new StandardConcept({ tag: 'Concept', universalKey: 'CONCEPT#habitatControl' }).isEmpty()).toBe(true)
        const withMember = new StandardConcept({
            tag: 'Concept',
            universalKey: 'CONCEPT#habitatControl',
            ludicGraph: { nodes: [{ tag: 'Object', universalKey: 'OBJECT#terminal' }] },
        })
        expect(withMember.isEmpty()).toBe(false)
        expect(withMember.ludicGraph.nodesByTag('Object').payload.map((ref) => ref.universalKey)).toEqual(['OBJECT#terminal'])
        const copy = new StandardConcept({ ...withMember.toJSON(), key: 'habitatControl', universalKey: 'CONCEPT#habitatControl' })
        expect(copy.equals(withMember)).toBe(true)
    })

    it('does not equal an unlike component or a different name', () => {
        const a = new StandardConcept({ tag: 'Concept', universalKey: 'CONCEPT#habitatControl', shortName: 'one' })
        const b = new StandardConcept({ tag: 'Concept', universalKey: 'CONCEPT#habitatControl', shortName: 'two' })
        expect(a.equals(b)).toBe(false)
    })

    it('merges membership from two sources and inverts it', () => {
        const a = new StandardConcept({
            tag: 'Concept', universalKey: 'CONCEPT#habitatControl',
            ludicGraph: { nodes: [{ tag: 'Object', universalKey: 'OBJECT#terminal' }] },
        })
        const b = new StandardConcept({
            tag: 'Concept', universalKey: 'CONCEPT#habitatControl',
            shortName: 'habitat control system',
            ludicGraph: { nodes: [{ tag: 'Object', universalKey: 'OBJECT#panel' }] },
        })
        const merged = a.merge(b)
        expect(merged.ludicGraph.nodesByTag('Object').payload.map((ref) => ref.universalKey).sort()).toEqual(['OBJECT#panel', 'OBJECT#terminal'])
        expect(merged.shortName?._payload?.plain?.toJSON()).toBe('habitat control system')
        expect(merged.merge(merged.invert()).isEmpty()).toBe(true)
    })

    it('takes Object and Concept children, and refuses other kinds', () => {
        const payload = new StandardConcept({ tag: 'Concept', universalKey: 'CONCEPT#habitatControl' })._payload
        const withTerminal = payload.withChild(new StandardReference({ tag: 'Object', key: 'terminal', universalKey: 'OBJECT#terminal' }))
        const withBoth = withTerminal.withChild(new StandardReference({ tag: 'Concept', key: 'hvac', universalKey: 'CONCEPT#hvac' }))
        expect(withBoth.ludicGraph.nodesByTag('Object').payload).toHaveLength(1)
        expect(withBoth.ludicGraph.nodesByTag('Concept').payload).toHaveLength(1)
        expect(() => payload.withChild(new StandardReference({ tag: 'Guidance', key: 'g', universalKey: 'GUIDANCE#g' }))).toThrow(/Invalid child type Guidance for StandardConcept/)
    })
})
