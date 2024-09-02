//
// context library holds utility functions for dealing with nested contexts and onChange functions.
//

import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses"

export const nestOnChangeSubItem = <T extends SchemaTag>({ tree, index }: { tree: GenericTree<T>, index: number }) => (onChange: (newValue: GenericTree<T>) => void) => (newValue: GenericTreeNode<T>): void => {
    if (index < tree.length || index >= 0) {
        onChange([...tree.slice(0, index), newValue, ...tree.slice(index+ 1)])
    }
}

export const nestOnChangeChildren = <T extends SchemaTag>(node: GenericTreeNode<T>) => (onChange: (newValue: GenericTreeNode<T>) => void) => (newValue: GenericTree<T>): void => {
    onChange({ ...node, children: newValue })
}
