import { GenericTree } from "../../tree/baseClasses"
import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../../simpleParser/baseClasses"
import { SchemaTag } from "../baseClasses"
import { ConverterMapValidateProperties, PrintMapOptionsChange, PrintMapOptionsFactory, PrintMode, ValidationTemplate, ValidationTemplateOutput } from "./baseClasses"

export const validateProperties = <V extends ValidationTemplate>(template: V) => (parse: ParseTagOpen | ParseTagSelfClosure): ValidationTemplateOutput<V> => {
    const unmatchedKey = parse.properties.find(({ key }) => (!((key ?? 'DEFAULT') in template)))
    if (unmatchedKey) {
        throw new Error(`Property '${unmatchedKey.key}' is not allowed in '${parse.tag}' items.`)
    }
    const remap = Object.assign({}, ...Object.entries(template).map(([key, { required, type }]) => {
        const matchedKey = parse.properties.find(({ key: checkKey }) => ((checkKey || 'DEFAULT') === key))
        if (required && !matchedKey) {
            throw new Error(`Property '${key}' is required in '${parse.tag}' items.`)
        }
        if (matchedKey && matchedKey.type !== type) {
            const typeLabel = type === ParsePropertyTypes.Boolean ? 'Boolean' : type === ParsePropertyTypes.Expression ? 'Expression' : type === ParsePropertyTypes.Literal ? 'Literal' : 'Key'
            throw new Error(`Property '${key}' must be of ${typeLabel} type in '${parse.tag}' items.`)
        }
        if (matchedKey) {
            return { [key]: matchedKey.value }
        }
        else {
            return {}
        }
    })) as ValidationTemplateOutput<V>
    return remap
}

export const validateContents = ({ isValid, branchTags, leafTags }: ConverterMapValidateProperties) => (contents: GenericTree<SchemaTag>): boolean => {
    return contents.reduce<boolean>((previous, { data: childTag, children }) => {
        if (!previous) {
            return previous
        }
        if (leafTags.includes(childTag.tag)) {
            return isValid(childTag)
        }
        else if (branchTags.includes(childTag.tag)) {
            if (!isValid(childTag)) {
                return false
            }
            else if (children.length) {
                return validateContents({ isValid, branchTags, leafTags })(children)
            }
        }
        return true
    }, true)
}

export const optionsFactory: PrintMapOptionsFactory = (action) => (previous) => {
    switch(action) {
        case PrintMapOptionsChange.Sibling:
            return previous
        case PrintMapOptionsChange.Indent:
            return {
                ...previous,
                indent: previous.indent + 1
            }
    }
    return previous
}

export const isNaivePrint = (output: string) => (output.split('\n').length <= 1)
export const isNestedPrint = (output: string) => (output.split('\n').length > 1 && Boolean(output.split('\n').find((outputLine) => (outputLine.match(/(?!<:\\)<[^/].*(?!<:\\)>/)))))
export const isPropertyNestedPrint = (output: string) => (output.split('\n').length > 1 && !isNestedPrint(output))

//
// SECTION: Utility functions for dealing with multiple-render listings, and organizing them by nesting level
//

//
// maxIndicesByNestingLevel takes a list of many renders (each with multiple possible levels of nesting and styles of render)
// and lists the maximum indices in each PrintMode
//
export const maxIndicesByNestingLevel = (outputs: string[][]): Record<PrintMode, number> => (
    outputs.reduce<Record<PrintMode, number>>((previous, itemOutputs) => {
        const naiveOutputs = itemOutputs.filter(isNaivePrint)
        const nestedOutputs = itemOutputs.filter(isNestedPrint)
        const propertyNestedOutputs = itemOutputs.filter(isPropertyNestedPrint)
        return {
            [PrintMode.naive]: Math.max(previous[PrintMode.naive], naiveOutputs.length),
            [PrintMode.nested]: Math.max(previous[PrintMode.nested], nestedOutputs.length),
            [PrintMode.propertyNested]: Math.max(previous[PrintMode.propertyNested], propertyNestedOutputs.length),
        }
    }, { [PrintMode.naive]: 0, [PrintMode.nested]: 0, [PrintMode.propertyNested]: 0 })
)

//
// minIndicesByNestingLevel does the same as maxIndicesByNestingLevel, but returns the minimum
//
export const minIndicesByNestingLevel = (outputs: string[][]): Record<PrintMode, number> => (
    outputs.reduce<Record<PrintMode, number>>((previous, itemOutputs) => {
        const naiveOutputs = itemOutputs.filter(isNaivePrint)
        const nestedOutputs = itemOutputs.filter(isNestedPrint)
        const propertyNestedOutputs = itemOutputs.filter(isPropertyNestedPrint)
        return {
            [PrintMode.naive]: Math.min(previous[PrintMode.naive], naiveOutputs.length),
            [PrintMode.nested]: Math.min(previous[PrintMode.nested], nestedOutputs.length),
            [PrintMode.propertyNested]: Math.min(previous[PrintMode.propertyNested], propertyNestedOutputs.length),
        }
    }, { [PrintMode.naive]: Infinity, [PrintMode.nested]: Infinity, [PrintMode.propertyNested]: Infinity })
)

//
// provisionalPrintFactory generates a list of strings selected from the outputs, according to the nestingLevel and index provided.
// So it will search up (for instance) the second Naive interpretation of each among many renders, and return them.
//
export const provisionalPrintFactory = ({ outputs, nestingLevel, indexInLevel }: { outputs: string[][]; nestingLevel: PrintMode; indexInLevel: number }): string[] => {
    const lookup = ({ itemOutputs, nestingLevel, indexInLevel }: { itemOutputs: string[]; nestingLevel: PrintMode; indexInLevel: number }) => {
        if (itemOutputs.length === 0) {
            throw new Error('Empty itemOutput list in provisionalPrintFactory')
        }
        const naiveOutputs = itemOutputs.filter(isNaivePrint)
        const nestedOutputs = itemOutputs.filter(isNestedPrint)
        const propertyNestedOutputs = itemOutputs.filter(isPropertyNestedPrint)
        if (nestingLevel === PrintMode.naive) {
            if (naiveOutputs.length === 0) {
                return lookup({ itemOutputs, nestingLevel: PrintMode.nested, indexInLevel: 0 })
            }
            return naiveOutputs[Math.min(indexInLevel, naiveOutputs.length - 1)]
        }
        else if (nestingLevel === PrintMode.nested) {
            if (nestedOutputs.length === 0) {
                //
                // If there are no nested outputs, default up to naive first, with propertyNested as a fallback
                //
                if (naiveOutputs.length) {
                    return lookup({ itemOutputs, nestingLevel: PrintMode.naive, indexInLevel: naiveOutputs.length - 1 })
                }
                else {
                    return lookup({ itemOutputs, nestingLevel: PrintMode.propertyNested, indexInLevel: 0 })
                }
            }
            return nestedOutputs[Math.min(indexInLevel, nestedOutputs.length - 1)]
        }
        else {
            if (propertyNestedOutputs.length === 0) {
                return lookup({ itemOutputs, nestingLevel: PrintMode.nested, indexInLevel: nestedOutputs.length - 1 })
            }
            return propertyNestedOutputs[Math.min(indexInLevel, propertyNestedOutputs.length - 1)]
        }
    }
    return outputs.map((itemOutputs) => (lookup({ itemOutputs, nestingLevel, indexInLevel })))
}