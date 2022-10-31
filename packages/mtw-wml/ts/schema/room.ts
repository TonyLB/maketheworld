import { SchemaRoomTag, SchemaRoomLegalContents, SchemaNameTag, isSchemaRoomContents } from "./baseClasses";
import { ParseRoomTag } from "../parser/baseClasses";
import { extractDescriptionFromContents, extractNameFromContents } from "./utils";

//
// TODO: Refactor room schema formation to keep name and description tags not folded into name
// and render properties
//
export const schemaFromRoom = (item: ParseRoomTag, contents: (SchemaRoomLegalContents | SchemaNameTag)[]): SchemaRoomTag => {
    const componentContents = contents.filter(isSchemaRoomContents)
    return {
        tag: 'Room',
        key: item.key,
        global: item.global,
        display: item.display,
        x: item.x,
        y: item.y,
        name: extractNameFromContents(contents),
        render: extractDescriptionFromContents(contents),
        contents: componentContents,
        parse: item
    }
}

export default schemaFromRoom
