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
        rooms: contents.reduce<Record<string, { x: number; y: number; index: number }>>((previous, item, index) => {
            if (isSchemaRoom(item)) {
                const { key, x, y } = item
                return { ...previous, [key]: { x, y, index } }
            }
            return previous
        }, {}),
        images: contents.filter(isSchemaImage).map(({ key }) => (key)),
        parse: item
    }
}

export default schemaFromMap
