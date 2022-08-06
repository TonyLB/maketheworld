import { SchemaImageTag } from "./baseClasses";
import { ParseImageTag } from "../parser/baseClasses";

export const schemaFromImage = (item: ParseImageTag): SchemaImageTag => {
    return {
        tag: 'Image',
        key: item.key,
        fileURL: item.fileURL,
        parse: item
    }
}

export default schemaFromImage
