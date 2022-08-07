import { SchemaLiteralLegalContents, SchemaNameTag } from "./baseClasses";
import { ParseNameTag } from "../parser/baseClasses";

export const schemaFromName = (item: ParseNameTag, contents: SchemaLiteralLegalContents[]): SchemaNameTag => {
    return {
        tag: 'Name',
        name: item.value,
        parse: item,
        contents
    }
}

export default schemaFromName
