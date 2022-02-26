import { v4 as uuidv4 } from "uuid"
import { splitType } from '/opt/utilities/types.js'

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


export class ScopeMap extends Object {
    constructor(incomingMap) {
        super()
        this.scopeMap = incomingMap || {}
    }

    serialize() {
        return this.scopeMap
    }

    translateNormalForm(normalForm) {

        //
        // Add any incoming entries that have not yet been mapped
        //
        Object.values(normalForm)
            .filter(({ tag }) => (['Room'].includes(tag)))
            .filter(({ key }) => (!(key in this.scopeMap)))
            .forEach(({ tag, key, isGlobal }) => {
                let prefix = ''
                switch(tag) {
                    default:
                        prefix = 'ROOM'
                }
                const newEphemeraId = isGlobal
                    ? `${prefix}#${key}`
                    : `${prefix}#${uuidv4()}`
                this.scopeMap[key] = newEphemeraId
            })

        return Object.values(normalForm)
            .filter(({ tag }) => (['Room', 'Exit'].includes(tag)))
            .reduce((previous, { tag, key, to }) => {
                if (tag === 'Room') {
                    return {
                        ...previous,
                        [key]: {
                            ...(previous[key] || {}),
                            EphemeraId: this.scopeMap[key]
                        }
                    }
                }
                if (tag === 'Exit') {
                    return {
                        ...previous,
                        [key]: {
                            ...(previous[key] || {}),
                            toEphemeraId: splitType(this.scopeMap[to])[1]
                        }
                    }
                }
                return previous
            },
            normalForm)
    }
}

export default ScopeMap
