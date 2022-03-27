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
    node
}) => {
    const { tag, props } = node
    return predicate.reduce((previous, component) => {
        const { matchType } = component
        switch(matchType) {
            case 'tag':
                if (tag === component.tag) {
                    return previous
                }
                break
            case 'property':
                if (props[component.key]?.value === component.value) {
                    return previous
                }
                break
            case 'first':
                return previous
            default:
                break
        }
        return false    
    }, true)
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
    .addOperation("search(selector)", {
        TagOpen(open, tag, props, close) {
            const { matches } = this.args.selector
            return {
                tagMatch: matches.length > 0 &&
                    evaluateMatchPredicate({
                        predicate: matches[0],
                        node: { tag: tag.toNode(), props: Object.assign({}, ...(props.toNode() || {})) }
                    })
            }
        },
        TagSelfClosing(open, tag, props, close) {
            if (this.args.selector.selector === 'MatchFirst') {
                return [this.toNode()]
            }
            const { matches } = this.args.selector
            const tagMatch = matches.length === 1 &&
                evaluateMatchPredicate({
                    predicate: matches[0],
                    node: { tag: tag.toNode(), props: Object.assign({}, ...(props.toNode() || {})) }
                })
            if (tagMatch) {
                return [this.toNode()]
            }
            else {
                return []
            }
        },
        TagExpression(open, contents, close) {
            if (this.args.selector.selector === 'MatchFirst') {
                return [this.toNode()]
            }
            const { tagMatch } = open.search(this.args.selector)
            if (tagMatch) {
                const { matches, selector } = this.args.selector
                if (matches.length > 1) {
                    const remainingTags = matches.slice(1)
                    return contents.search({ selector, matches: remainingTags })
                }
                else {
                    return [this.toNode()]
                }
            }
            else {
                return contents.search(this.args.selector)
            }
        },
        _iter(...contents) {
            const { matches } = this.args.selector
            if (matches.length > 0 && matches[0].find(({ matchType }) => (matchType === 'first'))) {
                return contents.reduce((previous, child) => {
                    if (previous.length) {
                        return previous
                    }
                    return [...previous, ...child.search(this.args.selector)]
                }, [])
            }
            return contents.reduce((previous, child) => {
                return [...previous, ...child.search(this.args.selector)]
            }, [])
        },
        _terminal() {
            return []
        }
    })

export const wmlSelectorFactory = (schema) => (searchString) => {
    if (searchString !== '') {
        const match = wmlQueryGrammar.match(searchString)
        if (!match.succeeded()) {
            return []
        }
        const selector = wmlSelectorSemantics(match).parse()
        return wmlQuerySemantics(schema).search(selector)
    }
    else {
        return wmlQuerySemantics(schema).search({ selector: 'MatchFirst' })
    }
}
