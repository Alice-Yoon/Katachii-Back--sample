const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const config = require('./config/key');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
const path = require('path');

const { auth } = require('./middleware/auth');
const { User } = require('./models/User');

app.use(cors());

// application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: true}));
// application/json
app.use(bodyParser.json());

// use cookieParser
app.use(cookieParser());

// mongoDB 연결
mongoose.connect(config.mongoURI, {
    useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false
}).then(() => console.log("MongoDB connected...")).catch(err => console.log(err));

app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/payments', require('./routes/payments'));

// 이미지 불러오기 에러 해결
// app.use("/uploads", express.static("uploads"));
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get('/', (req, res) => res.send("Hello World! 안뇨옹"));



app.listen(port, () => console.log(`Example app listening on port ${port}`));



