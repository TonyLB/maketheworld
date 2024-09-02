//
// context library holds utility functions for dealing with nested contexts and onChange functions.
//

import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTree, GenericTreeNode, GenericTreeNodeWithUndefined, GenericTreeWithUndefined } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { excludeUndefined } from "./lists"

export const nestOnChangeSubItem = <T extends SchemaTag>({ tree, index }: { tree: GenericTree<T>, index: number }) => (onChange: (newValue: GenericTree<T>) => void) => (newValue: GenericTreeNode<T>): void => {
    if (index < tree.length || index >= 0) {
        onChange([...tree.slice(0, index), newValue, ...tree.slice(index+ 1)])
    }
}

export const nestOnChangeChildren = <T extends SchemaTag>(node: GenericTreeNode<T>) => (onChange: (newValue: GenericTreeNode<T>) => void) => (newValue: GenericTree<T>): void => {
    onChange({ ...node, children: newValue })
}

//
// onChangeTreeReducer recursively builds an aggregate reducer to operate on a tree, having passed
// the sub-tree calculations through a functional transform at each level
//
type ChangeTreeReducer<T extends SchemaTag> = (previous: GenericTree<T> | undefined, newValue: GenericTree<T>) => GenericTree<T>
type ChangeTreeReducerInternal<T extends SchemaTag> = (previous: GenericTree<T> | undefined, newValue: GenericTreeWithUndefined<T>) => GenericTree<T>

export const nestTransformTreeReducer = <T extends SchemaTag, Supplement extends {}>(
    reducerTransform: (baseReducer: ChangeTreeReducer<T>, options: { parentData?: T }, addSupplemental: (supplement: Supplement) => void) => ChangeTreeReducerInternal<T>,
    baseReducer: ChangeTreeReducer<T> = (_, newValue) => (newValue),
    addSupplemental: (supplemental: Supplement) => void = () => {}
): ChangeTreeReducerInternal<T> => (previous, newValue): GenericTree<T> => {
    //
    // Recursively generate a new onChange function
    //
    const recursedOutput = reducerTransform(baseReducer, {}, addSupplemental)(previous, newValue.map((node, index) => {
        if (node) {
            const { data, children } = node
            return { data, children: nestTransformTreeReducer((baseReducer) => (reducerTransform(baseReducer, { parentData: data }, addSupplemental)), baseReducer, addSupplemental)(previous?.[index]?.children ?? undefined, children) }
        }
        else {
            return undefined
        }
    }))
    return recursedOutput.filter(excludeUndefined)
}