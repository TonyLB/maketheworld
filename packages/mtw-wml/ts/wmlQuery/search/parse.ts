import { ParseException } from '../../parser/baseClasses'
import { SearchParse, SearchToken, SearchParseEvaluation, SearchParseComma, SearchParseExplicitGroupOpen } from './baseClasses'

function findLastIndex<T>(array: Array<T>, predicate: (value: T, index: number, obj: T[]) => boolean): number {
    let l = array.length;
    while (l--) {
        if (predicate(array[l], l, array))
            return l;
    }
    return -1;
}

const reduceStack = (stack: (SearchParse | SearchParseComma)[], index: number): SearchParse[] => {
    if (stack.find(({ type }) => (type === 'Comma'))) {
        let buffer: SearchParse[] = []
        let returnValues: SearchParse[] = []
        stack.forEach((item) => {
            if (isSearchComma(item)) {
                if (buffer.length) {
                    if (buffer.length === 1) {
                        returnValues.push(buffer[0])
                    }
                    else {
                        returnValues.push({
                            type: 'Serial',
                            items: buffer
                        })
                    }
                }
                buffer = []
            }
            else {
                buffer.push(item)
            }
        })
        const lastItems: SearchParse[] = buffer.length
            ? buffer.length === 1 ? buffer : [{
                    type: 'Serial',
                    items: buffer
                }]
            : []
        return [{
            type: 'Parallel',
            items: [
                ...returnValues,
                ...lastItems
            ]
        }]
    }
    else {
        return stack.filter(isSearchParse)
    }
}

const isSearchParse = (value: SearchParseEvaluation): value is SearchParse => (['Tag', 'Property', 'First', 'NthChild', 'Serial', 'Parallel'].includes(value.type))
const isSearchComma = (value: SearchParseEvaluation): value is SearchParseComma => (value.type === 'Comma')
const isSearchParseOrComma = (value: SearchParseEvaluation): value is (SearchParse | SearchParseComma) => (value.type === 'Comma' || isSearchParse(value))
const isSearchParseExplicitOpen = (value: SearchParseEvaluation): value is SearchParseExplicitGroupOpen => (value.type === 'ExplicitOpen')

export const searchParse = (tokens: SearchToken[]): SearchParse[] => {
    let stack: SearchParseEvaluation[] = []
    tokens.forEach((token, index) => {
        switch(token.type) {
            case 'Tag':
                stack.push({
                    type: 'Tag',
                    tag: token.tag
                })
                break
            case 'Property':
                stack.push({
                    type: 'Property',
                    key: token.key,
                    value: token.value
                })
                break
            case 'First':
                stack.push({
                    type: 'First'
                })
                break
            case 'NthChild':
                stack.push({
                    type: 'NthChild',
                    n: token.n
                })
                break
            case 'GroupOpen':
                stack.push({
                    type: 'ExplicitOpen',
                    token: index
                })
                break
            case 'Comma':
                stack.push({
                    type: 'Comma'
                })
                break
            case 'GroupClose':
                const groupOpenIndex = findLastIndex(stack, ({ type }) => (type === 'ExplicitOpen'))
                if (groupOpenIndex === -1) {
                    throw new ParseException('Unexpected group closure', index, index)
                }
                else {
                    const groupItems = stack.slice(groupOpenIndex + 1) || []
                    stack = [
                        ...(groupOpenIndex > 0 ? stack.slice(0, groupOpenIndex) : []),
                        ...reduceStack(groupItems.filter(isSearchParseOrComma), index)
                    ]
                }
                break
            default:
                throw new ParseException(`Unexpected token: "${token.type}"`, index, index)
        }
    })
    const groupOpen = stack.find(isSearchParseExplicitOpen)
    if (groupOpen) {
        throw new ParseException('Unmatched group open', groupOpen.token, groupOpen.token)
    }
    return reduceStack(stack.filter(isSearchParseOrComma), stack.length) || []
}

export default searchParse
