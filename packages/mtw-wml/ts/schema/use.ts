import { SchemaUseTag } from "../baseClasses";
import { ParseUseTag } from "../parser/baseClasses";

export const schemaFromUse = (item: ParseUseTag): SchemaUseTag => {
    return {
        tag: 'Use',
        key: item.key,
        as: item.as,
        type: item.type
    }
}

export default schemaFromUse
