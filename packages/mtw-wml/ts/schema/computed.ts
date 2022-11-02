import { SchemaComputedTag } from "./baseClasses";
import { ParseComputedTag } from "../parser/baseClasses";

export const schemaFromComputed = (item: ParseComputedTag): SchemaComputedTag => {
    return {
        tag: 'Computed',
        key: item.key,
        src: item.src,
        dependencies: item.dependencies,
        parse: item
    }
}

export default schemaFromComputed
