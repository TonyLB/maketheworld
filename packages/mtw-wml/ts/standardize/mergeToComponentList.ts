import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "./components/baseClasses"
import { excludeUndefined } from "../lib/lists"
import { StandardKey } from "./components/reference"
import { unique } from "@tonylb/mtw-base/ts/utils/lists"

const mergeHelper = (base: StandardComponent, value: StandardComponent): StandardComponent | undefined => {
    const merged = base ? (value ? base.merge(value) : base) : value
    
    if (merged) {
        const origin = unique([...(base.origin ?? []), ...(value.origin ?? [])])
        return merged.withOrigin(origin.length ? origin : undefined)
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
    const keyMatch = universalKeyMappings.find((check) => (check.equals(component.standardKey)))
    const componentIndex = keyMatch ? previous.findIndex((component) => (component.standardKey.equals(keyMatch))) : -1
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
        const existingIndex = acc.findIndex(item => (item.equals(current)))
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