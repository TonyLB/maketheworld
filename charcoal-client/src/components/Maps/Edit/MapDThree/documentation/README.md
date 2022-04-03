
---
---

# D3 Map
This class maintains the in-motion status of a MapArea as it is animated by D3.

---

## Needs Addressed

---

- D3 functionality needs to be self-contained, so that the rest of the system can be programmed without
constantly thinking about how D3 works (hint:  It's complicated and intensely generalizable, outcome
should be simple and specific to this use-case)
- Components creating a D3 Map Iterator need to be able to update the content of its map at any time
- Components creating a D3 Map Iterator need to be able to specify a callback to be called when the
iterator stabilizes on a resting state

---

## Usage

---

```js
    const mapD3 = new MapDThree({
            tree,
            onExitDrag: setExitDrag,
            onAddExit: (fromRoomId, toRoomId, double) => {
                dispatch({ type: 'addExit', fromRoomId, toRoomId, double })
            }
        })
```

---

## Behaviors

### Expected tree format

Tree format is passed in NestedTree format from the [**DraggableTree**](../../../../DraggableTree/documentation/README.md) component.