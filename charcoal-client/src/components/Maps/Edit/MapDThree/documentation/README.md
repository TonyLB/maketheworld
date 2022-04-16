
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
- Components creating a D3 Map need to be able to update the semantic content of its map at any time
- Components creating a D3 Map need to be able to specify a callback to be called when the map as a
whole stabilizes on a resting state

---

## Usage

---

```js
    const mapD3 = new MapDThree({
            layers,
            onExitDrag: setExitDrag,
            onAddExit: (fromRoomId, toRoomId, double) => {
                dispatch({ type: 'addExit', fromRoomId, toRoomId, double })
            }
        })
```

---

## Behaviors

### Expected arguments

```ts
    interface MapLayerRoom {
        roomId: string;
        x: number;
        y: number;
    }

    interface MapLayer {
        //
        // Records rooms by roomId
        //
        rooms: Record<string, MapLayerRoom>;
        //
        // And separately (for easy update) records their visibility
        //
        roomVisibility: Record<string, boolean>;
    }

    interface MapDThreeProps {
        roomLayers: MapLayer[];
        exits: { to: string; from: string; visible: boolean; }[];
        onStability?: SimCallback;
        onTick?: SimCallback;
        onExitDrag?: (dragTarget: { sourceRoomId: string, x: number, y: number }) => void
        onAddExit?: (fromRoomId: string, toRoomId: string, double: boolean) => void
    }
```