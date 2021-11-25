const topDownMap = (ancestorList) => (
    ancestorList.reduce((previous, { tag, ...rest }) => ({
        ...previous,
        [tag]: {
            tag,
            ...rest
        }
    }), {})
)

const assignContextTagIds = (tagsMap, assignTest = () => true) => (node, ancestry) => {
    if (assignTest(node)) {
        const ancestryMap = topDownMap(ancestry)
        const tagsToAssign = Object.entries(tagsMap).filter(([tag]) => ancestryMap[tag])
        return tagsToAssign.reduce((previous, [tag, label]) => ({
            ...previous,
            [label]: ancestryMap[tag].key
        }), node)    
    }
    return node
}

const wmlProcessDown = (processFunctions = [], ancestry = []) => (node) => {
    const { contents, ...rest } = node
    const newNode = processFunctions.reduce((previous, process) => (process(previous, ancestry)), rest)
    return {
        ...newNode,
        contents: contents.map(wmlProcessDown(processFunctions, [...ancestry, newNode]))
    }
}

exports.assignContextTagIds = assignContextTagIds
exports.wmlProcessDown = wmlProcessDown