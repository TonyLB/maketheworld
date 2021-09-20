import { FlatTree, FlatTreeRow, NestedTree, NestedTreeEntry } from './interfaces'

const entryToRows = <T>(entry: NestedTreeEntry<T>, level: number = 0): FlatTree<T> => {
    const { children, ...rest } = entry
    const rowsFromChildren = children.map<FlatTree<T>>((child) => (entryToRows(child, level + 1)))
    const primaryRow = {
            ...rest,
            level,
            verticalRows: (rowsFromChildren.length > 0)
                ? rowsFromChildren.slice(0, -1).reduce<number>((previous, child) => (previous + child.length), 0) + 1
                : 0
        } as unknown as FlatTreeRow<T>
    return rowsFromChildren.reduce<FlatTree<T>>((previous, childRows) => ([...previous, ...childRows]), [primaryRow])
}

export const convertNestedToFlat = <T>(nestedTree: NestedTree<T>): FlatTree<T> => {
    return nestedTree.reduce<FlatTree<T>>((previous, entry) => ([...previous, ...(entryToRows(entry, 0))]), [])
}

export default convertNestedToFlat
