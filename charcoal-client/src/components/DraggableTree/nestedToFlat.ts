import { FlatTree, FlatTreeRow, FlatTreeAncestor, NestedTree, NestedTreeEntry } from './interfaces'

const entryToRows = <T>(entry: NestedTreeEntry<T>, level: number = 0, draggingPoints: FlatTreeAncestor[] = [] ): FlatTree<T> => {
    const { key, children, open, draggingSource, draggingTarget, item } = entry
    const rowsFromChildren = (open === false) ? [] : children.map<FlatTree<T>>((child, index) => (entryToRows(child, level + 1, [...draggingPoints, { key, position: index + 1 }])))
    const primaryRow = {
            key,
            item,
            level,
            draggingSource,
            draggingTarget,
            open: children.length ? open ?? true : undefined,
            verticalRows: (rowsFromChildren.length > 0)
                ? rowsFromChildren.slice(0, -1).reduce<number>((previous, child) => (previous + child.length), 0) + 1
                : 0,
            draggingPoints
        } as unknown as FlatTreeRow<T>
    return rowsFromChildren.reduce<FlatTree<T>>((previous, childRows) => ([...previous, ...childRows]), [primaryRow])
}

export const convertNestedToFlat = <T>(nestedTree: NestedTree<T>): FlatTree<T> => {
    return nestedTree.reduce<FlatTree<T>>((previous, entry, index) => ([...previous, ...(entryToRows(entry, 0, [{ position: index + 1 }]))]), [])
}

export default convertNestedToFlat
