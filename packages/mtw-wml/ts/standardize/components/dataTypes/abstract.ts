import { GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { ComponentUUID, SchemaTag, SchemaWithKey, AssetUUID } from "@tonylb/mtw-base/ts/schema";
import { SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag } from "@tonylb/mtw-base/ts/schema/edit";
import { StandardKeyData } from "./reference";
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
    switch (tag) {
        case 'CHARACTER': return 'Character'
        case 'EXAMPLE': return 'Example'
        case 'ROOM': return 'Room'
        case 'FEATURE': return 'Feature'
        case 'KNOWLEDGE': return 'Knowledge'
        case 'MESSAGE': return 'Message'
        case 'MOMENT': return 'Moment'
        case 'IMAGE': return 'Image'
        case 'MAP': return 'Map'
        default: throw new Error(`Unknown tag: ${tag}`)
    }
}