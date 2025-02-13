import { unique } from "../../../list"

export const removeStringsFromList = (base: string[], remove: string[]): string[] => {
    return base.filter(item => !remove.includes(item))
}

export const addStringsToList = (base: string[], add: string[]): string[] => {
    return unique(base, add)
}

export type SignedStringSet = {
    add: string[]
    remove: string[]
}

export const diffSignedStringSets = (base: SignedStringSet, incoming: SignedStringSet): SignedStringSet => {
    const absentAdditions = removeStringsFromList(base.add, incoming.add)
    const absentRemovals = removeStringsFromList(base.remove, incoming.remove)
    const newAdditions = removeStringsFromList(incoming.add, base.add)
    const newRemovals = removeStringsFromList(incoming.remove, base.remove)
    return {
        add: [...absentRemovals, ...newAdditions],
        remove: [...absentAdditions, ...newRemovals]
    }
}
