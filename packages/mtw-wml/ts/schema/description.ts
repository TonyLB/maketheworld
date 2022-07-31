import { SchemaDescriptionTag, SchemaDescriptionLegalContents } from "../baseClasses";
import { ParseDescriptionTag } from "../parser/baseClasses";

export const schemaFromDescription = (item: ParseDescriptionTag, contents: SchemaDescriptionLegalContents[]): SchemaDescriptionTag => {
    return {
        tag: 'Description',
        spaceBefore: item.spaceBefore,
        spaceAfter: item.spaceAfter,
        display: item.display,
        contents
    }
}

export default schemaFromDescription
