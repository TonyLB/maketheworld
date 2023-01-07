import { deepEqual } from "../lib/objects";
import { NormalConditionStatement } from "./baseClasses"

let generatedKeys: Record<string, string> = {}
let generatedIfKeys: {
    key: string;
    conditions: NormalConditionStatement[];
}[] = []

export const clearGeneratedKeys = () => {
    generatedKeys = {}
}

export const nextGeneratedKey = (tag: string): string => {
    const currentValues = Object.keys(generatedKeys)
        .filter((key) => (key.startsWith(`${tag}-`)))
        .map((key) => (key.slice(`${tag}-`.length)))
    const maxValue = currentValues.reduce((previous, value) => {
        const numericValue = parseInt(value) ?? -1
        return (numericValue > previous) ? numericValue : previous
    }, -1)
    return `${tag}-${maxValue + 1}`
}

export const keyForValue = (tag: string, value: string): string => {
    const [foundKey] = Object.entries(generatedKeys)
        .find(([key, checkValue]) => (
            key.startsWith(`${tag}-`) &&
            (checkValue === value)
        )) || [null]
    if (foundKey) {
        return foundKey
    }
    const syntheticKey = nextGeneratedKey(tag)
    generatedKeys[syntheticKey] = value
    return syntheticKey
}

const nextGeneratedIfKey = (): string => {
    const index = generatedIfKeys.reduce<number>((previous, { key }) => {
        const testNumber = parseInt(key.slice(3))
        if (typeof testNumber === 'number') {
            return Math.max(previous, testNumber)
        }
        return previous
    }, -1)
    return `If-${index + 1}`
}

export const keyForIfValue = (conditions: NormalConditionStatement[]): string => {
    const foundKey = generatedIfKeys.find(({ conditions: checkConditions }) => (deepEqual(conditions, checkConditions)))
    if (foundKey) {
        return foundKey.key
    }
    const syntheticKey = nextGeneratedIfKey()
    generatedIfKeys.push({
        key: syntheticKey,
        conditions
    })
    return syntheticKey
}

//
// compressIfKeys reorganizes the mapping of conditions into keys, to replace empty
// indices and renumber where necessary.  Should always be combined with remapping the
// keys in normal storage
//
export const compressIfKeys = (extantKeys: string[]): void => {
    const previousGeneratedIfKeys = [...generatedIfKeys]
    generatedIfKeys = []
    extantKeys.forEach((key) => {
        const previousConditions = previousGeneratedIfKeys.find(({ key: checkKey }) => (key === checkKey))
        keyForIfValue(previousConditions.conditions)
    })
}
