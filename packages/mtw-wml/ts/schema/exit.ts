import { SchemaExitTag, SchemaStringTag } from "../baseClasses";
import { ParseExitTag } from "../parser/baseClasses";

export const schemaFromExit = (item: ParseExitTag, contents: SchemaStringTag[]): SchemaExitTag => {
    return {
        tag: 'Exit',
        name: contents.map(({ value }) => (value)).join(''),
        key: item.key,
        from: item.from,
        to: item.to
    }
}

export default schemaFromExit
