export const getNeighborhoodTree = ({ neighborhoodTree }) => (neighborhoodTree)

const findSubtree = ({ ancestryList, neighborhoodTree }) => {
    if (ancestryList.length) {
        return findSubtree({
            ancestryList: ancestryList.slice(1),
            neighborhoodTree: (neighborhoodTree[ancestryList[0]] || {}).children || {}
        })
    }
    return neighborhoodTree
}

export const getNeighborhoodSubtree = ({ roomId, ancestry }) => ({ neighborhoodTree={} }) => {
    if (!ancestry) {
        return {}
    }
    const ancestryList = ancestry.split(':').slice(0, -1)
    const siblingNeighborhoods = findSubtree({ neighborhoodTree, ancestryList })
    return Object.entries(siblingNeighborhoods)
        .filter(([key]) => (!roomId || (key !== roomId) ))
        .reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
}

const excludeSubtree = ({ ancestryList, neighborhoodTree }) => {
    if (ancestryList.length) {
        const { [ancestryList[0]]: pullOut, ...restOfNeighborhoodTree } = neighborhoodTree
        return {
            ...restOfNeighborhoodTree,
            ...((ancestryList.length > 1) ? {
                    [ancestryList[0]]: {
                        ...pullOut,
                        children: excludeSubtree({
                            ancestryList: ancestryList.slice(1),
                            neighborhoodTree: (neighborhoodTree[ancestryList[0]] || {}).children || {}
                        })
                    }
                } : {})
        }
    }
    return {}
}

export const getExternalTree = ({ roomId, ancestry }) => ({ neighborhoodTree={} }) => {
    if (!ancestry) {
        return neighborhoodTree
    }
    const ancestryList = ancestry.split(':').slice(0, -1)
    return excludeSubtree({ neighborhoodTree, ancestryList })
}

const searchTreeByAncestryList = ({ ancestryList, neighborhoods={} }) => {
    if (ancestryList.length > 1) {
        return searchTreeByAncestryList({
            ancestryList: ancestryList.slice(1),
            neighborhoods: (neighborhoods[ancestryList[0]] || {}).children || {}
        })
    }
    else {
        return (ancestryList.length > 0 && neighborhoods[ancestryList[0]]) || {}
    }
}

export const getByAncestry = (ancestry) => ({ neighborhoodTree={} }) => {
    return searchTreeByAncestryList({
        ancestryList: ancestry.split(':'),
        neighborhoodTree
    })
}