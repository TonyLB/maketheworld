import { SchemaTag, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaLineBreak, isSchemaSpacer, isSchemaString } from "../baseClasses"
import { PrintMapResult, PrintMode } from "./baseClasses"

export const indentSpacing = (indent: number): string => {
    return '    '.repeat(indent >= 0 ? indent : 0)
}

export const lineLengthAfterIndent = (indent: number): number => (Math.max(40, 80 - indent * 4))

export const areAdjacent = (a: SchemaTag, b: SchemaTag) => {
    const spaces = Boolean(
        (isSchemaString(a) && a.value.match(/\s$/)) ||
        (isSchemaString(b) && b.value.match(/^\s/)) ||
        isSchemaLineBreak(a) ||
        isSchemaSpacer(a) ||
        isSchemaLineBreak(b) ||
        isSchemaSpacer(b) ||
        (isSchemaConditionStatement(a) && (isSchemaConditionStatement(b) || isSchemaConditionFallthrough(b)))
    )
    return !spaces
}


//
// SECTION: Utility functions for dealing with multiple-render listings, and organizing them by nesting level
//

export const isNaivePrint = (output: string) => (output.split('\n').length <= 1)
export const isNestedPrint = (output: string) => (output.split('\n').length > 1 && Boolean(output.split('\n').find((outputLine) => (outputLine.match(/(?!<:\\)<[^/].*(?!<:\\)>/)))))
export const isPropertyNestedPrint = (output: string) => (output.split('\n').length > 1 && !isNestedPrint(output))

//
// maxIndicesByNestingLevel takes a list of many renders (each with multiple possible levels of nesting and styles of render)
// and lists the maximum indices in each PrintMode
//
export const maxIndicesByNestingLevel = (outputs: PrintMapResult[][]): Record<PrintMode, number> => (
    outputs.reduce<Record<PrintMode, number>>((previous, itemOutputs) => {
        const naiveOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.naive))
        const nestedOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.nested))
        const propertyNestedOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
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
// provisionalPrintFactory generates a list of results selected from the outputs, according to the nestingLevel and index provided.
// So it will search up (for instance) the second Naive interpretation of each among many renders, and return them.
//
export const provisionalPrintFactory = ({ outputs, nestingLevel, indexInLevel }: { outputs: PrintMapResult[][]; nestingLevel: PrintMode; indexInLevel: number }): PrintMapResult[] => {
    const lookup = ({ itemOutputs, nestingLevel, indexInLevel }: { itemOutputs: PrintMapResult[]; nestingLevel: PrintMode; indexInLevel: number }) => {
        if (itemOutputs.length === 0) {
            throw new Error('Empty itemOutput list in provisionalPrintFactory')
        }
        const naiveOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.naive))
        const nestedOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.nested))
        const propertyNestedOutputs = itemOutputs.filter(({ printMode }) => (printMode === PrintMode.propertyNested))
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

//
// TODO: Refactor optimalLineResults to return line results of different PrintModes, up to one each (if
// all are equally legal ... i.e., all can display or all are over-length, otherwise only the displayable
// ones are returned).
//
export const optimalLineResults = ({ padding = 0, indent = 0 }: { padding?: number; indent?: number } = {}) => (outputs: PrintMapResult[]): PrintMapResult[] => {
    const lineLengthAllowed = lineLengthAfterIndent(indent)
    const maxLengthFactory = (output: string) => (
        output
            .split('\n')
            .map((outputLine, index) => (outputLine.length + (index === 0 ? padding : 0)))
            .reduce((previous, value) => Math.max(previous, value), 0)
    )
    const outputMap = outputs.reduce<Record<PrintMode, { output?: PrintMapResult; currentLength: number }>>((previous, output) => {
        const { currentLength } = previous[output.printMode]
        if (currentLength <= lineLengthAllowed) {
            return previous
        }
        const maxLength = maxLengthFactory(output.output)
        if (maxLength < currentLength) {
            return {
                ...previous,
                [output.printMode]: { output, currentLength: maxLength }
            }
        }
        return previous
    }, {
        [PrintMode.naive]: { currentLength: Infinity },
        [PrintMode.nested]: { currentLength: Infinity },
        [PrintMode.propertyNested]: { currentLength: Infinity },
    })
    const outputDraft = Object.values(outputMap)
        .map(({ output }) => (output))
        .filter((outputItem): outputItem is PrintMapResult => (Boolean(outputItem)))
    const output = outputDraft.find(({ output }) => (maxLengthFactory(output) <= lineLengthAllowed))
        ? outputDraft.filter(({ output }) => (maxLengthFactory(output) <= lineLengthAllowed))
        : outputDraft
    if (!output) {
        throw new Error('No output calculated in optimalLineResults')
    }
    return output
}
