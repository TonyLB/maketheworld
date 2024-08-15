import { GenericTree, treeNodeTypeguard } from "../../tree/baseClasses"
import { isSchemaRemove, isSchemaReplace, SchemaTag } from "../baseClasses"

//
// applyExits takes a standard schema that includes (possibly) multiple edit entries, and aggregates down the edits
// at each sibling-level to a single edit or entry.
//
export const applyEdits = <Extra extends {}>(tree: GenericTree<SchemaTag, Extra>): GenericTree<SchemaTag, Extra> => {
    return tree.reduce<GenericTree<SchemaTag, Extra>>((previous, node) => {
        if (previous.length) {
            const siblingNode = previous.slice(-1)[0]
            //
            // Three possibilities for siblingNode: add, replace, or remove
            //
            if (treeNodeTypeguard(isSchemaRemove)(siblingNode)) {

            }
            else if (treeNodeTypeguard(isSchemaReplace)(siblingNode)) {

            }
            else {

            }
        }
        return [...previous, node]
    }, [])
}

export default applyEdits
