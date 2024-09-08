import { GenericTree } from "../../tree/baseClasses";
import { SchemaTag } from "../baseClasses";

export const markInherited = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag, { inherited: boolean }> => (
    tree.map(({ data, children }) => ({
        data,
        inherited: true,
        children: markInherited(children)
    }))
)

export const unmarkInherited = (tree: GenericTree<SchemaTag, { inherited?: boolean }>): GenericTree<SchemaTag> => (
    tree.map(({ data, children }) => ({
        data,
        children: unmarkInherited(children)
    }))
)
