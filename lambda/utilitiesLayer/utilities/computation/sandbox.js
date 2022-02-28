import { produce } from 'immer'

const sandboxedExecution = (src) => (sandboxTransform) => {
    src = 'with (sandbox) {' + src + '}'
    const code = new Function('sandbox', src)
    return (...args) => {
        const sandboxProxy = sandboxTransform(...args)
        return code(sandboxProxy)
    }
}

//
// TODO: Create set operators for the sandbox that throw an error when
// attempting to set global variables during a pure evaluation
//
export const evaluateCode = (src) => {
    const transform = (sandbox) => (new Proxy(sandbox, {
        has: () => true,
        get: (target, key) => (key === Symbol.unscopables ? undefined: target[key])
    }))
    return sandboxedExecution(src)(transform)
}

export const executeCode = (src) => (sandbox, primitives = {}) => {
    let returnValue = null
    const updatedSandbox = produce({ ...primitives, ...sandbox }, (draftSandbox) => {
        const transform = (globalSandbox) => (new Proxy(globalSandbox, {
            has: () => true,
            get: (target, key) => (key === Symbol.unscopables ? undefined: target[key]),
            set: (target, key, value) => {
                if (key === Symbol.unscopables || !(key in sandbox)) {
                    return null
                }
                else {
                    return Reflect.set(target, key, value)
                }
            }
        }))
        returnValue = sandboxedExecution(src)(transform)(draftSandbox)
    })
    const changedKeys = Object.keys(sandbox)
        .filter((key) => (updatedSandbox[key] !== sandbox[key]))
    return {
        oldValues: sandbox,
        newValues: updatedSandbox,
        changedKeys,
        returnValue
    }
}

export default evaluateCode
