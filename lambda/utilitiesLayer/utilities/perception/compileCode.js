import { produce } from 'immer'

const sandboxedExecution = (src) => (sandboxTransform) => {
    src = 'with (sandbox) {' + src + '}'
    const code = new Function('sandbox', src)
    return (sandbox) => {
        const sandboxProxy = sandboxTransform(sandbox)
        return code(sandboxProxy)
    }
}

export const evaluateCode = (src) => {
    const transform = (sandbox) => (new Proxy(sandbox, {
        has: () => true,
        get: (target, key) => (key === Symbol.unscopables ? undefined: target[key])
    }))
    return sandboxedExecution(src)(transform)
}

export const executeCode = (src) => (sandbox) => {
    let returnValue = null
    const updatedSandbox = produce(sandbox, (draftSandbox) => {
        const transform = (sandbox) => (new Proxy(sandbox, {
            has: () => true,
            get: (target, key) => (key === Symbol.unscopables ? undefined: target[key]),
            set: (target, key, value) => {
                if (key === Symbol.unscopables) {
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
