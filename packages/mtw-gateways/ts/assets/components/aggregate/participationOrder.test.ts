import type { ImportVerticalHop } from '../verticals/fetch'

import { mergeParticipationOrderFromImportVerticalHops } from './participationOrder'

const hop = (
    parentAssetId: string,
    childAssetId: string,
): ImportVerticalHop => ({
    universalKey: 'FEATURE#X',
    dataCategory: `Meta::Import::${parentAssetId.replace('ASSET#', '')}::${childAssetId.replace('ASSET#', '')}`,
    parentStripped: parentAssetId.replace('ASSET#', ''),
    childStripped: childAssetId.replace('ASSET#', ''),
    parentAssetId: parentAssetId as ImportVerticalHop['parentAssetId'],
    childAssetId: childAssetId as ImportVerticalHop['childAssetId'],
})

describe('mergeParticipationOrderFromImportVerticalHops', () => {
    it('returns empty order for no hops', () => {
        expect(mergeParticipationOrderFromImportVerticalHops([])).toEqual([])
    })

    it('orders a single parent-to-child chain', () => {
        expect(
            mergeParticipationOrderFromImportVerticalHops([
                hop('ASSET#Base', 'ASSET#Layer'),
            ])
        ).toEqual(['ASSET#Base', 'ASSET#Layer'])
    })

    it('uses DFS preorder with ascending child order on a branch', () => {
        expect(
            mergeParticipationOrderFromImportVerticalHops([
                hop('ASSET#Canon', 'ASSET#ModB'),
                hop('ASSET#Canon', 'ASSET#ModA'),
            ])
        ).toEqual(['ASSET#Canon', 'ASSET#ModA', 'ASSET#ModB'])
    })

    it('visits independent roots in ascending AssetUUID order', () => {
        expect(
            mergeParticipationOrderFromImportVerticalHops([
                hop('ASSET#RootB', 'ASSET#ChildB'),
                hop('ASSET#RootA', 'ASSET#ChildA'),
            ])
        ).toEqual(['ASSET#RootA', 'ASSET#ChildA', 'ASSET#RootB', 'ASSET#ChildB'])
    })

    it('orders a three-asset chain', () => {
        expect(
            mergeParticipationOrderFromImportVerticalHops([
                hop('ASSET#Base', 'ASSET#Middle'),
                hop('ASSET#Middle', 'ASSET#Top'),
            ])
        ).toEqual(['ASSET#Base', 'ASSET#Middle', 'ASSET#Top'])
    })
})
