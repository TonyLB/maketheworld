import { produce } from 'immer'

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
    TagSelfClosing(open, tag, props, close, spacer) {
        const depth = this.args.depth
        if ((depth * 4 + replaceLineBreaks(this.sourceString).length) > 80) {
            return 'Nest'
        }
        return shouldNestOr('Tag', props.prettyPrintShouldNest(depth))
    },
    TagExpression(open, contents, close, spacer) {
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
    tagArgumentBracketed(key, eq, value, close) {
        return value.sourceString.search('\n') !== -1 ? 'Nest' : 'None'
    }
}

function * wordWrap({ prepend = '', value, depth }) {
    const tokens = value.split(/\s+/)
    let currentItem = prepend
    let firstToken = true
    for (const token of tokens) {
        const lineLocation = depth * 4 + currentItem.length
        if (!firstToken && (lineLocation + token.length + 1) > 80) {
            yield currentItem
            currentItem = token
        }
        else {
            currentItem = firstToken 
                ? `${currentItem}${token}`
                : `${currentItem} ${token}`
        }
        firstToken = false
    }
    yield currentItem
}

const lastItem = (list) => {
    return {
        last: list.length > 0 ? list.slice(-1)[0] : null,
        previous: list.slice(0, -1)
    }
}

const tagSubListWrap = ({ prepend = '', subList, depth }) => {
    const assembleSingleLine = ({ prepend, subList, depth }) => {
        let assemble = prepend
        const { last, previous } = lastItem(subList)
        for (const node of previous) {
            const prettyPrint = node.prettyPrintWithOptions(depth, { wordWrap: false, noTrim: false })
            if (prettyPrint.search('\n') !== -1) {
                throw new Error()
            }
            assemble = `${assemble}${prettyPrint}`
            if (assemble.length > 80) {
                throw new Error()
            }
        }
        const schema = last.schema()
        if (schema.tag === 'String') {
            //
            // For last string, word-wrap is an option
            //
            const tokens = schema.value.split(/\s+/)
            if (assemble.length + tokens[0].length > 80) {
                throw new Error()
            }
            const wrappedList = [...wordWrap({ prepend: assemble, value: schema.value, depth })]
            const { last: newPrepend, previous: lines } = lastItem(wrappedList)
            return {
                lines,
                prepend: newPrepend
            }
        }
        else {
            const prettyPrint = last.prettyPrintWithOptions(depth, { wordWrap: false, noTrim: false })
            if (prettyPrint.search('\n') !== -1) {
                throw new Error()
            }
            assemble = `${assemble}${prettyPrint}`
            if (assemble.length > 80) {
                throw new Error()
            }
            return {
                lines: [],
                prepend: assemble
            }
        }
    }
    try {
        //
        // First, try to fit everything on a single line
        //
        return assembleSingleLine({ prepend, subList, depth })
    }
    catch {}
    //
    // If that fails, check whether the prepend value is wrappable, and if so peel the
    // last token off of it onto a separate line and try again
    //
    const tokens = prepend.split(/\s+/)
    if (tokens.length > 1) {
        try {
            const { last: lastToken, previous: leftoverTokens } = lastItem(tokens)
            const { lines: followOnLines, prepend: newPrepend } = assembleSingleLine({
                prepend: lastToken,
                subList,
                depth
            })
            return {
                lines: [
                    leftoverTokens.join(' '),
                    ...followOnLines
                ],
                prepend: newPrepend
            }
        }
        catch {}
    }
    //
    // If that *also* fails then there is no way to place the subTagList on a single
    // line in its current context:  Force every element of it to nest instead
    // (in a spirit of democratic equality)
    //
    let assemble = prepend
    for (const node of subList) {
        const prettyPrint = node.prettyPrintWithOptions(depth, { wordWrap: false, noTrim: false, forceNest: true })
        assemble = `${assemble}${prettyPrint}`
    }
    const outputLines = assemble.split(/\n/)
    const { last, previous } = lastItem(outputLines)
    return {
        //
        // Need to remove the nested indents applied by the pretty print functionality, in order
        // to pass back to the wrapping procedure (which will re-apply them)
        //
        lines: [
            previous[0],
            ...previous.slice(1).map((line) => (line.slice((depth * 4))))
        ],
        prepend: last
    }
}


