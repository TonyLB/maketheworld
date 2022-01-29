import wmlGrammar from '../wmlGrammar/wml.ohm-bundle'
import { Interval } from 'ohm-js'

import wmlQueryGrammar from '../wmlGrammar/wmlQuery.ohm-bundle'

// interface WMLSelection {
//     source: Interval;
//     node: Node;
// }

export const wmlSelectorSemantics = wmlQueryGrammar.createSemantics()
    .addOperation("parse", {
        TagAncestry(tags) {
            return {
                selector: 'TagAncestry',
                tags: tags.parse()
            }
        },
        WMLLegalTag(value) {
            return this.sourceString
        },
        _iter(...nodes) {
            return nodes.map((node) => (node.parse()))
        }    
    })

const wmlQuerySemantics = wmlGrammar.createSemantics()
    .addOperation("toNode", {
        TagOpen(open, tag, props, close) {
            return {
                tag: tag.toNode(),
                props: Object.assign({}, ...(props.toNode() || {}))
            }
        },
        TagSelfClosing(open, tag, props, close) {
            return {
                tag: tag.toNode(),
                props: Object.assign({}, ...(props.toNode() || {})),
                contents: []
            }
        },
        TagExpression(open, contents, close) {
            return {
                ...open.toNode(),
                contents: contents.toNode()
            }
        },
        tagBooleanArgument(key, spacing) {
            return { [key.toNode()]: true }
        },
        tagArgumentQuoted(key, equal, value) {
            return { [key.toNode()]: value.sourceString.slice(0, -1) }
        },
        TagArgumentBracketed(key, equal, value, close) {
            return { [key.toNode()]: value.sourceString }

        },
        string(node) {
            return this.sourceString
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
            const { tags } = this.args.selector
            return {
                tagMatch: tags.length > 0 && (tag.sourceString === tags[0])
            }
        },
        TagExpression(open, contents, close) {
            const { tagMatch } = open.search(this.args.selector)
            if (tagMatch) {
                const { tags, selector } = this.args.selector
                if (tags.length > 1) {
                    const remainingTags = tags.slice(1)
                    return contents.search({ selector, tags: remainingTags })
                }
                else {
                    return [{
                        node: this.toNode(),
                        source: {
                            start: this.source.startIdx,
                            end: this.source.endIdx
                        },
                    }]
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
        //
        // TODO: Create a first cut semantics engine that generates a tree of Tags with leafs of their inner text.
        // Figure out a way to return *both* the relevant and searchable semantic data of the tag, *and* the
        // Intervals into the source string, that will allow for future editing of the string.
        //
    })

export const wmlSelectorFactory = (schema) => (searchString) => {
    const match = wmlQueryGrammar.match(searchString)
    if (!match.succeeded()) {
        return []
    }
    const selector = wmlSelectorSemantics(match).parse()
    //
    // TODO: Pass the selector to the querySemantics above, in order to parse out the
    // specific nodes/ranges being looked at
    //
    return wmlQuerySemantics(schema).search(selector)
}
