import baseMessage from './base.js'

export class playerMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { name = '', message = '' } = props
        this.name = name
        this.message = message
    }
}

export default playerMessage