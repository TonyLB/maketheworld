import { SchemaNameTag } from "../baseClasses";
import { ParseNameTag } from "../parser/baseClasses";

export const schemaFromName = (item: ParseNameTag): SchemaNameTag => {
    return {
        tag: 'Name',
        name: item.value
    }
}

export default schemaFromName
