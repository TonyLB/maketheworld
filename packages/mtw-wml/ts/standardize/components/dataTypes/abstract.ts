import { SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag, SchemaTag } from "../../../schema/baseClasses"
import { GenericTreeNodeFiltered } from "../../../tree/baseClasses"

export type StandardBaseData = {
    key: string;
    update?: boolean;
}

export type EditInternalStandardNode<T extends SchemaTag, ChildType extends SchemaTag, Extra extends {} = {}> = GenericTreeNodeFiltered<T, ChildType, Extra>

export type EditWrappedStandardNode<T extends SchemaTag, ChildType extends SchemaTag, Extra extends {} = {}> = {
    data: SchemaRemoveTag;
    children: EditInternalStandardNode<T, ChildType, Extra>[];
} | {
    data: SchemaReplaceTag;
    children: { data: SchemaReplaceMatchTag | SchemaReplacePayloadTag, children: EditInternalStandardNode<T, ChildType, Extra>[] }[];
} | EditInternalStandardNode<T, ChildType, Extra>
