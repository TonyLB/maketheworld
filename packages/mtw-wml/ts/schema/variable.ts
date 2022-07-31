import { SchemaVariableTag } from "./baseClasses";
import { ParseVariableTag } from "../parser/baseClasses";

export const schemaFromVariable = (item: ParseVariableTag): SchemaVariableTag => {
    return {
        tag: 'Variable',
        key: item.key,
        default: item.default
    }
}

export default schemaFromVariable
