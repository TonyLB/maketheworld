import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../positions/ludicGraph/testFixtures'
import { collectNestedObjectIds } from './collectNestedObjectIds'

describe('collectNestedObjectIds', () => {
    const objectId = (n: number) => `OBJECT#Nest${n}` as EphemeraObjectId

    it('stops expanding past the depth cap', async () => {
        // room -> obj1 -> obj2 -> ... -> obj7 (obj1..obj6 each host the next). Depth cap 5
        // expands obj1 through obj5 (discovering obj2..obj6) but never expands obj6 itself,
        // so obj7 --- only reachable by expanding obj6 --- is never discovered.
        const graphs = new Map<EphemeraObjectId, EphemeraObjectId[]>()
        for (let i = 1; i < 7; i++) {
            graphs.set(objectId(i), [objectId(i + 1)])
        }

        const result = await collectNestedObjectIds(
            [objectId(1)],
            async (id) => testLudicGraph(id, {
                nodes: (graphs.get(id) ?? []).map((hostedId) => ({ tag: 'Object' as const, universalKey: hostedId })),
            })
        )

        expect(result.has(objectId(6))).toBe(true)
        expect(result.has(objectId(7))).toBe(false)
    })

    it('terminates on a cyclic hosting fixture instead of looping forever', async () => {
        const a = objectId(101)
        const b = objectId(102)
        const graphs: Record<string, EphemeraObjectId[]> = {
            [a]: [b],
            [b]: [a],
        }

        const result = await collectNestedObjectIds(
            [a],
            async (id) => testLudicGraph(id, {
                nodes: (graphs[id] ?? []).map((hostedId) => ({ tag: 'Object' as const, universalKey: hostedId })),
            })
        )

        expect(result).toEqual(new Set([a, b]))
    })
})
