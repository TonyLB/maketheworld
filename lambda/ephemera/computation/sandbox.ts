import { produce } from 'immer'

export const sandboxedExecution = (src: string) => (sandboxTransform: (...args: any[]) => any) => {
    src = 'with (sandbox) {' + src + '}'
    const code = new Function('sandbox', src)
    return (...args: any[]) => {
        const sandboxProxy = sandboxTransform(...args)
        return code(sandboxProxy)
    }
}

//
// TODO: Create set operators for the sandbox that throw an error when
// attempting to set global variables during a pure evaluation
//
export const evaluateCode = (src: string): any => {
    const transform = (sandbox: Record<string | symbol, any>) => (new Proxy(sandbox, {
        has: () => true,
        get: (target, key) => (key === Symbol.unscopables ? undefined: target[key])
    }))
    return sandboxedExecution(src)(transform)
}

export const executeCode = (src: string) => (sandbox: Record<string | symbol, any>, primitives: Record<string | symbol, any> = {}) => {
    let returnValue = null
    const executeSandbox = produce({ ...primitives, ...sandbox }, (draftSandbox) => {
        const transform = (globalSandbox) => (new Proxy(globalSandbox, {
            has: () => true,
            get: (target, key) => (key === Symbol.unscopables ? undefined: target[key]),
            set: (target, key, value) => {
                if (key === Symbol.unscopables || !(key in sandbox)) {
                    return false
                }
                else {
                    return Reflect.set(target, key, value)
                }
            }
        }))
        returnValue = sandboxedExecution(src)(transform)(draftSandbox)
    })
    const updatedSandbox = Object.keys(sandbox)
        .reduce((previous, key) => ({ ...previous, [key]: executeSandbox[key] }), {})
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
