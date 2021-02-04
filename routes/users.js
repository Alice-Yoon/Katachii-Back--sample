const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { Product } = require('../models/Product');

const { auth } = require('../middleware/auth');


/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

                // ACCOUNT

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

// @desc        회원가입
// @route       POST /api/users/register
// @access      Public
router.post('/register', async (req, res) => {
    try {
        const userExist = await User.findOne({ email: req.body.email})
        if (userExist) return res.json({ success: false, message: '해당 이메일을 가진 유저가 이미 존재합니다!' })

        const user = new User(req.body);
        const savedNewUser = await user.save();

        res.status(201).json({ success: true, savedNewUser });
    } catch (err) {
        res.status(400).json({ success: false, err })
    }
})

// @desc        로그인
// @route       POST /api/users/login
// @access      Public
router.post('/login', (req, res) => {
    User.findOne({ email: req.body.email }, (err, user) => {
        if(!user) {
            return res.json({
                loginSuccess: false,
                message: "제공된 이메일에 해당하는 유저가 없습니다."
            })
        }

        // 요청된 이메일이 데이터베이스에 있다면, 비밀번호가 맞는지 확인.
        user.comparePassword(req.body.password, (err, isMatch) => {
            if(!isMatch) 
            return res.json({loginSuccess: false, message: '비밀번호가 틀렸습니다.'});

            // 비밀번호까지 맞다면, 토큰 생성.
            user.generateToken((err, user) => {
                if(err) return res.status(400).send(err);

                // 토큰을 저장한다. 어디에? 쿠키!
                res.status(200).json({ loginSuccess: true, userId: user._id, token: user.token });
            })
        })
    })
})

// @desc        유저 인증 (role 0 -> 일반유저 | role이 0이 아니면 -> 관리자)
// @route       GET /api/users/auth
// @access      Private
router.get('/auth', auth, (req, res) => {

    // 여기까지 미들웨어를 통과해 왔다는 얘기는, Authentication이 True 라는 말!
    res.status(200).json({
        _id: req.user._id,
        isAdmin: req.user.role === 0 ? false : true,
        isAuth: true,
        email: req.user.email,
        name: req.user.name,
        lastname: req.user.lastname,
        role: req.user.role,
        image: req.user.image
    })
})

// @desc        로그아웃
// @route       GET /api/users/logout
// @access      Private
router.get('/logout', auth, async (req, res) => {
    try {
        const user = await User.findOneAndUpdate({ _id: req.user._id }, { token: '' });
        if (!user) return res.status(400).json({ success: false, err });
        
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, err });
    }
})

// @desc        회원탈퇴
// @route       DELETE /api/users/deleteAccount
// @access      Private
router.delete('/deleteAccount', auth, async (req, res) => {
    try {
        const deletedUser = await User.deleteOne({ _id: req.user._id });
        if (!deletedUser) return res.status(400).json({ success: false, err });

        res.status(200).json({ sucess: true });
    } catch (err) {
        res.status(400).json({ success: false, err });
    }
})

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

                // CART 

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

// @desc        cart 상품리스트 가져오기
// @route       GET /api/users/getCartItems
// @access      Private
router.get('/getCartItems', auth, async (req, res) => {
    try {
        const userInfo = await User.find({_id: req.user._id});
        if (!userInfo) return res.status(400).json({ success: false, err: '해당 유저는 존재하지 않음' });

        const cartIds = userInfo[0].cart.map(item => item.id);

        const cartProducts = await Product.find({ '_id': { $in : cartIds }});
        if (!cartProducts) return res.status(400).json({ success: false, err: '카트 상품들이 존재하지 않음' });

        // user > cart에 있는 상품정보 중, product에서 삭제되어 존재하지 않는 상품이라면?
        const cartProductIds = cartProducts.map(item => String(item._id))
        const itemsToRemoveFromCart = cartIds.filter(item => !cartProductIds.includes(item))

        if (itemsToRemoveFromCart.length > 0) {
            await User.findOneAndUpdate( 
                {_id: req.user._id},
                {
                    $pull: {
                        cart: {id: {$in: itemsToRemoveFromCart}}
                    }
                },
                { new: true });
        }

        res.status(200).json({ success: true, cartItems: cartProducts.length > 0 ? cartProducts : []});    
    } catch (err) {
        res.status(400).json({ success: false, err });
    }
})

// @desc        cart에 관심상품 추가
// @route       POST /api/users/addToCart
// @access      Private
router.post('/addToCart', auth, (req, res) => {

    User.find({_id: req.user._id}, (err, userInfo) => {

        if (userInfo[0].cart.length >= 5) return res.json({ success: false, message: "카트에는 한번에 최대 5개의 상품까지 담을 수 있습니다."})

        let alreadyInCart = false;

        userInfo[0].cart && userInfo[0].cart.forEach((cartInfo) => {
            // 카트에 이미 해당 상품이 있다면
            if (cartInfo.id === req.body.productId) {
                alreadyInCart = true;
            }
        })

        if (alreadyInCart) {
            return res.json({ success: false, message: "이미 카트에 추가한 상품입니다."})
        } else {
            User.findOneAndUpdate(
                {_id: req.user._id},
                {
                    $push: {
                        cart: {
                            id: req.body.productId,
                            quantity: 1,
                            date: Date.now()
                        }
                    }
                },
                { new: true },
                (err, userInfo) => {
                    if (err) return res.json({ success: false, err })
                    res.status(200).json( {success: true, cart: userInfo.cart})
                }
            )
        }
    })
})

// @desc        cart에서 상품 삭제
// @route       DELETE /api/users/deleteCartItem
// @access      Private
router.delete('/deleteCartItem', auth, async (req, res) => {
    try {
        const updatedUserInfo = await User.findOneAndUpdate({ _id: req.user._id },
            { 
                $pull: { 
                    cart : { id : req.query.productId} 
                } 
            }, { new: true });

        if (!updatedUserInfo) return res.status(400).json({ success: false, err });

        res.status(200).json({ success: true, userInfo: updatedUserInfo });
    } catch (err) {
        res.status(400).json({ success: false, err });
    }
})


/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

                // Payment - 주문자 정보

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

// @desc        주문&결제하는 유저 정보 가져오기
// @route       GET /api/users/getUsersInfo
// @access      Private
router.get('/getUsersInfo', auth, async (req, res) => {
    try {
        const userInfo = await User.findOne({_id: req.user._id});
        if (!userInfo) return res.status(400).json({ success: false, msg: '유저정보가 없음.' });

        res.status(200).json({ success: true, userInfo })
    } catch (err) {
        res.status(400).json({ success: false, err });
    }
})

// @desc        Get product items by it (used to display items to purchase when payment)
// @route       POST /api/users/getItemsById
// @access      Private
router.post('/getItemsById', auth, async (req, res) => {
    try {
        const products = await Product.find({ '_id': { $in: req.body }});
        res.status(200).json(products)
    } catch (error) {
        res.status(400).json({ success: false, err });
    }
})


/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

                // MyPage - 주문상품 목록

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

// @desc        MyPage 주문한 상품 리스트 가져오기
// @route       GET /api/users/getHistoryItems
// @access      Private
router.get('/getHistoryItems', auth, async (req, res) => {
    try {
        const userInfo = await User.find({_id: req.user._id});
        if (!userInfo) return res.status(400).json({ success: false, msg: '유저정보가 없음' });
        
        const historyInfo = userInfo[0].history;
        res.status(200).json({ success: true, historyInfo });
    } catch (err) {
        res.status(400).json({ success: false, err });
    }
})

module.exports = router;