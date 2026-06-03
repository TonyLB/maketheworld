import { GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { ComponentUUID, SchemaTag, SchemaWithKey, AssetUUID, isSchemaComponentTag, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag } from "@tonylb/mtw-base/ts/schema/edit";
import { StandardKeyData } from "../../keys/dataTypes/reference";
import { StandardEditablePayload } from "../../../generics/editable";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardBaseData = {
    key?: string | StandardEditableData<string>;
    universalKey?: ComponentUUID;
    update?: boolean;
    // context has been removed; hierarchical relationships are handled at the component level
    origin?: AssetUUID[];  // Array of ancestor asset UUIDs in inheritance chain
    explicitParent?: StandardEditablePayload<StandardKeyData | 'ASSET'>;
}

export type EditInternalStandardNode<T extends SchemaTag, ChildType extends SchemaTag> = GenericTreeNodeFiltered<T, ChildType>

export type EditWrappedStandardNode<T extends SchemaTag, ChildType extends SchemaTag> = {
    data: SchemaRemoveTag;
    children: EditInternalStandardNode<T, ChildType>[];
} | {
    data: SchemaReplaceTag;
    children: { data: SchemaReplaceMatchTag | SchemaReplacePayloadTag, children: EditInternalStandardNode<T, ChildType>[] }[];
} | EditInternalStandardNode<T, ChildType>

export type ComponentTag = Exclude<SchemaWithKey["tag"], 'Asset' | 'Story'>
export const componentTagFromUpperCase = (tag: Uppercase<ComponentTag>): ComponentTag => {
    const result = (tag.charAt(0) + tag.slice(1).toLowerCase()) as ComponentTag
    if (!isSchemaComponentTag(result)) throw new Error(`Unknown tag: ${tag}`)
    return result
}

/** Derive WML component tag from a ComponentUUID prefix (same rule as StandardReference). */
export const componentTagFromUniversalKey = (universalKey: ComponentUUID): ComponentTag => {
    if (!isSchemaComponentUUID(universalKey)) {
        throw new Error(`Invalid ComponentUUID: ${universalKey}`)
    }
    const [upcaseTag] = universalKey.split('#')
    return componentTagFromUpperCase(upcaseTag as Uppercase<ComponentTag>)
}