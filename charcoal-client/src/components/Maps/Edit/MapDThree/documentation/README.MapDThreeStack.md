
---
---

# MapDThreeStack
This class maintains the in-motion status of a stack of individual layers of MapArea nodes in
motion, with each successive layer having nodes copied from the previous layers (but not
influenced by the current layer).  Those previous nodes can effect active nodes on the current
layer, through collision or link forces.

---

## Needs Addressed

---

- D3 functionality needs to be self-contained, so that the rest of the system can be programmed without
constantly thinking about how D3 works (hint:  It's complicated and intensely generalizable, outcome
should be simple and specific to this use-case)
- Components creating a Stack need to be able to update the semantic content of its map at any time
- Layers of the Stack need to cascade their positions forward-only onto successive layers
- The Stack needs to keep track of the stability state of all of its layers, allowing each to settle
successively as it stops receiving updates from previously settled layers
- Components creating a Stack need to be able to specify a callback to be called when the map as a
whole stabilizes on a resting state
- Components using a Stack need to get a continuous stream of onTick information about the positions
of nodes within the Stack as they animate

---

## Usage

---

```ts
    interface MapDThreeLayerOutput {
        key: string;
        rooms: Record<string, { x: number; y: number; }>
    }

    interface MapDThreeStackProps {
        layers: SimulationReturn[];
        onStabilize?: (outputLayers: MapDThreeLayerOutput[]) => void;
        onTick?: (outputLayers: MapDThreeLayerOutput[]) => void;
    }

    const mapD3Stack = new MapDThreeStack({
            layers,
            onStabilize,
            onTick
        }: MapDThreeStackProps)
```

---

## Behaviors

### Expected layer format

Layers are passed in SimulationReturn format from the [**MapTree**](./README.md) component. [ TEMPORARY MEASURE DURING ITERATION ]

### Methods

***update***(layers: SimulationReturn[]): Updates the semantic structure of the Stack.  Does **not** change
the position of any node in a layer that was already in that layer.  Can set default positions on
nodes newly added to a layer.  Sets the first active layer of the Stack to the first layer that
receives meaningful changes.
