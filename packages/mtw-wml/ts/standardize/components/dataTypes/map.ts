import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardPositionData } from "./position";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { isStandardKeyData } from "./reference";

export type StandardMapData = {
    tag: 'Map';
    name?: StandardEditableData<string>;
    images?: GenericTree<SchemaTag>;
    positions?: StandardEditableData<StandardPositionData>[];
} & StandardBaseData

export const isStandardMap = (arg: any): arg is StandardMapData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Map'),
        checkTypes(arg, {
            images: 'tree'
        },
        {
            key: 'string',
            universalKey: 'string',
            name: 'literal',
        }),
        (
            !('positions' in arg) || (
                Array.isArray(arg.positions) &&
                arg.positions.every((position) => (
                    'x' in position && typeof position.x === 'number' &&
                    'y' in position && typeof position.y === 'number' &&
                    'room' in position && isStandardKeyData(position.room)
                ))
            )
        )
    )
}