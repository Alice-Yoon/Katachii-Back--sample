const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const tokenSign = require('../utils/tokenSign');
const expiresIn = require('../utils/expiresIn');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        maxlength: 50
    },
    contact: {
        type: Number
    },
    email: {
        type: String,
        trim: true,
        unique: 1
    },
    password: {
        type: String,
        minlength: 5
    },
    lastname: {
        type: String,
        maxlength: 50
    },
    role: {
        type: Number,
        default: 0
    },
    cart: {
        type: Array,
        default: []
    },
    history: {
        type: Array,
        default: []
    },
    image: {
        type: String
    },
    token: {
        type: String
    },
    tokenExp: {
        type: Number
    }
})

// normal user's role number will be '0'

// 비밀번호 암호화
userSchema.pre('save', function(next) {
    var user = this;

    if (user.isModified('password')) {
        bcrypt.genSalt(saltRounds, (err, salt) => {
            if(err) return next(err);
    
            bcrypt.hash(user.password, salt, (err, hash) => {
                if(err) return next(err);
                user.password = hash;
                next();
            })
        })
    } else {
        next();
    }
})

// Method - comparePassword
userSchema.methods.comparePassword = function(plainPassword, cb) {
    bcrypt.compare(plainPassword, this.password, function(err, isMatch) {
        if(err) return cb(err)
        return cb(null, isMatch)
    })
}

// Method - generateToken
userSchema.methods.generateToken = function(cb) {

    var user = this;

    // jsonwebtoken을 이용해서 토큰 생성
    // var token = jwt.sign(user._id.toHexString(), tokenSign);
    var token = jwt.sign({_id: user._id.toHexString()}, tokenSign, {expiresIn: expiresIn});
    
    user.token = token;
    user.save(function(err, user) {
        if(err) return cb(err)
        return cb(null, user)
    })
}

// findByToken
userSchema.statics.findByToken = function(token, cb) {

    var user = this;

    // 토큰을 decode 한다.
    jwt.verify(token, tokenSign, function(err, decoded) {
        // decoded : user_id
        // 1. 유저 아이디를 이용해서 유저를 찾은 다음,
        // 2. 클라이언트에서 가져온 token과 DB에 보관된 토큰이 일치하는지 확인

        user.findOne({ "_id": decoded, "token": token }, function(err, user) {
            if(err) return cb(err)
            return cb(null, user)
        })
    })
}


// creating the model
const User = mongoose.model('User', userSchema)

module.exports = { User }