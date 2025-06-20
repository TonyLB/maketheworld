import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "./components/baseClasses"
import { mergeWithEdits } from "./components/edits"
import { excludeUndefined } from "../lib/lists"
import { StandardKey } from "./components/reference"

const mergeHelper = (base: StandardComponent, value: StandardComponent): StandardComponent | undefined => {
    const merged = mergeWithEdits(base, value)
    if (merged) {
        const mergedImport = base.import && value.import ? base.import.merge(value.import) : base.import ?? value.import
        return merged.withImport(mergedImport)
    }
    else {
        return undefined
    }
}

export type UniversalKeyMapping = {
    universalKey?: ComponentUUID
    key?: string
}

export const mergeToComponentList = (universalKeyMappings: StandardKey[]) => (previous: StandardComponent[], component: StandardComponent): StandardComponent[] => {
    const keyMatch = universalKeyMappings.find(({ key: matchKey, universalKey }) => (
        (matchKey && matchKey === component.key) ||
        (universalKey && universalKey === component.universalKey)
    ))
    const componentIndex = previous.findIndex(({ key, universalKey }) => {
        return (
            keyMatch && (
            (key && keyMatch.key && key === keyMatch.key) ||
            (universalKey && keyMatch.universalKey && universalKey === keyMatch.universalKey)
        ))
    })
    if (componentIndex === -1) {
        return [...previous, component]
    }
    const mergedComponent = mergeHelper(previous[componentIndex], component)
    return [
        ...previous.slice(0, componentIndex),
        mergedComponent,
        ...previous.slice(componentIndex + 1)
    ].filter(excludeUndefined)
}

export const mergeUniversalKeyMappings = (universalKeyMappings: StandardKey[]): StandardKey[] => {
    return universalKeyMappings.reduce<StandardKey[]>((acc: StandardKey[], current: StandardKey) => {
        const existingIndex = acc.findIndex(item => (item.universalKey === current.universalKey || item.key === current.key))
        if (existingIndex === -1) {
            return [...acc, current]
        }
        const existingItem = acc[existingIndex]
        const mergedItem = new StandardKey({
            universalKey: existingItem.universalKey || current.universalKey,
            key: existingItem.key || current.key,
            tag: existingItem.tag || current.tag,
        })
        return [...acc.slice(0, existingIndex), mergedItem, ...acc.slice(existingIndex + 1)]
    }, [])
}