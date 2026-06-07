import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaDoubleBR, isSchemaDoubleSpace, isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"

export const schemaOutputToString = <Extra extends {}>(tree: GenericTree<SchemaOutputTag>): string => {
    return tree.map(({ data }) => {
        if (isSchemaString(data)) {
            return data.value
        }
        if (isSchemaSpacer(data) || isSchemaLineBreak(data)) {
            return ' '
        }
        if (isSchemaDoubleSpace(data)) {
            return '  '
        }
        if (isSchemaDoubleBR(data)) {
            return ' '
        }
        if (isSchemaLink(data)) {
            return data.text
        }
        return ''
    }).join('')
}
