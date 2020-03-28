export const getNeighborhoods = ({ neighborhoods }) => (neighborhoods)

const findSubtree = ({ ancestryList, neighborhoods }) => {
    if (ancestryList.length) {
        return findSubtree({
            ancestryList: ancestryList.slice(1),
            neighborhoods: (neighborhoods[ancestryList[0]] || {}).children || {}
        })
    }
    return neighborhoods
}

export const getNeighborhoodSubtree = ({ roomId, ancestry }) => ({ neighborhoods={} }) => {
    if (!ancestry) {
        return {}
    }
    const ancestryList = ancestry.split(':').slice(0, -1)
    const siblingNeighborhoods = findSubtree({ neighborhoods, ancestryList })
    return Object.entries(siblingNeighborhoods)
        .filter(([key]) => (!roomId || (key !== roomId) ))
        .reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
}

const excludeSubtree = ({ ancestryList, neighborhoods }) => {
    if (ancestryList.length) {
        const { [ancestryList[0]]: pullOut, ...restOfNeighborhoods } = neighborhoods
        return {
            ...restOfNeighborhoods,
            ...((ancestryList.length > 1) ? {
                    [ancestryList[0]]: {
                        ...pullOut,
                        children: excludeSubtree({
                            ancestryList: ancestryList.slice(1),
                            neighborhoods: (neighborhoods[ancestryList[0]] || {}).children || {}
                        })
                    }
                } : {})
        }
    }
    return {}
}

export const getExternalTree = ({ roomId, ancestry }) => ({ neighborhoods={} }) => {
    if (!ancestry) {
        return neighborhoods
    }
    const ancestryList = ancestry.split(':').slice(0, -1)
    return excludeSubtree({ neighborhoods, ancestryList })
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

export const getByAncestry = (ancestry) => ({ neighborhoods={} }) => {
    return searchTreeByAncestryList({
        ancestryList: ancestry.split(':'),
        neighborhoods
    })
}