export const prettyPrint = {
    _iter(...nodes) {
        const { depth, options } = this.args
        return nodes.map((node) => (node.prettyPrintWithOptions(depth, options)))
    },
    _terminal() {
        return this.sourceString
    },
    TagSelfClosing(open, tag, props, close, spacer) {
        const { depth, options } = this.args
        const tagNesting = this.prettyPrintShouldNest(depth)
        if (tagNesting === 'Nest') {
            return `${open.sourceString}${tag.sourceString}\n${makeIndent(depth + 1)}${props.prettyPrintWithOptions(depth+1, options).join(`\n${makeIndent(depth + 1)}`)}\n${makeIndent(depth)}${close.sourceString}`
        }
        return `${replaceLineBreaks(this.sourceString)}`
    },
    tagArgumentQuoted(key, eq, value) {
        return this.sourceString
    },
    tagBooleanArgument(item, space) {
        return this.sourceString
    },
    TagArgumentKey(key, eq, value, close) {
        return this.sourceString
    },
    string(item) {
        const { noTrim } = this.args.options
        if (noTrim) {
            return replaceLineBreaks(this.sourceString)
        }
        return `${replaceLineBreaks(this.sourceString).trim()}`
    },
    TextContents(item) {
        const { noTrim } = this.args.options
        if (noTrim) {
            return replaceLineBreaks(this.sourceString)
        }
        return `${replaceLineBreaks(this.sourceString).trim()}`
    },
    TagExpression(open, contents, close, spacer) {
        const { depth, options } = this.args
        const tagListWrap = function * (itemList) {
            //
            // In the case of word-wrap:
            //   - String-tags will be word-wrapped at whitespace borders
            //   - Other tags will wrap as a whole to new lines if there
            //     is space between them
            //   - When tags directly abut, the whole string that connects
            //     without spaces (including last word of a string at the
            //     start, and first word of a string at the end) will be
            //     judged as a single entity:
            //       * If it all fits on the line non-nested, it is printed
            //         all non-nested
            //       * Otherwise every tag in the string is nested
            //
            let prepend = ''
            let runningTagSubList = []
            for (const item of itemList) {
                const tag = item.schema().tag
                const prettyItem = item.prettyPrintWithOptions(depth + 1, { ...options, wordWrap: false, noTrim: true })
                const { last: lastSubTag } = lastItem(runningTagSubList)
                const spaceBefore = Boolean(lastSubTag
                    ? (lastSubTag.prettyPrintWithOptions(depth + 1, { ...options, noTrim: true }).match(/\s$/))
                    : (prepend || '').match(/\s$/)
                )
                const spaceAfter = Boolean(prettyItem.match(/\s$/))
                //
                // First, check whether a running sublist of tags is being considered.  If so, evaluate
                // whether this next tag continues the running sublist, or forces its evaluation.
                //
                if (runningTagSubList.length) {
                    const { last: lastNode, previous: previousNodes } = lastItem(runningTagSubList)
                    const schema = lastNode.schema()
                    const stringWithSpace = (schema.tag === 'String') && (schema.value.search(/\s/) !== -1)
                    if (spaceBefore || stringWithSpace) {
                        //
                        // Figure out how to process the running tag sub list before proceeding
                        // to process the tag
                        //
                        const { lines: linesToYield, prepend: newPrepend } = tagSubListWrap({ prepend, subList: runningTagSubList, depth: depth + 1 })
                        yield * linesToYield
                        prepend = newPrepend
                        runningTagSubList = []
                    }
                    else {
                        runningTagSubList = [...runningTagSubList, item]
                        continue
                    }
                }
                if (tag === 'String') {
                    const wrapped = [...wordWrap({ value: prettyItem.trim(), prepend, depth: depth + 1 })]
                    const { previous: items, last: currentItem } = lastItem(wrapped)
                    if (items.length > 0) {
                        yield * items
                    }
                    prepend = `${currentItem.trim()}${ spaceAfter ? ' ' : ''}`
                }
                else {
                    if (spaceBefore) {
                        const nestedLines = prettyItem.split(/\n\s*/)
                        const { previous: deliverableLines, last: currentLine } = lastItem(nestedLines)
                        yield prepend.trim()
                        yield * deliverableLines
                        prepend = `${currentLine.trim()}${(currentLine.trim() && spaceAfter) ? ' ' : ''}`
                    }
                    else {
                        runningTagSubList = [...runningTagSubList, item]
                        continue
                    }
                }
            }
            if (runningTagSubList.length) {
                const { lines: linesToYield, prepend: newPrepend } = tagSubListWrap({ prepend, subList: runningTagSubList, depth })
                yield * linesToYield
                prepend = newPrepend
            }
            if (prepend.trim()) {
                yield prepend.trim()
            }
        }
        const { noTrim, forceNest } = options || {}
        if (forceNest || (this.prettyPrintShouldNest(depth) === 'Nest')) {
            let wrappedContents = []
            if (options.wordWrap) {
                wrappedContents = [...tagListWrap(contents.children)]
            }
            else {
                wrappedContents = contents.prettyPrintWithOptions(depth + 1, { ...options, wordWrap: false, noTrim: false, forceNest: false })
            }
            return `${replaceLineBreaks(open.sourceString)}\n${makeIndent(depth + 1)}${wrappedContents.join(`\n${makeIndent(depth + 1)}`)}\n${makeIndent(depth)}${close.sourceString}${ noTrim ? spacer.sourceString : ''}`
        }
        else {
            return `${replaceLineBreaks(open.sourceString)}${contents.prettyPrintWithOptions(0, { ...options, wordWrap: false, noTrim: false, forceNest: false }).join('')}${close.sourceString}${ noTrim ? spacer.sourceString : ''}`
        }
    },
    DescriptionExpression(node) {
        const { depth, options } = this.args
        return node.prettyPrintWithOptions(depth, { ...options, wordWrap: true })
    },
    tagArgumentBracketed(key, eq, value, close) {
        const depth = this.args.depth
        if (this.prettyPrintShouldNest(depth) === 'Nest') {
            const indents = value
                .sourceString.split('\n')
                .filter((line) => (line.trimLeft()))
                .map((line) => {
                    return line.length - line.trimLeft().length
                })
            const searchIndent = indents
                .reduce((previous, indent) => (Math.min(previous, indent)), Infinity)
            const minimumIndent = searchIndent === Infinity ? 0 : searchIndent
            const newIndent = makeIndent(depth + 1)
            const newValue = value.sourceString
                .split('\n')
                .map((line) => (line.slice(minimumIndent)))
                .join(`\n${newIndent}`)
            return `${key.sourceString}${eq.sourceString}${newValue.trimRight()}\n${makeIndent(depth)}${close.sourceString}`
        }
        else {
            return this.sourceString
        }
    }
}