import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'

import wmlQueryGrammar from '../wmlGrammar/wmlQuery.ohm-bundle.js'

export const wmlSelectorSemantics = wmlQueryGrammar.createSemantics()
    .addOperation("parse", {
        MatchAncestry(matches) {
            const returnValue = {
                selector: 'MatchAncestry',
                matches: matches.parse()
            }
            return returnValue
        },
        matchComponent(match) {
            return match.parse()
        },
        wmlLegalTag(value) {
            return {
                matchType: 'tag',
                tag: this.sourceString
            }
        },
        propertyEqualityFilter(spaceOne, key, spaceTwo, syntaxOne, value, syntaxTwo) {
            return {
                matchType: 'property',
                key: key.sourceString,
                value: value.sourceString
            }
        },
        propertyFilter(syntaxOne, filter, syntaxTwo) {
            return filter.parse()
        },
        firstFilter(syntax) {
            return {
                matchType: 'first'
            }
        },
        _iter(...nodes) {
            return nodes.map((node) => (node.parse()))
        }    
    })

const evaluateMatchPredicate = ({
    predicate,
    node,
    priorMatches = []
}) => {
    const { tag, props } = node
    const { matchType } = predicate
    switch(matchType) {
        case 'tag':
            if (tag === predicate.tag) {
                return true
            }
            break
        case 'property':
            if (props[predicate.key]?.value === predicate.value) {
                return true
            }
            break
        case 'first':
            if (node.start === priorMatches[0]?.start) {
                return true
            }
            break
        default:
            break
    }
    return false    
}

const mergeNodeMaps = (previous, argMap, options) => {
    return Object.entries(argMap)
        .reduce((accumulator, [key, values]) => ({
            ...accumulator,
            [key]: [
                ...(accumulator[key] || []),
                ...values
            ]
        }), previous)
}

const flattenNodeMap = (nodeMap) => {
    return Object.values(nodeMap)
        .reduce((previous, values) => ([ ...previous, ...values ]), [])
        .sort(({ start: startA }, { start: startB }) => (startA - startB))
}

const nodeMapFromNode = (node, priorMatch) => ({
    [priorMatch || node.start]: [node]
})

