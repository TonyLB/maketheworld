import { SchemaFeatureTag, isSchemaExitOrFeature, isSchemaName, isSchemaDescription, SchemaFeatureLegalContents } from "../baseClasses";
import { ParseFeatureTag } from "../parser/baseClasses";

//
// TODO: Refactor feature schema formation to keep name and description tags not folded into name
// and render properties
//
export const schemaFromFeature = (item: ParseFeatureTag, contents: SchemaFeatureLegalContents[]): SchemaFeatureTag => {
    const componentContents = contents.filter(isSchemaExitOrFeature)
    return {
        tag: 'Feature',
        key: item.key,
        global: item.global,
        name: contents.filter(isSchemaName).map(({ name }) => (name)).join(''),
        render: contents.filter(isSchemaDescription).reduce((previous, description) => ([...previous, ...description.contents]), []),
        contents: componentContents
    }
}

export default schemaFromFeature
