import { excludeUndefined } from "../lib/lists"
import { SchemaTag } from "../schema/baseClasses"
import applyEdits from "../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../tagTree/schema"
import { GenericTreeNode } from "../tree/baseClasses"
import { StandardComponent, StandardNodeKeys } from "./baseClasses"

export const combineTagChildren = <T extends StandardComponent, K extends StandardNodeKeys<T>>(base: T, incoming: T, key: K): T[K] => {
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
    return { ...combinedSchema[0], id: (base[key] as any).id || (incoming[key] as any).id } as T[K]
}
