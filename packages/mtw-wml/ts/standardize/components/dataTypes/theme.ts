import { SchemaNameTag, SchemaOutputTag, SchemaPromptTag, SchemaTag } from "../../../schema/baseClasses"
import { GenericTree, GenericTreeFiltered } from "../../../tree/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardThemeData = {
    tag: 'Theme';
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    prompts: GenericTreeFiltered<SchemaPromptTag, SchemaTag>;
    rooms: GenericTree<SchemaTag>;
    maps: GenericTree<SchemaTag>;
} & StandardBaseData

export const isStandardTheme = (arg: any): arg is StandardThemeData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Theme'),
        checkTypes(arg, {
            key: 'string',
            prompts: 'tree',
            rooms: 'tree',
            maps: 'tree'
        },
        {
            name: 'node'
        })
    )
}
