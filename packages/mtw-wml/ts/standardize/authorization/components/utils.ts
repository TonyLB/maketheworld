import { unique } from "../../../list"

export const removeStringsFromList = (base: string[], remove: string[]): string[] => {
    return base.filter(item => !remove.includes(item))
}

export const addStringsToList = (base: string[], add: string[]): string[] => {
    return unique(base, add)
}
