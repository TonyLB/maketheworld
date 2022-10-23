import { SchemaFeatureTag, isSchemaFeatureContents, isSchemaName, isSchemaDescription, SchemaFeatureLegalContents } from "./baseClasses";
import { ParseFeatureTag } from "../parser/baseClasses";

//
// TODO: Refactor feature schema formation to keep name and description tags not folded into name
// and render properties
//
export const schemaFromFeature = (item: ParseFeatureTag, contents: SchemaFeatureLegalContents[]): SchemaFeatureTag => {
    const componentContents = contents.filter(isSchemaFeatureContents)
    return {
        tag: 'Feature',
        key: item.key,
        global: item.global,
        name: contents.filter(isSchemaName).map(({ contents }) => (contents)).reduce((previous, item) => ([ ...previous, ...item ]), []),
        render: contents.filter(isSchemaDescription).reduce((previous, description) => ([...previous, ...description.contents]), []),
        contents: componentContents,
        parse: item
    }
}

export default schemaFromFeature
