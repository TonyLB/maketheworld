import { schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import StandardRoom from "./room"
import { mergeWithEdits, StandardRemove, StandardReplace } from "./edits"
import { MergeConflictError } from "@tonylb/mtw-base/ts/standardize"

describe('mergeWithEdits', () => {
    it('should merge simple edits', () => {
        const base = new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
        `)
        const incoming = new StandardRoom(`
            <Room key=(test)>
                <Description>Test description</Description>
            </Room>
        `)
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Room key=(test)>
                <Name>Test</Name>
                <Description>Test description</Description>
            </Room>
        `))
    })

    it('should return undefined when merging remove into matching content', () => {
        const base = new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
        `)
        const incoming = new StandardRemove(new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>                    
            </Room>
        `))
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(outputSchema).toBeUndefined()
    })

    it('should return updated content when merging replace into matching content', () => {
        const base = new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
        `)
        const incoming = new StandardReplace(
            new StandardRoom(`
                <Room key=(test)>
                    <Name>Test</Name>
                </Room>
            `),
            new StandardRoom(`
                <Room key=(test)>
                    <Name>Updated</Name>
                </Room>
            `)
        )
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Room key=(test)><Name>Updated</Name></Room>
        `))
    })

    it('should merge remove followed by add into replace', () => {
        const base = new StandardRemove(new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
        `))
        const incoming = new StandardRoom(`
            <Room key=(test)>
                <Description>Test description</Description>
            </Room>
        `)
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Replace>
                <Room key=(test)><Name>Test</Name></Room>
            </Replace>
            <With>
                <Room key=(test)><Description>Test description</Description></Room>
            </With>
        `))
    })

    it('should merge replace followed by remove into remove', () => {
        const base = new StandardReplace(
            new StandardRoom(`
                <Room key=(test)>
                    <Name>Test</Name>
                </Room>
            `),
            new StandardRoom(`
                <Room key=(test)>
                    <Name>Updated</Name>
                </Room>
            `)
        )
        const incoming = new StandardRemove(new StandardRoom(`
            <Room key=(test)>
                <Name>Updated</Name>
            </Room>
        `))
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Remove><Room key=(test)><Name>Test</Name></Room></Remove>
        `))
    })

    it('should merge two replace operations into a single chained operation', () => {
        const base = new StandardReplace(
            new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
            `),
            new StandardRoom(`
            <Room key=(test)>
                <Name>Updated</Name>
            </Room>
            `)
        )
        const incoming = new StandardReplace(
            new StandardRoom(`
            <Room key=(test)>
                <Name>Updated</Name>
            </Room>
            `),
            new StandardRoom(`
            <Room key=(test)>
                <Name>Final</Name>
            </Room>
            `)
        )
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Replace><Room key=(test)><Name>Test</Name></Room></Replace>
            <With><Room key=(test)><Name>Final</Name></Room></With>
        `))
    })

    it('should merge replace followed by more content into replace with combined payload', () => {
        const base = new StandardReplace(
            new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
            `),
            new StandardRoom(`
            <Room key=(test)>
                <Name>Updated</Name>
            </Room>
            `)
        )
        const incoming = new StandardRoom(`
            <Room key=(test)>
                <Description>Test description</Description>
            </Room>
        `)
        const outputSchema = mergeWithEdits(base, incoming)?.schema
        expect(schemaToWML(outputSchema ? [outputSchema] : [])).toEqual(deIndentWML(`
            <Replace>
                <Room key=(test)><Name>Test</Name></Room>
            </Replace>
            <With>
                <Room key=(test)>
                    <Name>Updated</Name>
                    <Description>Test description</Description>
                </Room>
            </With>
        `))
    })

    it('should throw MergeConflictError when merging conflicting replace operations', () => {
        const base = new StandardReplace(
            new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
            `),
            new StandardRoom(`
            <Room key=(test)>
                <Name>Updated</Name>
            </Room>
            `)
        )
        const incoming = new StandardReplace(
            new StandardRoom(`
            <Room key=(test)>
                <Name>Conflicting</Name>
            </Room>
            `),
            new StandardRoom(`
            <Room key=(test)>
                <Name>Final</Name>
            </Room>
            `)
        )
        expect(() => mergeWithEdits(base, incoming)).toThrow(MergeConflictError)
    })

    it('should throw MergeConflictError when merging remove with non-matching content', () => {
        const base = new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
        `)
        const incoming = new StandardRemove(new StandardRoom(`
            <Room key=(test)>
                <Name>Conflicting</Name>
            </Room>
        `))
        expect(() => mergeWithEdits(base, incoming)).toThrow(MergeConflictError)
    })

    it('should throw MergeConflictError when merging replace with non-matching remove', () => {
        const base = new StandardReplace(
            new StandardRoom(`
            <Room key=(test)>
                <Name>Test</Name>
            </Room>
            `),
            new StandardRoom(`
            <Room key=(test)>
                <Name>Updated</Name>
            </Room>
            `)
        )
        const incoming = new StandardRemove(new StandardRoom(`
            <Room key=(test)>
                <Name>Conflicting</Name>
            </Room>
        `))
        expect(() => mergeWithEdits(base, incoming)).toThrow(MergeConflictError)
    })
})