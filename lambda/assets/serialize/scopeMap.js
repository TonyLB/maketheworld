import { v4 as uuidv4 } from "uuid"

//
// TODO: When scoped imports are introduced, scopeMap will become a more complicated
// function, since it will need to pull in the scopeMaps for any assets from which
// items are imported, in order to prime the pump
//

export const scopeMap = (assets, currentScopeMap = {}) => {
    let scopeMap = {}
    if (assets) {
        assets
            .filter(({ tag }) => (['Room', 'Variable', 'Character', 'Action'].includes(tag)))
            .forEach(({ key, isGlobal }) => {
                if (!scopeMap[key]) {
                    if (isGlobal) {
                        scopeMap[key] = key
                    }
                    else {
                        if (currentScopeMap[key]) {
                            scopeMap[key] = currentScopeMap[key]
                        }
                        else {
                            scopeMap[key] = uuidv4()
                        }
                    }
                }
            })
    }
    return scopeMap
}
