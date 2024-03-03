import { GenericTree, TreeId } from "../../tree/baseClasses";
import { SchemaTag } from "../baseClasses";

export const markInherited = (tree: GenericTree<SchemaTag, TreeId>): GenericTree<SchemaTag, TreeId & { inherited: boolean }> => (
    tree.map(({ data, children, id }) => ({
        data,
        id,
        inherited: true,
        children: markInherited(children)
    }))
)

export const unmarkInherited = (tree: GenericTree<SchemaTag, TreeId & { inherited?: boolean }>): GenericTree<SchemaTag, TreeId> => (
    tree.map(({ data, children, id }) => ({
        data,
        id,
        children: unmarkInherited(children)
    }))
)
