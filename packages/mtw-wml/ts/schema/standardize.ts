//
// standardizeSchema creates a new schema with the exact same semantic content as the input,
// but with everything organized in a standard structure (see README.standardize.md)
//

import { SchemaTag, SchemaWithKey, isSchemaAsset, isSchemaWithKey } from "./baseClasses"
import { GenericTree, TreeId } from "../tree/baseClasses";
import SchemaTagTree from "../tagTree/schema";
import { unique } from "../list";
import { TagTreeMatchOperation } from "../tagTree";
import { selectKeysByTag } from "../normalize/selectors/keysByTag";
import { unmarkInherited } from "./treeManipulation/inherited";
import { genericIDFromTree, maybeGenericIDFromTree } from "../tree/genericIDTree";

const reorderChildren = (order: SchemaTag["tag"][]) => (children: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    return children.sort(({ data: dataA }, { data: dataB }): number => {
        const orderLookupA = order.findIndex((tag) => (tag === dataA.tag))
        const orderLookupB = order.findIndex((tag) => (tag === dataB.tag))
        if (orderLookupA === -1) {
            return orderLookupB === -1 ? 0 : 1
        }
        return orderLookupB === -1 ? -1 : orderLookupA - orderLookupB
    })
}

const stripProperties = (tag: SchemaTag): SchemaTag => {
    let returnValue = tag
    const propertiesToStrip = ['x', 'y', 'from', 'as']
    propertiesToStrip.forEach((property) => {
        if (property in returnValue) {
            returnValue = { ...returnValue, [property]: undefined }
        }
    })
    return returnValue
}

export const standardizeSchema = (...schemata: GenericTree<SchemaTag, Partial<TreeId & { inherited: boolean }>>[]): GenericTree<SchemaTag> => {
    const componentKeys: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
    const anyKeyedComponent: TagTreeMatchOperation<SchemaTag> = { or: componentKeys.map((key) => ({ match: key })) }
    const allAssetKeys = unique(...schemata.map((tree) => (selectKeysByTag('Asset')(tree))))
    return allAssetKeys.map((assetKey) => {
        const tagTree = new SchemaTagTree(schemata.map((tree) => {
            const assetNode = tree.find(({ data }) => (isSchemaAsset(data) && data.key === assetKey))
            return assetNode ? [assetNode] : []
        }).flat(1))
        tagTree._merge = ({ data: dataA, id: idA, inherited: inheritedA }, { data: dataB, id: idB, inherited: inheritedB }) => (
            inheritedA && !inheritedB
                ? { data: { ...dataA, ...dataB }, id: idB ?? idA }
                : { data: { ...dataA, ...dataB }, id: idA ?? idB }
        )
        let topLevelItems: GenericTree<SchemaTag, Partial<TreeId>> = []
    
        const keysByComponentType = (tag: SchemaWithKey["tag"]) => (
            unique(tagTree
                .filter({ match: tag })
                .prune({ after: { match: tag } })
                .prune({ before: { match: tag } })
                .tree
                .map(({ data }) => {
                    if (data.tag !== tag) {
                        throw new Error('standardizeSchema tag mismatch')
                    }
                    return data.key
                })
            ).sort()
        )

        //
        // Loop through each tag in standard order
        //
        componentKeys.forEach((tag) => {
            //
            // Loop through each key present for that tag
            //
            const keys = keysByComponentType(tag)
            keys.forEach((key) => {
                //
                // Aggregate and reorder all top-level information
                //
                const nodeMatch: TagTreeMatchOperation<SchemaTag> = { match: ({ data }) => (data.tag === tag && data.key === key) }
                const items = unmarkInherited(maybeGenericIDFromTree(tagTree
                    .filter(nodeMatch)
                    //
                    // TODO: Refactor reordered to accept more general matching criteria, and include childNodeMatch between Name and Description
                    //
                    .prune({ or: [{ after: { sequence: [nodeMatch, anyKeyedComponent] } }, { match: 'Import' }, { match: 'Export' }] })
                    .reordered([{ match: tag }, { match: 'Name' }, { match: 'Description' }, { connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Inherited' }])
                    .prune({ before: nodeMatch })
                    .tree))
                items.forEach((item) => {
                    topLevelItems.push({
                        data: stripProperties(item.data),
                        children: reorderChildren(['Name', 'Description', 'Exit', 'Image', 'Room', 'If'])(item.children),
                        id: item.id
                    })
                })
            })
        })

        //
        // Add standardized view of all Imports to the results
        //
        const importTagTree = tagTree
            .filter({ match: 'Import' })
            .prune({ or: [
                { before: { match: 'Import' } },
                { after: { or: [
                    { match: 'Room' },
                    { match: 'Feature' },
                    { match: 'Knowledge' },
                    { match: 'Bookmark' },
                    { match: 'Map' },
                    { match: 'Message' },
                    { match: 'Moment' },
                    { match: 'Variable' },
                    { match: 'Computed' },
                    { match: 'Action' }
                ]}}
            ]})
        const importItems = importTagTree.tree.filter(({ children }) => (children.length))
    
        if (importItems.length) {
            topLevelItems = [...topLevelItems, ...importItems]
        }
    
        //
        // Add standardized view of all Exports to the results
        //
        const exportTagTree = tagTree
            .filter({ match: 'Export' })
            .prune({ or: [
                { before: { match: 'Export' } },
                { after: anyKeyedComponent }
            ]})
        const exportItems = exportTagTree.tree.filter(({ children }) => (children.length))
    
        if (exportItems.length) {
            topLevelItems = [...topLevelItems, ...exportItems]
        }
    
        const id = schemata.reduce<string | undefined>((previous, tree) => {
            const item = tree.find(({ data }) => (isSchemaWithKey(data) && data.key === assetKey))
            if (item && !item.inherited) {
                return item.id ?? previous
            }
            return previous
        }, undefined)
        return {
            data: { tag: 'Asset', key: assetKey, Story: undefined },
            children: topLevelItems,
            id
        }
    })

}

export default standardizeSchema
