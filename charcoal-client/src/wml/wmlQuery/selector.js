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
        nthChildFilter(syntaxOne, indexString, syntaxTwo) {
            const index = parseInt(indexString.sourceString)
            return {
                matchType: 'nthChild',
                index
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
        case 'nthChild':
            if (priorMatches.find(({ contents }) => (contents.length >= predicate.index && (contents[predicate.index].start === node.start)))) {
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

const checkSearchPrior = (props, options = {}) => {
    //
    // If you are in SearchPrior mode then you're still parsing a part
    // of the tree that (while it might *contain* matches) was not a match
    // on prior *matchers*.  Keep looking until you end up in a part
    // of the tree that matched on previous macro-sweeps, then swith
    // from SearchPrior to SearchCurrent selector mode (noting the node
    // from which the prior match depends)
    //
    const { searchContents = null } = options
    if (props.toNode().start in props.args.props.currentNodes) {
        return props.search({
            ...props.args.props,
            selector: 'SearchCurrent',
            priorMatch: props.source.startIdx
        })
    }
    else {
        return searchContents ? searchContents.search(props.args.props) : {}
    }
}

const checkSearchCurrent = (props, options = {}) => {
    //
    // If you are in SearchCurrent mode then you're still parsing a part
    // of the tree that (while it is a descendant of prior matches) is
    // not a match on prior predicates in this matcher.  Keep looking
    // until you end up in a part of the tree that matched on previous
    // filtering sweeps, then switch from SearchCurrent to MatchCurrent
    // selector mode in order to apply your current predicate
    //
    const { searchContents = null } = options
    if (props.toNode().start in props.args.props.currentNodes) {
        return props.search({
            ...props.args.props,
            selector: 'MatchCurrent'
        })
    }
    else {
        return searchContents ? searchContents.search(props.args.props) : {}
    }
}

const wmlQuerySemantics = wmlGrammar.createSemantics()
    .addOperation("toNode", {
        TagOpen(open, tag, props, close) {
            return {
                tag: tag.toNode(),
                tagEnd: tag.source.endIdx,
                props: Object.assign({}, ...(props.toNode() || {})),
            }
        },
        TagSelfClosing(open, tag, props, close, spacer) {
            return {
                type: 'tag',
                tag: tag.toNode(),
                tagEnd: tag.source.endIdx - spacer.sourceString.length,
                props: Object.assign({}, ...(props.toNode() || {})),
                contents: [],
                start: this.source.startIdx,
                end: this.source.endIdx - spacer.sourceString.length
            }
        },
        TagExpression(open, contents, close, spacer) {
            return {
                ...open.toNode(),
                type: 'tag',
                contents: contents.toNode(),
                start: this.source.startIdx,
                end: this.source.endIdx - spacer.sourceString.length
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
        tagArgumentBracketed(key, equal, value, close) {
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
            const { predicate, currentNodes, priorMatch } = this.args.props
            return {
                tagMatch: evaluateMatchPredicate({
                        predicate,
                        node: {
                            start: this.source.startIdx,
                            tag: tag.toNode(),
                            props: Object.assign({}, ...(props.toNode() || {}))
                        },
                        priorMatches: currentNodes[priorMatch] || []
                    })
            }
        },
        TagSelfClosing(open, tag, tagProps, close, spacer) {
            const props = this.args.props
            const node = this.toNode()
            if (props.selector === 'MatchFirst') {
                return nodeMapFromNode(node)
            }
            if (props.selector === 'SearchPrior') {
                return checkSearchPrior(this)
            }
            if (props.selector === 'SearchCurrent') {
                return checkSearchCurrent(this)
            }
            const { predicate, currentNodes, priorMatch } = props
            const tagMatch = evaluateMatchPredicate({
                    predicate,
                    node: {
                        start: this.source.startIdx,
                        tag: tag.toNode(),
                        props: Object.assign({}, ...(tagProps.toNode() || {}))
                    },
                    priorMatches: currentNodes[priorMatch] || []
                })
            if (tagMatch) {
                return nodeMapFromNode(node, priorMatch)
            }
            else {
                return {}
            }
        },
        TagExpression(open, contents, close, spacer) {
            const props = this.args.props
            const node = this.toNode()
            if (props.selector === 'MatchFirst') {
                return nodeMapFromNode(node)
            }
            if (props.selector === 'SearchPrior') {
                return checkSearchPrior(this, { searchContents: contents })
            }
            if (props.selector === 'SearchCurrent') {
                return checkSearchCurrent(this, { searchContents: contents })
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

const debugNodeMap = (nodeMap) => (Object.assign({}, ...Object.entries(nodeMap).map(([key, values]) => ({ [key]: values.map(({ start }) => (start))}))))

export const wmlSelectorFactory = (schema, options = {}) => (searchString) => {
    const { currentNodes } = options
    const startingNodes = currentNodes !== undefined
        ? Object.assign({}, ...currentNodes.map((node) => ({ [node.start]: currentNodes })))
        : wmlQuerySemantics(schema).search({ selector: 'MatchFirst' })
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
            return Object.assign({}, ...Object.values(flattenNodeMap(aggregateNodeMap)).map((node) => nodeMapFromNode(node)))
        }, startingNodes))
    }
    else {
        return flattenNodeMap(startingNodes)
    }
}
