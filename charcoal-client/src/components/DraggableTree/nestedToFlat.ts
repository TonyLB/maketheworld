import { FlatTree, FlatTreeRow, NestedTree, NestedTreeEntry } from './interfaces'

const entryToRows = <T>(entry: NestedTreeEntry<T>, level: number = 0): FlatTree<T> => {
    const { children, ...rest } = entry
    return [
        ({
            ...rest,
            level
        } as unknown as FlatTreeRow<T>),
        ...(children.reduce<FlatTree<T>>((previous, child) => ([...previous, ...(entryToRows(child, level + 1))]), []))
    ]
}

export const convertNestedToFlat = <T>(nestedTree: NestedTree<T>): FlatTree<T> => {
    return nestedTree.reduce<FlatTree<T>>((previous, entry) => ([...previous, ...(entryToRows(entry, 0))]), [])
}

export default convertNestedToFlat
