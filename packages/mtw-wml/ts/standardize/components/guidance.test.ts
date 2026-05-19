import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardGuidanceData } from "./dataTypes/guidance"
import StandardGuidance from "./guidance"

const mergeTest = (base: string, incoming: string): string => {
    const baseStandard = new StandardGuidance(deIndentWML(base))
    const incomingStandard = new StandardGuidance(deIndentWML(incoming))
    const mergedStandard = baseStandard.merge(incomingStandard)
    if (!mergedStandard) {
        throw new Error('Failure in mergeTest utility')
    }
    return schemaToWML([mergedStandard.schema])
}

describe('StandardGuidance class', () => {

    it('should construct from JSON data', () => {
        const data: StandardGuidanceData = {
            tag: 'Guidance',
            key: 'testGuidance',
            instructions: 'Test instructions',
            marks: [],
            shortName: 'Test'
        }
        const guidance = new StandardGuidance(data)
        expect(guidance.key).toBe('testGuidance')
        expect(guidance.instructions).toBeDefined()
        expect(guidance.shortName).toBeDefined()
    })

    it('should construct from WML', () => {
        const wml = deIndentWML(`
            <Guidance key=(darkGuidance)>
                <ShortName>Dark Guidance</ShortName>
                <Instructions>Mood is spooky, play up shadows</Instructions>
                <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
            </Guidance>
        `)
        const guidance = new StandardGuidance(wml)
        expect(guidance.key).toBe('darkGuidance')
        expect(guidance.instructions).toBeDefined()
        expect(guidance.marks.length).toBe(1)
    })

    it('should construct from schema node', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Guidance key=(darkGuidance)>
                <ShortName>Dark Guidance</ShortName>
                <Instructions>Mood is spooky, play up shadows</Instructions>
                <Mark uuid=(illumination_mark)><Match>Dark</Match></Mark>
            </Guidance>
        `)
        schema.loadWML(testSource)
        const guidance = new StandardGuidance(schema.schema[0])
        expect(schemaToWML([guidance.schema])).toEqual(testSource)
    })

    it('should serialize to JSON correctly', () => {
        const wml = deIndentWML(`
            <Guidance key=(test)>
                <Instructions>Test instructions</Instructions>
            </Guidance>
        `)
        const guidance = new StandardGuidance(wml)
        const json = guidance.toJSON()
        expect(json.tag).toBe('Guidance')
        expect((json as any).instructions).toBeDefined()
    })

    it('should round-trip JSON → Component → JSON', () => {
        const original: StandardGuidanceData = {
            tag: 'Guidance',
            key: 'test',
            instructions: 'Test instructions',
            marks: []
        }
        const guidance = new StandardGuidance(original)
        const json = guidance.toJSON()
        const guidance2 = new StandardGuidance({ ...json, key: 'test' } as StandardGuidanceData)
        expect(guidance2.toJSON()).toEqual(json)
    })

    it('should generate schema correctly', () => {
        const guidance = new StandardGuidance({
            tag: 'Guidance',
            key: 'test',
            instructions: 'Test instructions'
        })
        const schema = guidance.schema
        expect(schema.data.tag).toBe('Guidance')
        expect((schema.data as any).key).toBe('test')
    })

    it('should merge two guidance components', () => {
        expect(mergeTest(
            `<Guidance key=(test)>
                <Instructions>First</Instructions>
                <Mark uuid=(mark-id)><Match>First</Match></Mark>
            </Guidance>`,
            `<Guidance key=(test) ref={0}>
                <Instructions>Second</Instructions>
            </Guidance>`
        )).toEqual(deIndentWML(`
            <Guidance key=(test)>
                <Instructions>FirstSecond</Instructions>
                <Mark uuid=(mark-id)><Match>First</Match></Mark>
            </Guidance>
        `))
    })

    it('should merge guidance with Mark facets', () => {
        expect(mergeTest(
            `<Guidance key=(test)>
                <Mark uuid=(mark-id)><Match></Match></Mark>
            </Guidance>`,
            `<Guidance key=(test) ref={0}>
                <Mark uuid=(mark-id) ref={0}><Match>Second</Match></Mark>
            </Guidance>`
        )).toEqual(deIndentWML(`
            <Guidance key=(test)>
                <Mark uuid=(mark-id)><Match>Second</Match></Mark>
            </Guidance>
        `))
    })

    it('should detect empty guidance', () => {
        const empty = new StandardGuidance({
            tag: 'Guidance',
            key: 'test'
        })
        expect(empty._payload.isEmpty()).toBe(true)

        const notEmpty = new StandardGuidance({
            tag: 'Guidance',
            key: 'test',
            instructions: 'Not empty'
        })
        expect(notEmpty._payload.isEmpty()).toBe(false)
    })

    it('should invert guidance operations', () => {
        const guidance = new StandardGuidance({
            tag: 'Guidance',
            key: 'test',
            instructions: 'Test'
        })
        const inverted = guidance.invert() as StandardGuidance
        expect(inverted.instructions?.toJSON()).toEqual({ tag: 'Remove', match: 'Test' })
    })

    it('should handle Mark facets correctly', () => {
        const wml = deIndentWML(`
            <Guidance key=(test)>
                <Mark uuid=(mark1)><Match>Value1</Match></Mark>
                <Mark uuid=(mark2)><Match>Value2</Match></Mark>
            </Guidance>
        `)
        const guidance = new StandardGuidance(wml)
        expect(guidance.marks.length).toBe(2)
    })

    it('should support guidance with zero marks', () => {
        const wml = deIndentWML(`
            <Guidance key=(essence)>
                <Instructions>Default essence guidance</Instructions>
            </Guidance>
        `)
        const guidance = new StandardGuidance(wml)
        expect(guidance.marks.length).toBe(0)
        expect(guidance.instructions).toBeDefined()
    })
})

describe('StandardGuidance.equals semantic optionals', () => {
    it('treats undefined and semantic-empty instructions as equal', () => {
        const withoutInstructions = new StandardGuidance({
            tag: 'Guidance',
            key: 'testGuidance',
        })
        const withEmptyInstructions = new StandardGuidance({
            tag: 'Guidance',
            key: 'testGuidance',
            instructions: '',
        })
        expect(withoutInstructions.equals(withEmptyInstructions)).toBe(true)
        expect(withEmptyInstructions.equals(withoutInstructions)).toBe(true)
    })
})
