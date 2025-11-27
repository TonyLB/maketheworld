import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { StandardComponent, NestedSchemaOptions } from "../baseClasses"
import StandardReference, { StandardKey } from "../reference"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"

export const renderReference = ({ lookup, options }: { lookup: (key: string | StandardKey) => StandardComponent | undefined, options: NestedSchemaOptions }) => (reference: StandardReference): GenericTreeNode<SchemaTag> | undefined => {
    const found = lookup(reference._payload.plain)
    return found?.nestedSchema(lookup, { ...options, key: reference._payload.plain })
}
