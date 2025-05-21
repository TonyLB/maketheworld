import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaNameTag } from "@tonylb/mtw-base/ts/schema/example";
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardPositionData } from "./position";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

export type StandardMapData = {
    tag: 'Map';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    images: GenericTree<SchemaTag>;
    positions: StandardEditableData<StandardPositionData>[];
} & StandardBaseData

export const isStandardMap = (arg: any): arg is StandardMapData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Map'),
        checkTypes(arg, {
            key: 'string',
            positions: 'tree',
            images: 'tree'
        },
        {
            name: 'node',
        })
    )
}