import { SchemaNameTag, SchemaOutputTag, SchemaTag, SchemaThemeTag } from "../../../schema/baseClasses"
import { GenericTree, GenericTreeFiltered } from "@tonylb/mtw-base/ts/genericTree";
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardMapData = {
    tag: 'Map';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    images: GenericTree<SchemaTag>;
    positions: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
} & StandardBaseData

export const isStandardMap = (arg: any): arg is StandardMapData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Map'),
        checkTypes(arg, {
            key: 'string',
            themes: 'tree',
            positions: 'tree',
            images: 'tree'
        },
        {
            name: 'node',
        })
    )
}