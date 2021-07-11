//
// I don't love having a central mutable repository (even if each state is treated as an immutable change),
// but it simplifies the passing and accumulating of feedback *so much* that it's a worthwhile tradeoff
// for code-simplicity and legibility.
//

let queueStorage = []

const queueClear = () => {
    queueStorage = []
}

const queueAdd = (item) => {
    queueStorage = [...queueStorage, item]
}

const queueState = () => {
    return queueStorage
}

const queueFlush = () => {
    queueStorage = []
}

exports.queueClear = queueClear
exports.queueAdd = queueAdd
exports.queueState = queueState
exports.queueFlush = queueFlush
