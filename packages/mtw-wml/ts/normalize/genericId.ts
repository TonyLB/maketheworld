import { objectMap } from "../lib/objects";
import { SchemaTag } from "../schema/baseClasses";
import { GenericTree } from "../tree/baseClasses";
import { NormalForm, NormalReference } from "./baseClasses";

const recursiveAppearanceStripId = (tree: GenericTree<SchemaTag | NormalReference, any>): GenericTree<SchemaTag | NormalReference> => (
    tree.map(({ data, children }) => ({
        data,
        children: recursiveAppearanceStripId(children)
    }))
)

export const stripIdFromNormal = (normal: NormalForm): NormalForm => (
    objectMap(normal, ({ appearances, ...rest }) => ({
        appearances: appearances.map(({ contextStack, data, children }) => ({
            contextStack,
            data,
            children: recursiveAppearanceStripId(children)
        })),
        ...rest
    }))
)