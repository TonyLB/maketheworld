import { SchemaImportTag, SchemaUseTag } from "./baseClasses";
import { ParseImportTag } from "../parser/baseClasses";

export const schemaFromImport = (item: ParseImportTag, contents: SchemaUseTag[]): SchemaImportTag => {
    return {
        tag: 'Import',
        from: item.from,
        mapping: contents.reduce((previous, { key, as, type }) => ({
            ...previous,
            [as || key]: {
                key,
                type
            }
        }), {})
    }
}

export default schemaFromImport
