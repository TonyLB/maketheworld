import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardSituationData } from "./dataTypes/situation"
import StandardSituation from "./situation"

const mergeTest = (base: string, incoming: string): string => {
    const baseStandard = new StandardSituation(deIndentWML(base))
    const incomingStandard = new StandardSituation(deIndentWML(incoming))
    const mergedStandard = baseStandard.merge(incomingStandard)
    if (!mergedStandard) {
        throw new Error('Failure in mergeTest utility')
    }
    return schemaToWML([mergedStandard.schema])
}

describe('StandardSituation class', () => {

    it('should construct from JSON data', () => {
        const data: StandardSituationData = {
            tag: 'Situation',
            key: 'testSituation',
            marks: []
        }
        const situation = new StandardSituation(data)
        expect(situation.key).toBe('testSituation')
        expect(situation.marks.length).toBe(0)
        expect(situation.shortName).toBeUndefined()
    })

    it('should construct from JSON data with shortName', () => {
        const data: StandardSituationData = {
            tag: 'Situation',
            key: 'testSituation',
            shortName: { tag: 'Literal', value: 'Test Short', source: 'ui' },
            marks: []
        }
        const situation = new StandardSituation(data)
        expect(situation.key).toBe('testSituation')
        expect(situation.marks.length).toBe(0)
        expect(situation.shortName?._payload?.plain?.toJSON()).toBe('Test Short')
    })

    it('should construct from WML with Mark children', () => {
        const wml = deIndentWML(`
            <Situation key=(darkSituation)>
                <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
            </Situation>
        `)
        const situation = new StandardSituation(wml)
        expect(situation.key).toBe('darkSituation')
        expect(situation.marks.length).toBe(1)
    })

    it('should construct from schema node', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Situation key=(testSituation)>
                <Mark uuid=(mark_id)><Match>Value</Match></Mark>
            </Situation>
        `)
        schema.loadWML(testSource)
        const situation = new StandardSituation(schema.schema[0])
        expect(schemaToWML([situation.schema])).toEqual(testSource)
    })

    it('should serialize to JSON with omission-over-empty', () => {
        const empty = new StandardSituation({ tag: 'Situation', key: 'test' })
        const emptyJSON = empty.toJSON()
        expect(emptyJSON.tag).toBe('Situation')
        expect('marks' in emptyJSON).toBe(false)
        expect('shortName' in emptyJSON).toBe(false)

        const withMarks = new StandardSituation(deIndentWML(`
            <Situation key=(testKey)>
                <Mark uuid=(MARK#m)><Match>V</Match></Mark>
            </Situation>
        `))
        const json = withMarks.toJSON()
        expect(json.tag).toBe('Situation')
        expect((json as any).marks).toBeDefined()
        expect('shortName' in json).toBe(false)
    })

    it('should round-trip JSON to Component to JSON (empty marks)', () => {
        const original: StandardSituationData = {
            tag: 'Situation',
            key: 'test',
            marks: []
        }
        const situation = new StandardSituation(original)
        const json = situation.toJSON()
        const situation2 = new StandardSituation({ ...json, key: 'test' } as StandardSituationData)
        expect(situation2.toJSON()).toEqual(json)
    })

    it('should round-trip WML to Component to JSON to Component', () => {
        const wml = deIndentWML(`
            <Situation key=(test)>
                <Mark uuid=(MARK#m1)><Match>Val</Match></Mark>
            </Situation>
        `)
        const situation = new StandardSituation(wml)
        const json = situation.toJSON()
        const situation2 = new StandardSituation({ ...json, key: 'test' } as StandardSituationData)
        expect(situation2.marks.length).toBe(1)
        expect(situation2.toJSON()).toEqual(json)
    })

    it('should generate schema correctly', () => {
        const situation = new StandardSituation({
            tag: 'Situation',
            key: 'test'
        })
        const schema = situation.schema
        expect(schema.data.tag).toBe('Situation')
        expect((schema.data as any).key).toBe('test')
    })

    it('should round-trip WML with ShortName to schema and back', () => {
        const wml = deIndentWML(`
            <Situation key=(test)>
                <ShortName>Cozy Evening</ShortName>
                <Mark uuid=(MARK#m1)><Match>Val</Match></Mark>
            </Situation>
        `)
        const situation = new StandardSituation(wml)
        expect(situation.shortName?._payload?.plain?.toJSON()).toBe('Cozy Evening')
        const roundTripped = schemaToWML([situation.schema])
        expect(roundTripped).toEqual(wml)
    })

    it('should merge two situation components with marks', () => {
        expect(mergeTest(
            `<Situation key=(test)>
                <Mark uuid=(mark-id)><Match>First</Match></Mark>
            </Situation>`,
            `<Situation key=(test) ref={0}>
                <Mark uuid=(mark-id) ref={0}><Match>Second</Match></Mark>
            </Situation>`
        )).toEqual(deIndentWML(`
            <Situation key=(test)>
                <Mark uuid=(mark-id)><Match>FirstSecond</Match></Mark>
            </Situation>
        `))
    })

    it('should detect empty situation', () => {
        const empty = new StandardSituation({ tag: 'Situation', key: 'test' })
        expect(empty.isEmpty()).toBe(true)

        const withMarks = new StandardSituation(deIndentWML(`
            <Situation key=(testKey)>
                <Mark uuid=(MARK#m)><Match>V</Match></Mark>
            </Situation>
        `))
        expect(withMarks.isEmpty()).toBe(false)
    })

    it('should invert marks', () => {
        const situation = new StandardSituation(deIndentWML(`
            <Situation key=(testKey)>
                <Mark uuid=(MARK#m)><Match>Val</Match></Mark>
            </Situation>
        `))
        const inverted = situation.invert() as StandardSituation
        expect(inverted).toBeDefined()
        expect(inverted.marks.length).toBe(1)
    })

    it('should parse multiple Mark facets', () => {
        const wml = deIndentWML(`
            <Situation key=(test)>
                <Mark uuid=(mark1)><Match>Value1</Match></Mark>
                <Mark uuid=(mark2)><Match>Value2</Match></Mark>
            </Situation>
        `)
        const situation = new StandardSituation(wml)
        expect(situation.marks.length).toBe(2)
    })

    it('should support situation with zero marks', () => {
        const situation = new StandardSituation({
            tag: 'Situation',
            key: 'empty'
        })
        expect(situation.marks.length).toBe(0)
        const json = situation.toJSON()
        expect(json.tag).toBe('Situation')
        expect('marks' in json).toBe(false)
        expect('shortName' in json).toBe(false)
    })

    it('should report equals for same content', () => {
        const a = new StandardSituation({ tag: 'Situation', key: 'test', marks: [] })
        const b = new StandardSituation({ tag: 'Situation', key: 'test', marks: [] })
        expect(a.equals(b)).toBe(true)
    })

    it('should report not-equals for different marks', () => {
        const a = new StandardSituation(deIndentWML(`<Situation key=(testKey)><Mark uuid=(MARK#m)><Match>A</Match></Mark></Situation>`))
        const b = new StandardSituation(deIndentWML(`<Situation key=(testKey)><Mark uuid=(MARK#m)><Match>B</Match></Mark></Situation>`))
        expect(a.equals(b)).toBe(false)
    })

    it('should clone independently', () => {
        const orig = new StandardSituation(deIndentWML(`<Situation key=(testKey)><Mark uuid=(MARK#m)><Match>X</Match></Mark></Situation>`))
        const cloned = orig.clone()
        expect(cloned.equals(orig)).toBe(true)
        expect(cloned).not.toBe(orig)
    })
})
