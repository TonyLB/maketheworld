import { SchemaOutputTag } from "../../../schema/baseClasses"
import { GenericTree } from "../../../tree/baseClasses";
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards";

export type StandardExampleData = {
    tag: 'Example';
    name?: GenericTree<SchemaOutputTag>;
    summary?: GenericTree<SchemaOutputTag>;
    description?: GenericTree<SchemaOutputTag>;
} & StandardBaseData

export const isStandardExample = (arg: any): arg is StandardExampleData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Example'),
        checkTypes(arg, {
            key: 'string',
        },
        {
            name: 'tree',
            summary: 'tree',
            description: 'tree'
        })
    )
}
