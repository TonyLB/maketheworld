export class baseMessage extends Object {

    constructor(props = {}) {
        super(props)
        const { CreatedTime } = props
        this.CreatedTime = CreatedTime
    }


    update (values) {
        this.CreatedTime = values.CreatedTime
        return this
    }
}

export default baseMessage