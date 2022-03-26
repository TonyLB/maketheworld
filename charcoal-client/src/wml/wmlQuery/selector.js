import wmlGrammar from '../wmlGrammar/wml.ohm-bundle.js'

import wmlQueryGrammar from '../wmlGrammar/wmlQuery.ohm-bundle.js'

export const wmlSelectorSemantics = wmlQueryGrammar.createSemantics()
    .addOperation("parse", {
        MatchAncestry(matches) {
            return {
                selector: 'MatchAncestry',
                matches: matches.parse()
            }
        },
        matchComponent(match) {
            return match.parse()
        },
        matchPredicate(match) {
            return match.parse()
        },
        wmlLegalTag(value) {
            return {
                matchType: 'tag',
                tag: this.sourceString
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
    const { tag } = node
    const { matchType } = predicate
    switch(matchType) {
        case 'tag':
            if (tag.sourceString === predicate.tag) {
                return true
            }
            break
        default:
            break
    }
    return false
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
                tag: tag.toNode(),
                tagEnd: tag.source.endIdx,
                props: Object.assign({}, ...(props.toNode() || {})),
                contents: []
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
                        node: { tag, props }
                    })
            }
        },
        TagSelfClosing(open, tag, props, close) {
            const { matches } = this.args.selector
            return {
                tagMatch: matchess.length === 1 &&
                    evaluateMatchPredicate({
                        predicate: matches[0],
                        node: { tag, props }
                    })
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
            return contents.reduce((previous, child) => ([...previous, ...child.search(this.args.selector)]), [])
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
