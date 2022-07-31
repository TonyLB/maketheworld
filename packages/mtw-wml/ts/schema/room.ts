import { SchemaRoomTag, SchemaNameTag, SchemaDescriptionTag, SchemaExitTag, SchemaFeatureTag, isSchemaExitOrFeature, isSchemaName, isSchemaDescriptionContents, isSchemaDescription } from "../baseClasses";
import { ParseRoomTag } from "../parser/baseClasses";

//
// TODO: Refactor room schema formation to keep name and description tags not folded into name
// and render properties
//
export const schemaFromRoom = (item: ParseRoomTag, contents: (SchemaNameTag | SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag)[]): SchemaRoomTag => {
    const componentContents = contents.filter(isSchemaExitOrFeature)
    return {
        tag: 'Room',
        key: item.key,
        global: item.global,
        display: item.display,
        x: item.x,
        y: item.y,
        name: contents.filter(isSchemaName).map(({ name }) => (name)).join(''),
        render: contents.filter(isSchemaDescription).reduce((previous, description) => ([...previous, ...description.contents]), []),
        contents: componentContents
    }
}

export default schemaFromRoom
