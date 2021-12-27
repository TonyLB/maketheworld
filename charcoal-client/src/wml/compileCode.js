const compileCode = (src) => {
    src = 'with (sandbox) {' + src + '}'
    // eslint-disable-next-line no-new-func
    const code = new Function('sandbox', src)
  
    return function (sandbox) {
        const sandboxProxy = new Proxy(sandbox, {
            has: () => true,
            get: (target, key) => (key === Symbol.unscopables ? undefined: target[key])
        })
        return code(sandboxProxy)
    }
}

exports.compileCode = compileCode
