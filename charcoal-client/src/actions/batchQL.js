export const extractMutation = (graphQLTemplate) => {
    const match = /^\s*mutation[^{]*\{\s*(\w*.*)\}\s*$/gs.exec(graphQLTemplate)
    if (match) {
        const strippedMatch = match[1].replace(/\n\s*/g, '\n')
        return strippedMatch
    }
    else {
        return null
    }
}

export const populateMutationVariables = ({ template: graphQLTemplate, ...rest }) => {
    return Object.entries(rest)
        .sort(([keyA], [keyB]) => (keyB.localeCompare(keyA)))
        .reduce((previous, [ key, value ]) => {
            const re = new RegExp(`\\$${key}`, 'g')
            return previous.replace(re, value ? `"${value}"` : 'null')
        }, graphQLTemplate)
}

export const batchMutations = (mutations) => {
    const internalTemplates= mutations.map((mutation, index) => (`Field${index}: ${mutation}`))
        .join('')
    return `mutation BatchMutation {\n${internalTemplates}}`
}