import { WMLQuery } from '@tonylb/mtw-wml/dist/wmlQuery'

let wmlQueryCacheArray: Record<string, WMLQuery> = {}

export const wmlQueryFromCache = ({ key, value = '' }: { key: string, value?: string }): WMLQuery => {
    if (wmlQueryCacheArray[key]) {
        if (value) {
            wmlQueryCacheArray[key].setInput(value)
        }
        return wmlQueryCacheArray[key]
    }
    const returnValue = new WMLQuery(value || '')
    wmlQueryCacheArray[key] = returnValue
    return returnValue
}
