export const delayPromise = (delay) => {
    return new Promise((resolve) => {
        setTimeout(() => { resolve() }, delay)
    })
}

export default delayPromise
