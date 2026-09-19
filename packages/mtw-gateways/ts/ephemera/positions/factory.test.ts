import { emptyLudicGraphPayload, normalizeStoredLudicGraph } from './factory'

// PN-5 (presenceNodes Slice 2): these two functions used to take `tag: EphemeraLudicGraphNode['tag']`,
// which silently admitted `'Presence'` and let `{ tag, universalKey: componentId } as EphemeraLudicGraphNode`
// mint a structure-tagged node with a component universalKey --- the `as` cast meant the compiler
// reported nothing. Narrowing to `EphemeraLudicGraphComponentNode['tag']` is what actually closes
// this; the `as` cast is still present, so this guards against the parameter type silently
// re-widening in the future.
describe('emptyLudicGraphPayload / normalizeStoredLudicGraph', () => {
    it('mints a component-tagged root node for a component tag', () => {
        expect(emptyLudicGraphPayload('OBJECT#helmet', 'Object')).toEqual({
            rootId: 'OBJECT#helmet',
            nodes: [{ tag: 'Object', universalKey: 'OBJECT#helmet' }],
            edges: [],
            ports: [],
        })
    })

    it('rejects a structure tag at compile time', () => {
        // @ts-expect-error --- 'Presence' is not a component tag; a presence node is never minted here
        emptyLudicGraphPayload('OBJECT#helmet', 'Presence')
        // @ts-expect-error --- same restriction on the normalizing path
        normalizeStoredLudicGraph(undefined, 'OBJECT#helmet', 'Presence')
    })
})
