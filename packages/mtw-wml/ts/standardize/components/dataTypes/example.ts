import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { StandardBaseData } from "./abstract"
import { checkAll, checkTypes } from "./typeguards"
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema"

export type StandardExampleData = {
    tag: 'Example';
    name?: RenderTree;
    summary?: RenderTree;
    description?: RenderTree;
} & StandardBaseData

export type StandardExampleNDJSONData = {
    tag: 'Example';
    name?: RenderTree;
    summary?: RenderTree;
    description?: RenderTree;
} & StandardBaseData

export const isStandardExampleData = (arg: any): arg is StandardExampleData => {
    if (typeof arg !== 'object') {
        return false
    }

    return checkAll(
        ('tag' in arg && arg.tag === 'Example'),
        checkTypes(arg, {},
        {
            key: 'string',
            universalKey: 'string',
            name: 'renderTree',
            summary: 'renderTree',
            description: 'renderTree'
        })
    )
}
