import { SchemaNameTag } from "./baseClasses";
import { ParseNameTag } from "../parser/baseClasses";

export const schemaFromName = (item: ParseNameTag): SchemaNameTag => {
    return {
        tag: 'Name',
        name: item.value,
        parse: item
    }
}

export default schemaFromName
