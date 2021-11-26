const addError = (node, error) => ({
    ...node,
    errors: [
        ...(node.errors || []),
        error
    ]
})

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

const assignExitContext = (node, ancestry) => {
    if (node.tag === 'Exit') {
        const { to, from } = node
        const ancestryMap = topDownMap(ancestry)
        const roomId = ancestryMap.Room && ancestryMap.Room.key
        if (!roomId) {
            return node
        }
        if (to && from) {
            if (roomId !== to && roomId !== from) {
                return addError(node, `Cannot assign both to (${to}) and from (${from}) different from containing room (${roomId}) in Exit tag.`)
            }
            return node
        }
        else {
            if (to) {
                return {
                    ...node,
                    from: roomId
                }
            }
            else {
                if (from) {
                    return {
                        ...node,
                        to: roomId
                    }
                }
            }
        }
    }
    return node
}

const aggregateConditionals = (assignTest = () => true) => (node, ancestry) => {
    if (assignTest(node)) {
        const conditions = ancestry
            .filter(({ tag }) => (tag === 'Condition'))
            .map((node) => (node["if"]))
        return {
            ...node,
            conditions
        }
    }
    return node
}

const wmlProcessDown = (processFunctions = [], ancestry = []) => (node) => {
    const { contents = [], ...rest } = node
    const newNode = processFunctions.reduce((previous, process) => (process(previous, ancestry)), rest)
    return {
        ...newNode,
        contents: contents.map(wmlProcessDown(processFunctions, [...ancestry, newNode]))
    }
}

exports.assignContextTagIds = assignContextTagIds
exports.assignExitContext = assignExitContext
exports.aggregateConditionals = aggregateConditionals
exports.wmlProcessDown = wmlProcessDown