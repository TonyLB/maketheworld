import { FlatTree, FlatTreeRow, NestedTree, NestedTreeEntry } from './interfaces'

const entryToRows = <T>(entry: NestedTreeEntry<T>, level: number = 0): FlatTree<T> => {
    const { children, open, draggingSource, draggingTarget, item } = entry
    const rowsFromChildren = (open === false) ? [] : children.map<FlatTree<T>>((child) => (entryToRows(child, level + 1)))
    const primaryRow = {
            item,
            level,
            draggingSource,
            draggingTarget,
            open: children.length ? open ?? true : undefined,
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
