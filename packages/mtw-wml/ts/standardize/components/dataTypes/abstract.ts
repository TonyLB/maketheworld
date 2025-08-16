import { GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { ComponentUUID, SchemaTag, SchemaWithKey, AssetUUID } from "@tonylb/mtw-base/ts/schema";
import { SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag } from "@tonylb/mtw-base/ts/schema/edit";

type StandardReferenceData = string | ({
    key?: string;
    universalKey?: ComponentUUID;
    tag: ComponentTag;
})

export type StandardBaseData = {
    key?: string;
    universalKey?: ComponentUUID;
    update?: boolean;
    context?: StandardReferenceData[];
    origin?: AssetUUID[];  // Array of ancestor asset UUIDs in inheritance chain
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
        case 'ACTION': return 'Action'
        case 'COMPUTED': return 'Computed'
        case 'VARIABLE': return 'Variable'
        default: throw new Error(`Unknown tag: ${tag}`)
    }
}