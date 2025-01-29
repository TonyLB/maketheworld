import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { mergeWithEdits, StandardRemove, StandardReplace } from "./edits"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"
import StandardExample from "./example"

describe('mergeWithEdits', () => {
    it('should merge simple edits', () => {
        const base = new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
        `)
        const incoming = new StandardExample(`
            <Example key=(test)>
                <Description>Test description</Description>
            </Example>
        `)
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Example key=(test)>
                <Name>Test</Name>
                <Description>Test description</Description>
            </Example>
        `))
    })

    it('should return undefined when merging remove into matching content', () => {
        const base = new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
        `)
        const incoming = new StandardRemove(new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>                    
            </Example>
        `))
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(outputSchema).toBeUndefined()
    })

    it('should return updated content when merging replace into matching content', () => {
        const base = new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
        `)
        const incoming = new StandardReplace(
            new StandardExample(`
                <Example key=(test)>
                    <Name>Test</Name>
                </Example>
            `),
            new StandardExample(`
                <Example key=(test)>
                    <Name>Updated</Name>
                </Example>
            `)
        )
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Example key=(test)><Name>Updated</Name></Example>
        `))
    })

    it('should merge remove followed by add into replace', () => {
        const base = new StandardRemove(new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
        `))
        const incoming = new StandardExample(`
            <Example key=(test)>
                <Description>Test description</Description>
            </Example>
        `)
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Replace>
                <Example key=(test)><Name>Test</Name></Example>
            </Replace>
            <With>
                <Example key=(test)><Description>Test description</Description></Example>
            </With>
        `))
    })

    it('should merge replace followed by remove into remove', () => {
        const base = new StandardReplace(
            new StandardExample(`
                <Example key=(test)>
                    <Name>Test</Name>
                </Example>
            `),
            new StandardExample(`
                <Example key=(test)>
                    <Name>Updated</Name>
                </Example>
            `)
        )
        const incoming = new StandardRemove(new StandardExample(`
            <Example key=(test)>
                <Name>Updated</Name>
            </Example>
        `))
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Remove><Example key=(test)><Name>Test</Name></Example></Remove>
        `))
    })

    it('should merge two replace operations into a single chained operation', () => {
        const base = new StandardReplace(
            new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
            `),
            new StandardExample(`
            <Example key=(test)>
                <Name>Updated</Name>
            </Example>
            `)
        )
        const incoming = new StandardReplace(
            new StandardExample(`
            <Example key=(test)>
                <Name>Updated</Name>
            </Example>
            `),
            new StandardExample(`
            <Example key=(test)>
                <Name>Final</Name>
            </Example>
            `)
        )
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Replace><Example key=(test)><Name>Test</Name></Example></Replace>
            <With><Example key=(test)><Name>Final</Name></Example></With>
        `))
    })

    it('should merge replace followed by more content into replace with combined payload', () => {
        const base = new StandardReplace(
            new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
            `),
            new StandardExample(`
            <Example key=(test)>
                <Name>Updated</Name>
            </Example>
            `)
        )
        const incoming = new StandardExample(`
            <Example key=(test)>
                <Description>Test description</Description>
            </Example>
        `)
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Replace>
                <Example key=(test)><Name>Test</Name></Example>
            </Replace>
            <With>
                <Example key=(test)>
                    <Name>Updated</Name>
                    <Description>Test description</Description>
                </Example>
            </With>
        `))
    })

    it('should throw MergeConflictError when merging conflicting replace operations', () => {
        const base = new StandardReplace(
            new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
            `),
            new StandardExample(`
            <Example key=(test)>
                <Name>Updated</Name>
            </Example>
            `)
        )
        const incoming = new StandardReplace(
            new StandardExample(`
            <Example key=(test)>
                <Name>Conflicting</Name>
            </Example>
            `),
            new StandardExample(`
            <Example key=(test)>
                <Name>Final</Name>
            </Example>
            `)
        )
        expect(() => mergeWithEdits(base, incoming)).toThrow(MergeConflictError)
    })

    it('should throw MergeConflictError when merging remove with non-matching content', () => {
        const base = new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
        `)
        const incoming = new StandardRemove(new StandardExample(`
            <Example key=(test)>
                <Name>Conflicting</Name>
            </Example>
        `))
        expect(() => mergeWithEdits(base, incoming)).toThrow(MergeConflictError)
    })

    it('should throw MergeConflictError when merging replace with non-matching remove', () => {
        const base = new StandardReplace(
            new StandardExample(`
            <Example key=(test)>
                <Name>Test</Name>
            </Example>
            `),
            new StandardExample(`
            <Example key=(test)>
                <Name>Updated</Name>
            </Example>
            `)
        )
        const incoming = new StandardRemove(new StandardExample(`
            <Example key=(test)>
                <Name>Conflicting</Name>
            </Example>
        `))
        expect(() => mergeWithEdits(base, incoming)).toThrow(MergeConflictError)
    })
})