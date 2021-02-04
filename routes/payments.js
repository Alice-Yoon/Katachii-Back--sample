const express = require('express');
const router = express.Router();
const { Payment } = require('../models/Payment');
const { User } = require('../models/User');
const { Product } = require('../models/Product');
const { auth } = require('../middleware/auth');


/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

                // PayToBank - 무통장입금

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

const generateTransactionData = (userInfo, bodyInfo) => {
	let transactionData = {};

	transactionData.user = {
		id: userInfo._id,
		name: userInfo.name,
		email: userInfo.email,
		contact: userInfo.contact
	};
	transactionData.data = {
		method_name: "무통장입금"
	};
	transactionData.paymentStatus = "입금대기/입금확인중"
	transactionData.products = bodyInfo.items;
	transactionData.totalPrice = bodyInfo.totalPrice;
	transactionData.dateOfPurchase = Date.now();
	transactionData.productOrderId = bodyInfo.productOrderId;
	transactionData.deliveryInfo = bodyInfo.deliveryInfo;
	transactionData.depositor = bodyInfo.depositor;
	transactionData.isDeliveryFar = bodyInfo.isDeliveryFar;
	transactionData.necklaceType = bodyInfo.necklaceType;

	return transactionData;
}

const generateHistoryData = (savedNewPayment) => {
	const historyProducts = savedNewPayment.products.map(item => {
		return {
			dateOfPurchase: savedNewPayment.dateOfPurchase,
			name: item.item_name,
			id: item.unique,
			price: item.price,
			quantity: item.qty,
			order_id: (savedNewPayment._id).toString()
		}
	})

	const history = {
		orderId: (savedNewPayment._id).toString(),
		products: historyProducts,
		totalPrice: savedNewPayment.totalPrice,
		paymentStatus: savedNewPayment.paymentStatus,
		dateOfPurchase: savedNewPayment.dateOfPurchase,
		paymentMethod: savedNewPayment.data[0].method_name,
		deliveryInfo: savedNewPayment.deliveryInfo,
		necklaceType: savedNewPayment.necklaceType,
		isDeliveryFar: savedNewPayment.isDeliveryFar,
		depositor: savedNewPayment.depositor
	}

	const itemsToRemoveFromCart = savedNewPayment.products.map(item => {
		return item.unique
	})

	return {
		history,
		itemsToRemoveFromCart
	}
}

// @desc        무통장입금 주문정보 저장
// @route       POST /api/payments/paymentToBank
// @access      Private
router.post('/paymentToBank', auth, async (req, res) => {
	try {
		const transactionData = generateTransactionData(req.user, req.body);

		// 주문요청한 상품이 sold-out인지 더블체크
		const productIds = transactionData.products.map(product => product.unique);
		const productsToCheckSoldStatus = await Product.find({'_id': { $in : productIds }});
		const productsSold = productsToCheckSoldStatus
			.filter(product => product.sold === true)
			.map(product => product.title);
		
		if (productsSold.length > 0) return res.json({ success: false, msg: `${productsSold.join(' 와 ')} 은 이미 판매완료 되었습니다.`});

		// sold-out이 아니라면, 주문정보 저장 continue!
		const payment = new Payment(transactionData);
		const savedNewPayment = await payment.save();

		if (!savedNewPayment) return res.status(400).json({ success:  false, msg: '새주문을 저장하는데 실패했습니다.'});

		const historyData = generateHistoryData(savedNewPayment);
		const { history, itemsToRemoveFromCart } = historyData;

		// throw Error('Error!')

		const updatedUserInfo = await User.findOneAndUpdate(
			{_id: req.user._id},
			{
				$push: {
					history: history,
				},
				$pull: {
					cart: {id: {$in: itemsToRemoveFromCart}}
				}
			},
			{ new: true });

		if (!updatedUserInfo) return res.status(400).json({ success:  false, msg: '새주문을 user에 업데이트하는데 실패했습니다.'});
		
		const updatedProductInfo = await Product.update(
			{ _id: { $in: itemsToRemoveFromCart }},
			{ $set: {
				sold: true
			}},
			{ multi: true });
		
		if (!updatedProductInfo) return res.status(400).json({ success:  false, msg: '새주문을 user에 업데이트하는데 실패했습니다.'});

		res.status(200).json({ success: true, savedNewPayment, updatedUserInfo, updatedProductInfo });		
	} catch (err) {
		res.status(400).json({ success:  false, err });
	}
})


/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

                // ManageOrders - 주문상품 관리

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

// @desc        (admin) 전체 주문리스트 가져오기
// @route       GET /api/payments/manageOrders
// @access      Private -admin
router.get('/manageOrders', auth, async (req, res) => {
	try {
		const pageSize = 2
		const page = Number(req.query.pageNumber);
		const orders = await Payment.find().sort('-createdAt').limit(pageSize).skip(pageSize * (page -1))
		if (!orders) return res.status(400).json({ success:  false, msg: '주문상품을 찾지 못했습니다.'});

		const count = await Payment.find().countDocuments();
		const totalPages = Math.ceil(count / pageSize);

		res.status(200).json({ success: true, ordersInfo: orders, totalPages })
	} catch (err) {
		res.status(400).json({ success:  false, err })
	}
})

