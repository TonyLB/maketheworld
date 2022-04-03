
---
---

# Draggable Tree
The Draggable Tree component presents a hierarchical tree structure visually on the page, and allows the user
to manipulate it directly by clicking, dragging, reordering and restructuring.

---

## Needs addressed

---

- User needs to easily understand hierarchical data
- User needs to be able to open and close nodes (to focus attention within the tree itself)
- User needs to be able to mark sections of the tree visible or non-visible (to focus attention within
ancillary components displaying the results of the tree structure in aggregate)
- User needs to be able to drag leaf nodes to new parents
- User needs to be able to drag whole branches to new parents

---

## Usage

---

```js
    return <DraggableTree
        tree={processedTree}
        renderComponent={renderComponent((key, visibility) => { setTree(setTreeVisibility(tree, { key, visibility })) })}
        renderHandle={handleRender}
        onOpen={(key) => { setTree(treeStateReducer(tree, { type: 'OPEN', key })) } }
        onClose={(key) => { setTree(treeStateReducer(tree, { type: 'CLOSE', key })) } }
        onMove={({ fromKey, toKey, position }) => { setTree(treeStateReducer(tree, { type: 'MOVE', fromKey, toKey, position })) }}
        canDrop={canDrop}
    />
```

---

## Behaviors

### Expected Tree format

```ts
    export type FlatTreeAncestor = {
        key?: string;
        position: number;
    }

    export type FlatTreeRow<T extends {}> = {
        key: string;
        item: T;
        level: number;
        open?: boolean;
        verticalRows?: number;
        draggingSource?: boolean;
        draggingTarget?: boolean;
        draggingPoints: FlatTreeAncestor[];
    }

    export type FlatTree<T extends {}> = FlatTreeRow<T>[]

    export type NestedTreeEntry<T extends {}> = {
        key: string;
        item: T;
        children: NestedTree<T>;
        open?: boolean;
        draggingSource?: boolean;
        draggingTarget?: boolean;
    }

    export type NestedTree<T extends {}> = NestedTreeEntry<T>[]
```