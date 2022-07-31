import { SchemaStringTag } from "../baseClasses";
import { ParseStringTag } from "../parser/baseClasses";

export const schemaFromString = (item: ParseStringTag): SchemaStringTag => {
    return {
        tag: 'String',
        value: item.value
    }
}

export default schemaFromString
