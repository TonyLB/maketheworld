import { SchemaMapTag, SchemaMapLegalContents, isSchemaMapContents, SchemaNameTag, isSchemaRoom, isSchemaImage } from "./baseClasses";
import { ParseMapTag } from "../parser/baseClasses";
import { extractConditionedItemFromContents, extractNameFromContents } from "./utils";

//
// TODO: Refactor room schema formation to keep name and description tags not folded into name
// and render properties
//
export const schemaFromMap = (item: ParseMapTag, contents: (SchemaMapLegalContents | SchemaNameTag)[]): SchemaMapTag => {
    const componentContents = contents.filter(isSchemaMapContents)
    return {
        tag: 'Map',
        key: item.key,
        name: extractNameFromContents(contents),
        contents: componentContents,
        rooms: extractConditionedItemFromContents({
            contents,
            typeGuard: isSchemaRoom,
            transform: ({ key, x, y }, index) => ({ conditions: [], key, x, y, index })
        }),
        images: contents.filter(isSchemaImage).map(({ key }) => (key)),
        parse: item
    }
}

export default schemaFromMap
