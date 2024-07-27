import { SchemaTag, isSchemaWithKey } from "../baseClasses";

export const optionsMatch = (options: { tag: string; key: string }) => ({ data }: { data: SchemaTag }): boolean => {
    if (!(options.tag && options.key)) {
        return true
    }
    if (isSchemaWithKey(data) && (data.tag === options.tag) && (data.key === options.key)) {
        return true
    }
    return false
}