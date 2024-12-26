import { excludeUndefined } from "../lib/lists"
import { Schema } from "../schema"
import { SchemaTag } from "../schema/baseClasses"
import applyEdits from "../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../tagTree/schema"
import { GenericTreeNode } from "../tree/baseClasses"
import { SerializeNDJSONMixin, StandardComponentData, StandardNodeKeys } from "./baseClasses"

export const combineTagChildren = <T extends StandardComponentData, K extends StandardNodeKeys<T>>(base: T, incoming: T, key: K): T[K] | undefined => {
    if (!excludeUndefined(base[key])) {
        return incoming[key]
    }
    if (!excludeUndefined(incoming[key])) {
        return base[key]
    }
    const tagTree = new SchemaTagTree([base[key] as GenericTreeNode<SchemaTag>])
    const incomingTagTree = new SchemaTagTree([incoming[key] as GenericTreeNode<SchemaTag>])
    tagTree._tagList = [...tagTree._tagList, ...incomingTagTree._tagList]
    const combinedSchema = applyEdits(tagTree.tree)
    return combinedSchema.length ? { ...combinedSchema[0], id: (base[key] as any).id || (incoming[key] as any).id } as T[K] : undefined
}

export const isLegalKey = (value: string) => (value.match(/^[a-zA-Z\_][a-zA-Z0-9\_\.]+$/))

export const nodeFromWML = (wml: string): GenericTreeNode<SchemaTag> => {
    const schema = new Schema()
    try {
        schema.loadWML(wml)
    }
    catch {
        throw new Error('Parse failure in StandardComponent WML argument')
    }
    if (schema.schema.length !== 1) {
        throw new Error('Multiple elements in StandardComponent WML argument')
    }
    return schema.schema[0]
}

export const removeNDJSONOnlyProperties = (props: StandardComponentData & SerializeNDJSONMixin): Omit<StandardComponentData & SerializeNDJSONMixin, 'universalKey' | 'from' | 'exportAs'> => {
    return Object.assign({}, 
        ...Object.entries(props)
            .filter(([key]) => (!['universalKey', 'from', 'exportAs'].includes(key)))
            .map(([key, value]) => ({ [key]: value }))
    )
}
