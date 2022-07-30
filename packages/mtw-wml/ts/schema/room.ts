import { SchemaRoomTag, SchemaNameTag, SchemaDescriptionTag, SchemaExitTag, SchemaFeatureTag } from "../baseClasses";
import { ParseRoomTag } from "../parser/baseClasses";

export const schemaFromRoom = (item: ParseRoomTag, contents: (SchemaNameTag | SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag)[]): SchemaRoomTag => ({
    tag: 'Room',
    key: item.key,
    global: item.global,
    display: item.display,
    x: item.x,
    y: item.y,
    contents
})

export default schemaFromRoom
