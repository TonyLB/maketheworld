import { SchemaTag } from "../schema/baseClasses"

export type SchemaContextItem = {
    tag: SchemaTag;
    contents: SchemaTag[];
}