// @desc        (admin) 입금상태 '입금완료'로 업데이트
// @route       POST /api/payments/updateOrderStatus
// @access      Private -admin
router.post('/updateOrderStatus', auth, async (req, res) => {
	try {
		const { orderId, userId } = req.body;

		const updatedPaymentInfo = await Payment.findOneAndUpdate({ _id: orderId},
			{ 
				$set: {
					paymentStatus: '입금완료'
				}
			},
			{ new: true });

		if (!updatedPaymentInfo) return res.status(400).json({ success:  false, msg: 'payment에 업데이트를 실패했습니다.' });

		const updatedUserInfo = await User.findOneAndUpdate(
			{	_id: userId,
				"history.orderId": orderId
			},
			{
				$set: {
					"history.$.paymentStatus": '입금완료'
				}
			},
			{ new: true });

		if (!updatedUserInfo) return res.status(400).json({ success:  false, msg: 'user에 업데이트를 실패했습니다.' });

		res.status(200).json({ success: true, updatedPaymentInfo, updatedUserInfo});
	} catch (err) {
		res.status(400).json({ success:  false, err });
	}
})

// @desc        (admin) 배송상태 '배송완료'로 업데이트 & 송장번호 업데이트
// @route       POST /api/payments/updateDeliveryNumber
// @access      Private -admin
router.post('/updateDeliveryNumber', auth, async (req, res) => {

	try {
		const { orderId, userId, deliveryNumber } = req.body;

		const updatedPaymentInfo = await Payment.findOneAndUpdate(
			{ _id: orderId },
			{ $set: {
				deliveryNumber: deliveryNumber
			}},
			{ new: true });

		if (!updatedPaymentInfo) return res.status(400).json({ success:  false, msg: 'payment에 업데이트를 실패했습니다.' });

		const updatedUserInfo = await User.findOneAndUpdate(
			{	_id: userId,
				"history.orderId": orderId
			},
			{
				$set: {
					"history.$.deliveryNumber": deliveryNumber
				}
			},
			{ new: true });

		if (!updatedUserInfo) return res.status(400).json({ success:  false, msg: 'user에 업데이트를 실패했습니다.' });

		res.status(200).json({ success: true, updatedPaymentInfo, updatedUserInfo });
	} catch (err) {
		res.status(400).json({ success:  false, err });
	}
})

// @desc        (admin) 미입금 시, '결제취소'로 주문상태 변경 
						// -payment에서 정보 삭제 & user>history의 결제상태 '주문취소' & 해당 product "sold: false"
// @route       POST /api/payments/cancelThisOrder
// @access      Private -admin
router.post('/cancelThisOrder', auth, async (req, res) => {
	try {
		const {orderId, userId, productsIds} = req.body;

		const updatedPaymentInfo = await Payment.findOneAndUpdate(
			{_id: orderId}, 
			{
				$set: {
					paymentStatus: '주문취소(미입금)'
				}
			},
			{ new: true });

		if (!updatedPaymentInfo) return res.status(400).json({ success:  false, msg: 'payment에 업데이트를 실패했습니다.' });

		const updatedUserInfo = await User.findOneAndUpdate(
			{	_id: userId,
				"history.orderId": orderId
			},
			{
				$set: {
					"history.$.paymentStatus": '주문취소(미입금)'
				}
			},
			{ new: true });

		if (!updatedUserInfo) return res.status(400).json({ success:  false, msg: 'user에 업데이트를 실패했습니다.' });

		const updatedProductInfo = await Product.update(
			{ _id: { $in: productsIds }},
			{ $set: {
				sold: false
			}},
			{ multi: true });
		
		if (!updatedProductInfo) return res.status(400).json({ success:  false, msg: 'product에 업데이트를 실패했습니다.' });

		res.status(200).json({success: true, updatedPaymentInfo, updatedUserInfo, updatedProductInfo });
	} catch (err) {
		res.status(400).json({ success:  false, err });
	}
});

// @desc        (admin) 주문기록 지우기
// @route       DELETE /api/payments/removeOrderRecord
// @access      Private -admin
router.delete('/removeOrderRecord', auth, async (req, res) => {
	try {
		const orderToRemove = req.query.orderId;

		const removedOrder = await Payment.deleteOne({ _id: orderToRemove });
		if (!removedOrder) return res.status(400).json({ success: false, msg: '지울 주문이 없거나 찾지 못했음.' });

		res.status(200).json({ success: true });
	} catch (error) {
		res.status(400).json({ success:  false, err });
	}
});

module.exports = router;