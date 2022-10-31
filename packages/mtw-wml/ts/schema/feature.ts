import { SchemaFeatureTag, isSchemaFeatureContents, SchemaFeatureLegalContents } from "./baseClasses";
import { ParseFeatureTag } from "../parser/baseClasses";
import { extractDescriptionFromContents, extractNameFromContents } from "./utils";

export const schemaFromFeature = (item: ParseFeatureTag, contents: SchemaFeatureLegalContents[]): SchemaFeatureTag => {
    const componentContents = contents.filter(isSchemaFeatureContents)
    return {
        tag: 'Feature',
        key: item.key,
        global: item.global,
        name: extractNameFromContents(contents),
        render: extractDescriptionFromContents(contents),
        contents: componentContents,
        parse: item
    }
}

export default schemaFromFeature
