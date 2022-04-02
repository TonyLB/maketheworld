
---
---

# D3 Map
This class maintains the in-motion status of a single layer of MapArea as it is animated by D3.

---

## Needs Addressed

---

- D3 functionality needs to be self-contained, so that the rest of the system can be programmed without
constantly thinking about how D3 works (hint:  It's complicated and intensely generalizable, outcome
should be simple and specific to this use-case)
- Each layer needs to be able to have data cascaded to it from prior (higher priority) layers, and
incorporate that changing data into its own animation
- Components creating a D3 Map Iterator need to be able to update the *semantic* content of its map
at any time (introducing new nodes, and removing old nodes) without interrupting the ongoing animation
- Components creating a D3 Map Iterator need to be able to update the *position* content of its
map at any time (forcibly overwriting node information)
- Components creating a D3 Map Iterator need to be able to specify a callback to be called when the
iterator stabilizes on a resting state (TODO: Detail for what purpose ... I suspect that this
requirement is more general than the real use-case, and introduces unneeded complication)
- Components creating a D3 Map Iterator need to be able to directly drag a single node of the
layer to a specific position, in response to a Drag-and-Drop action in the UI.

---

## Usage

---

```js
    const newMap = new MapDThreeIterator(key, nodes, links, index > 0 ? () => (this.layers[index-1].nodes) : () => [])
```

---

## Behaviors

---

### Expected node format

```ts
    export type SimNode = SimulationNodeDatum & {
        id: string;
        zLevel?: number;
        cascadeNode: boolean;
        roomId: string;
        visible: boolean;
    }
```

---

### Expected link format

(See D3-force Typescript)

```ts
    SimulationLinkDatum<SimulationNodeDatum>
```

---

### Methods

***update*** (nodes, links, forceRestart, getCascadeNodes?):  Accepts a new set of nodes and links and updates the existing layer.  Restarts the animation if:
- Nodes are added or removed
- Links are added, removed, or redirected
- The forceRestart property is passed true

***setCallbacks*** (callback, stabilityCallback): Directly sets the internal callback and stabilityCallback members

***liven*** (first): Starts the animation for a layer.  If first is passed truthy, starts animation at alpha: 1.0, with a target of 0.0 (i.e., this is the
layer currently trying to descend toward stability).  Otherwise, sets alpha target to 1.0 (i.e., this layer stays live until earlier layers stabilize)

***dragNode*** ({ roomId, x, y }): Forcibly changes the position of a single node

***endDrag*** (): Releases the temporarily force-held state of the dragged node, putting it back into animation-driven motion

---