import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "./components/baseClasses"
import { mergeWithEdits } from "./components/edits"
import { excludeUndefined } from "../lib/lists"

const mergeHelper = (base: StandardComponent, value: StandardComponent): StandardComponent | undefined => {
    const merged = mergeWithEdits(base, value)
    if (merged) {
        const mergedImport = base.import && value.import ? base.import.merge(value.import) : base.import ?? value.import
        const mergedExport = base.export && value.export ? base.export.merge(value.export) : base.export ?? value.export
        return merged.withImport(mergedImport).withExport(mergedExport)
    }
    else {
        return undefined
    }
}

export type UniversalKeyMapping = {
    universalKey?: ComponentUUID
    key?: string
}

export const mergeToComponentList = (universalKeyMappings: UniversalKeyMapping[]) => (previous: StandardComponent[], component: StandardComponent): StandardComponent[] => {
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

export const mergeUniversalKeyMappings = (universalKeyMappings: UniversalKeyMapping[]): UniversalKeyMapping[] => {
    return universalKeyMappings.reduce<UniversalKeyMapping[]>((acc: UniversalKeyMapping[], current: UniversalKeyMapping) => {
        const existingIndex = acc.findIndex(item => (item.universalKey === current.universalKey || item.key === current.key))
        if (existingIndex === -1) {
            return [...acc, current]
        }
        const existingItem = acc[existingIndex]
        const mergedItem: UniversalKeyMapping = {
            universalKey: existingItem.universalKey || current.universalKey,
            key: existingItem.key || current.key
        }
        return [...acc.slice(0, existingIndex), mergedItem, ...acc.slice(existingIndex + 1)]
    }, [])
}