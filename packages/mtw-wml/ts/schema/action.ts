import { SchemaActionTag } from "./baseClasses";
import { ParseActionTag } from "../parser/baseClasses";

export const schemaFromAction = (item: ParseActionTag): SchemaActionTag => {
    return {
        tag: 'Action',
        key: item.key,
        src: item.src,
        parse: item
    }
}

export default schemaFromAction
