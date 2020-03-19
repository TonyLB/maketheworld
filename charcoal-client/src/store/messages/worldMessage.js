import baseMessage from './base.js'

export class worldMessage extends baseMessage {
    constructor(props = {}) {
        super(props)
        const { message = '' } = props
        this.message = message
    }
}

export default worldMessage