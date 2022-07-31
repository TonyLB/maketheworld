import { SchemaMapTag, isSchemaName, SchemaMapLegalContents, isSchemaMapContents, SchemaNameTag } from "./baseClasses";
import { ParseMapTag } from "../parser/baseClasses";

//
// TODO: Refactor room schema formation to keep name and description tags not folded into name
// and render properties
//
export const schemaFromMap = (item: ParseMapTag, contents: (SchemaMapLegalContents | SchemaNameTag)[]): SchemaMapTag => {
    const componentContents = contents.filter(isSchemaMapContents)
    return {
        tag: 'Map',
        key: item.key,
        name: contents.filter(isSchemaName).map(({ name }) => (name)).join(''),
        contents: componentContents
    }
}

export default schemaFromMap
