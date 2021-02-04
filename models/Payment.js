const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const paymentSchema = mongoose.Schema({
    user: {
        type: Array,
        default: []
    },
    data: {
        type: Array,
        default: []
    },
    products: {
        type: Array,
        default: []
    },
    totalPrice: {
        type: Number,
        default: 0
    },
    dateOfPurchase: {
        type: Number,
        default: 0
    },
    deliveryNumber: {
        type: String,
        default: ''
    },
    productOrderId: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        default: ''
    },
    deliveryInfo: {
        type: Array,
        default: []
    },
    depositor: {
        type: String,
        default: ''
    },
    isDeliveryFar: {
        type: Boolean,
        default: false
    },
    necklaceType: {
        type: Number,
        default: 0
    }
}, {timestamps: true})




// creating the model
const Payment = mongoose.model('Payment', paymentSchema)

module.exports = { Payment }