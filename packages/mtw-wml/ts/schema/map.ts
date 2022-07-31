import { SchemaMapTag, isSchemaName, SchemaMapLegalContents, isSchemaMapContents, SchemaNameTag, isSchemaRoom, isSchemaImage } from "./baseClasses";
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
        contents: componentContents,
        rooms: contents.filter(isSchemaRoom).reduce<Record<string, { x: number; y: number }>>((previous, { key, x, y }) => ({ ...previous, [key]: { x, y } }), {}),
        images: contents.filter(isSchemaImage).map(({ key }) => (key))
    }
}

export default schemaFromMap
