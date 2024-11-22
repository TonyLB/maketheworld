import StandardComponentAbstract from "./abstract"

export const ndjsonWrap = <TBase extends new (...args: any[]) => StandardComponentAbstract>(Base: TBase, label: string) => {
    return class NDJSONWrapped extends Base {
        static fromNDJSON(...args: any[]): typeof Base {
            const payload = args[0]
            if (payload && ('key' in payload)) {
                const returnValue = ('universalKey' in payload)
                    ? (new Base(payload)).withUniversalKey(payload.universalKey)
                    : new Base(payload)
                return returnValue as unknown as typeof Base
            }
            else {
                throw new Error(`Type mismatch in ${label} fromNDJSON`)
            }
        }    
    }
}
