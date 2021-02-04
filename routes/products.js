const express = require('express');
const fs = require('fs');
const router = express.Router();
const multer = require('multer');
const { auth } = require('../middleware/auth');
const { Product } = require('../models/Product');

const path = require('path');

// @desc        전체 상품리스트 가져오기
// @route       GET /api/products/getProducts
// @access      Public
router.get('/getProducts', async (req, res) => {
    try {
        const products = await Product.find().exec();
        if(!products) return res.status(400).json({ success:  false, msg: '상품목록을 찾지 못했습니다.'});

        res.status(200).json({ success: true, products });
    } catch (err) {
        res.status(400).json({ success: false, err })
    }
})

// @desc        카테고리별 상품리스트 가져오기
// @route       GET /api/products/getCategorizedProducts
// @access      Public
router.get('/getCategorizedProducts', async (req, res) => {
    try {
        const category = req.query.category;
        const products = await Product.find({ categories: category });
        res.status(200).json({ success: true, products })
    } catch (err) {
        res.status(400).json({ success: false, err })
    }
})

// @desc        개별 상품정보 가져오기
// @route       GET /api/products/product_by_id?id={productId}
// @access      Public
router.get('/product_by_id', async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findOne({ _id: productId });

        if (!product) return res.status(400).json({ success: false, err: "해당 상품이 없습니다." });

        res.status(200).json({ success: true, product });
    } catch (err) {
        res.status(400).json({ success: false, err });
    }
})

/////////////////////////////////////
/////////////////////////////////////

        // Admin - 새상품 등록

/////////////////////////////////////
/////////////////////////////////////

// multer 라이브러리
var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`)
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        if(ext !== '.jpg' || ext !== '.png' || ext !== '.jpeg') {
            return cb(res.status(400).end('jpg, png 파일만 업로드 가능합니다'), false);
        }
        cb(null, true)
    }
})
var upload = multer({ storage: storage }).single("file")

// @desc        (admin) 새상품 등록시, multer 이용하여 이미지 업로드
// @route       POST /api/products/uploadImage
// @access      Private -admin
router.post('/uploadImage', auth, (req, res) => {
    // after getting the image from client
    // we need to save it inside the Node Server

    // Multer library
    upload(req, res, err => {
        if (err) return res.json({success: false, err})
        return res.json({ success: true, image: res.req.file.path, fileName: res.req.file.filename })
    })
})

// @desc        (admin) 새상품 등록하기
// @route       POST /api/products/uploadProduct
// @access      Private -admin
router.post('/uploadProduct', auth, async (req, res) => {
    try {
        const product = new Product(req.body);
        const savedNewProduct = await product.save();
        res.status(201).json({ success: true, product: savedNewProduct })
    } catch (err) {
        res.status(400).json({ success: false, err })
    }
})

// @desc        (admin) 상품 삭제하기
// @route       DELETE /api/products/deleteProduct
// @access      Private -admin
router.delete('/deleteProduct', auth, async (req, res) => {
    try {
        const productId = req.query.productId;
        const product = await Product.findOneAndDelete({ _id: productId });
        if (!product) return res.status(400).json({ success: false, msg: "DB에서 상품을 찾지 못했거나, 삭제에 실패했습니다."})

        const productImage = product.images[0];
        fs.unlink(productImage, (err) => {
            if(err) {
                res.json({ success: false, err, msg: "상품 사진제거에 실패했습니다."})
            } else {
                res.status(200).json({ success: true, removedProduct: product })
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, err })
    }
})

module.exports = router;