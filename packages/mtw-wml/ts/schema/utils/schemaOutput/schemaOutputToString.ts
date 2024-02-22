import { GenericTree } from "../../../tree/baseClasses"
import { SchemaOutputTag, isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString } from "../../baseClasses"

export const schemaOutputToString = <Extra extends {}>(tree: GenericTree<SchemaOutputTag, Extra>): string => {
    return tree.map(({ data }) => {
        if (isSchemaString(data)) {
            return data.value
        }
        if (isSchemaSpacer(data) || isSchemaLineBreak(data)) {
            return ' '
        }
        if (isSchemaLink(data)) {
            return data.text
        }
        return ''
    }).join('')
}