const wmlQuerySemantics = wmlGrammar.createSemantics()
    .addOperation("toNode", {
        TagOpen(open, tag, props, close) {
            return {
                tag: tag.toNode(),
                tagEnd: tag.source.endIdx,
                props: Object.assign({}, ...(props.toNode() || {})),
            }
        },
        TagSelfClosing(open, tag, props, close) {
            return {
                type: 'tag',
                tag: tag.toNode(),
                tagEnd: tag.source.endIdx,
                props: Object.assign({}, ...(props.toNode() || {})),
                contents: [],
                start: this.source.startIdx,
                end: this.source.endIdx
            }
        },
        TagExpression(open, contents, close) {
            return {
                ...open.toNode(),
                type: 'tag',
                contents: contents.toNode(),
                start: this.source.startIdx,
                end: this.source.endIdx
            }
        },
        tagBooleanArgument(key, spacing) {
            return { [key.toNode()]: {
                value: true,
                start: key.source.startIdx,
                end: key.source.endIdx
            }}
        },
        tagArgumentQuoted(key, equal, value) {
            return { [key.toNode()]: {
                value: value.sourceString.slice(0, -1),
                start: this.source.startIdx,
                end: this.source.endIdx,
                valueStart: value.source.startIdx,
                valueEnd: value.source.endIdx-1
            }}
        },
        TagArgumentKey(key, equal, value, close) {
            return { [key.toNode()]: {
                value: value.sourceString,
                start: this.source.startIdx,
                end: this.source.endIdx,
                valueStart: value.source.startIdx,
                valueEnd: value.source.endIdx
            }}
        },
        TagArgumentBracketed(key, equal, value, close) {
            return { [key.toNode()]: {
                value: value.sourceString,
                start: this.source.startIdx,
                end: this.source.endIdx,
                valueStart: value.source.startIdx,
                valueEnd: value.source.endIdx
            }}
        },
        string(node) {
            return {
                type: 'string',
                value: this.sourceString,
                start: this.source.startIdx,
                end: this.source.endIdx
            }
        },
        _iter(...contents) {
            return contents.map((node) => (node.toNode()))
        },
        _terminal() {
            return this.sourceString
        }
    })
    .addOperation("search(props)", {
        TagOpen(open, tag, props, close) {
            const { predicate } = this.args.props
            return {
                tagMatch: evaluateMatchPredicate({
                        predicate,
                        node: {
                            start: this.source.startIdx,
                            tag: tag.toNode(),
                            props: Object.assign({}, ...(props.toNode() || {}))
                        },
                        priorMatches: this.args.props.currentNodes[this.args.props.priorMatch] || []
                    })
            }
        },
        TagSelfClosing(open, tag, tagProps, close) {
            const props = this.args.props
            const node = this.toNode()
            if (props.selector === 'MatchFirst') {
                return nodeMapFromNode(node)
            }
            //
            // If you are in SearchPrior mode then you're still parsing a part
            // of the tree that (while it might *contain* matches) was not a match
            // on prior *matchers*.  Keep looking until you end up in a part
            // of the tree that matched on previous macro-sweeps, then swith
            // from SearchPrior to SearchCurrent selector mode (noting the node
            // from which the prior match depends)
            //
            if (props.selector === 'SearchPrior') {
                if (node.start in props.currentNodes) {
                    return this.search({
                        ...props,
                        selector: 'SearchCurrent',
                        priorMatch: this.source.startIdx
                    })
                }
                else {
                    return {}
                }
            }
            //
            // If you are in SearchPrior mode then you're still parsing a part
            // of the tree that (while it might *contain* matches) was not a match
            // on prior *matchers*.  Keep looking until you end up in a part
            // of the tree that matched on previous macro-sweeps, then swith
            // from SearchPrior to SearchCurrent selector mode (noting the node
            // from which the prior match depends)
            //
            if (props.selector === 'SearchCurrent') {
                const comparisonStarts = props.currentNodes[props.priorMatch].map(({ start }) => (start))
                if (comparisonStarts.includes(node.start)) {
                    return this.search({
                        ...props,
                        selector: 'MatchCurrent'
                    })
                }
                else {
                    return {}
                }
            }
            const { predicate } = props
            const tagMatch = evaluateMatchPredicate({
                    predicate,
                    node: {
                        start: this.source.startIdx,
                        tag: tag.toNode(),
                        props: Object.assign({}, ...(tagProps.toNode() || {}))
                    },
                    priorMatches: props.currentNodes[props.priorMatch] || []
                })
            if (tagMatch) {
                return nodeMapFromNode(node, props.priorMatch)
            }
            else {
                return {}
            }
        },
        TagExpression(open, contents, close) {
            const props = this.args.props
            const node = this.toNode()
            if (props.selector === 'MatchFirst') {
                return nodeMapFromNode(node)
            }
            //
            // If you are in SearchPrior mode then you're still parsing a part
            // of the tree that (while it might *contain* matches) was not a match
            // on prior *matchers*.  Keep looking until you end up in a part
            // of the tree that matched on previous macro-sweeps, then swith
            // from SearchPrior to SearchCurrent selector mode (noting the node
            // from which the prior match depends)
            //
            if (props.selector === 'SearchPrior') {
                if (node.start in props.currentNodes) {
                    return this.search({
                        ...props,
                        selector: 'SearchCurrent',
                        priorMatch: this.source.startIdx
                    })
                }
                else {
                    return contents.search(props)
                }
            }
            //
            // If you are in SearchPrior mode then you're still parsing a part
            // of the tree that (while it might *contain* matches) was not a match
            // on prior *matchers*.  Keep looking until you end up in a part
            // of the tree that matched on previous macro-sweeps, then swith
            // from SearchPrior to SearchCurrent selector mode (noting the node
            // from which the prior match depends)
            //
            if (props.selector === 'SearchCurrent') {
                const comparisonStarts = props.currentNodes[props.priorMatch].map(({ start }) => (start))
                if (comparisonStarts.includes(node.start)) {
                    return this.search({
                        ...props,
                        selector: 'MatchCurrent'
                    })
                }
                else {
                    return contents.search(props)
                }
            }
            const { tagMatch } = open.search(props)
            if (tagMatch) {
                return nodeMapFromNode(node, props.priorMatch)
            }
            else {
                return contents.search(props)
            }
        },
        _iter(...contents) {
            const props = this.args.props
            return contents.reduce((previous, child) => {
                return mergeNodeMaps(previous, child.search(props))
            }, {})
        },
        _terminal() {
            return {}
        }
    })

export const wmlSelectorFactory = (schema) => (searchString) => {
    const startingNodes = wmlQuerySemantics(schema).search({ selector: 'MatchFirst' })
    if (searchString !== '') {
        const match = wmlQueryGrammar.match(searchString)
        if (!match.succeeded()) {
            return []
        }
        const selector = wmlSelectorSemantics(match).parse()
        return flattenNodeMap(selector.matches.reduce((previous, match) => {
            const aggregateNodeMap = match.reduce((accumulator, predicate) => {
                const returnValue = wmlQuerySemantics(schema).search({
                    selector: 'SearchPrior',
                    predicate,
                    currentNodes: accumulator })
                return returnValue
            }, previous)
            return Object.assign({}, ...Object.values(flattenNodeMap(aggregateNodeMap)).map(nodeMapFromNode))
        }, startingNodes))
    }
    else {
        return flattenNodeMap(startingNodes)
    }
}
