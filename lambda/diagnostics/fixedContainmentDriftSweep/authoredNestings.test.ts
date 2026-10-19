jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { authoredChildrenOf } from './authoredNestings'

const node = (universalKey: string, ref = 1) => ({ universalKey, ref })

describe('authoredChildrenOf', () => {
    const nodesByAsset: Record<string, ReturnType<typeof node>[]> = {}
    const deps = {
        cachedAssetsOf: jest.fn(async () => Object.keys(nodesByAsset)),
        nodesAcrossAssets: jest.fn(async (_parentId: string, assetIds: string[]) => assetIds.map((id) => nodesByAsset[id])),
    }

    beforeEach(() => {
        Object.keys(nodesByAsset).forEach((key) => delete nodesByAsset[key])
        deps.nodesAcrossAssets.mockClear()
    })

    it('takes the union of positive-ref nodes across the cached assets, deduplicated and sorted', async () => {
        nodesByAsset['ASSET#a'] = [node('ROOM#B'), node('ROOM#A')]
        nodesByAsset['ASSET#b'] = [node('ROOM#B'), node('ROOM#C')]
        expect(await authoredChildrenOf('AREA#X', deps)).toEqual(['ROOM#A', 'ROOM#B', 'ROOM#C'])
    })

    it('includes a nesting declared by an importing asset', async () => {
        nodesByAsset['ASSET#base'] = []
        nodesByAsset['ASSET#importer'] = [node('ROOM#Imported')]
        expect(await authoredChildrenOf('AREA#X', deps)).toEqual(['ROOM#Imported'])
    })

    it('excludes removed (negative-ref) nodes and presence nodes', async () => {
        nodesByAsset['ASSET#a'] = [node('ROOM#Gone', -1), node('ROOM#Kept')]
        nodesByAsset['ASSET#b'] = [{ universalKey: 'PRESENCE#Base', ref: 1, isPresence: true } as any]
        expect(await authoredChildrenOf('AREA#X', deps)).toEqual(['ROOM#Kept'])
    })

    it('reads nothing further when no asset has cached the component', async () => {
        expect(await authoredChildrenOf('AREA#X', deps)).toEqual([])
        expect(deps.nodesAcrossAssets).not.toHaveBeenCalled()
    })
})
