const makeIndent = (depth) => (new Array(depth).fill(`    `).join(''))

const removeLineBreaks = (value) => (value.replace(/\n\s*/g, ''))
const replaceLineBreaks = (value) => (value.replace(/\n\s*/g, ' '))

//
// Returns three possible values:
//   - 'None':  Nothing inside of this element would cause another element to want to nest it
//              (usually for small, plain text-contents or properties)
//   - 'Tag':   This element contains tags, so if the wrapping element wants to nest tags,
//              it should do so
//   - 'Nest':  This element is already nested, so any wrapping element should also nest
//
const shouldNestOr = (...items) => {
    const returnValue = items.reduce((previous, item) => {
            if (item === 'Nest') {
                return item
            }
            if (item === 'Tag' && previous === 'None')  {
                return item
            }
            return previous
        }, 'None')
    return returnValue
}
export const prettyPrintShouldNest = {
    _iter(...nodes) {
        const depth = this.args.depth
        return shouldNestOr(...nodes.map((node) => (node.prettyPrintShouldNest(depth))))
    },
    _terminal() {
        const depth = this.args.depth
        const returnValue = ((depth * 4 + replaceLineBreaks(this.sourceString).length) > 80) || (this.sourceString.search('\n') !== -1)
        return returnValue ? 'Nest' : 'None'
    },
    TextContents(item) {
        const depth = this.args.depth
        const returnValue = ((depth * 4 + item.sourceString.length) > 80) || (item.sourceString.search('\n') !== -1)
        return returnValue ? 'Nest' : 'None'
    },
    TagSelfClosing(open, tag, props, close) {
        const depth = this.args.depth
        if ((depth * 4 + replaceLineBreaks(this.sourceString).length) > 80) {
            return 'Nest'
        }
        return shouldNestOr('Tag', props.prettyPrintShouldNest(depth))
    },
    TagExpression(open, contents, close) {
        const depth = this.args.depth
        const contentsNesting = contents.prettyPrintShouldNest(depth + 1)
        if (contentsNesting === 'Tag') {
            return 'Nest'
        }
        return shouldNestOr((removeLineBreaks(this.sourceString) + depth * 4 > 80) ? 'Nest' : 'Tag', contentsNesting)
    },
    tagArgumentQuoted(key, eq, value) {
        return 'None'
    },
    tagBooleanArgument(item, spacer) {
        return 'None'
    },
    TagArgumentKey(key, eq, value, close) {
        return 'None'
    },
    TagArgumentBracketed(key, eq, value, close) {
        return value.sourceString.search('\n') !== -1 ? 'Nest' : 'None'
    }
}

export const prettyPrint = {
    _iter(...nodes) {
        const depth = this.args.depth
        return nodes.map((node) => (node.prettyPrint(depth)))
    },
    _terminal() {
        return this.sourceString
    },
    TagSelfClosing(open, tag, props, close) {
        const depth = this.args.depth
        const tagNesting = this.prettyPrintShouldNest(depth)
        if (tagNesting === 'Nest') {
            return `${open.sourceString}${tag.sourceString}\n${makeIndent(depth + 1)}${props.prettyPrint(depth+1).join(`\n${makeIndent(depth + 1)}`)}\n${makeIndent(depth)}${close.sourceString}`
        }
        return `${replaceLineBreaks(this.sourceString)}`
    },
    TagArgument(item) {
        return this.sourceString
    },
    string(item) {
        const depth = this.args.depth
        return `${replaceLineBreaks(this.sourceString).trim()}`
    },
    TextContents(item) {
        const depth = this.args.depth
        return `${replaceLineBreaks(this.sourceString).trim()}`
    },
    TagExpression(open, contents, close) {
        const depth = this.args.depth
        if (this.prettyPrintShouldNest(depth) === 'Nest') {
            return `${replaceLineBreaks(open.sourceString)}\n${makeIndent(depth + 1)}${contents.prettyPrint(depth + 1).join(`\n${makeIndent(depth + 1)}`)}\n${makeIndent(depth)}${close.sourceString}`
        }
        else {
            return `${replaceLineBreaks(open.sourceString)}${contents.prettyPrint(0).join('')}${close.sourceString}`
        }
    }
}