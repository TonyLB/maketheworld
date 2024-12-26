import { StandardReferenceData } from ".";
import { SchemaDescriptionTag, SchemaNameTag, SchemaOutputTag, SchemaShortNameTag, SchemaSummaryTag, SchemaTag, SchemaThemeTag } from "../../../schema/baseClasses"
import { GenericTree, GenericTreeFiltered } from "../../../tree/baseClasses"
import { EditWrappedStandardNode, StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardRoomData = {
    tag: 'Room';
    shortName?: EditWrappedStandardNode<SchemaShortNameTag, SchemaOutputTag>;
    name?: EditWrappedStandardNode<SchemaNameTag, SchemaOutputTag>;
    summary?: EditWrappedStandardNode<SchemaSummaryTag, SchemaOutputTag>;
    description?: EditWrappedStandardNode<SchemaDescriptionTag, SchemaOutputTag>;
    exits: GenericTree<SchemaTag>;
    themes: GenericTreeFiltered<SchemaThemeTag, SchemaTag>;
    features?: StandardReferenceData[];
    examples?: StandardReferenceData[];
} & StandardBaseData

export const isStandardRoom = (arg: any): arg is StandardRoomData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Room'),
        checkTypes(arg, {
            key: 'string',
            exits: 'tree',
            themes: 'tree'
        },
        {
            shortName: 'node',
            name: 'node',
            summary: 'node',
            description: 'node'
        })
    )
}