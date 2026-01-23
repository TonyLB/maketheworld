import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"

//
// stripUIFields used to remove transient UI-only fields from conditional schema nodes.
// The underlying condition schema helpers have since been removed from mtw-base,
// and condition tags are no longer present in the schema used by the client.
// For compatibility and to keep the data flow simple, we now return the tree unchanged.
//
export const stripUIFields = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => tree
