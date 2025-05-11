import { Schema } from "../schema"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { SerializeNDJSONMixin, StandardComponentData } from "./baseClasses"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"

export const isLegalKey = (value: string) => (value.match(/^[a-zA-Z\_][a-zA-Z0-9\_\.]+$/))

export const treeFromWML = (wml: string): GenericTree<SchemaTag> => {
    const schema = new Schema()
    schema.loadWML(wml)
    return schema.schema
}

export const nodeFromWML = (wml: string): GenericTreeNode<SchemaTag> => {
    const schema = treeFromWML(wml)
    if (schema.length !== 1) {
        throw new Error('Multiple elements in StandardComponent WML argument')
    }
    return schema[0]
}

export const removeNDJSONOnlyProperties = (props: StandardComponentData & SerializeNDJSONMixin): Omit<StandardComponentData & SerializeNDJSONMixin, 'universalKey' | 'from' | 'exportAs'> => {
    return Object.assign({}, 
        ...Object.entries(props)
            .filter(([key]) => (!['universalKey', 'from', 'exportAs'].includes(key)))
            .map(([key, value]) => ({ [key]: value }))
    )
}
