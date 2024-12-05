// backend/db.js
const mongoose = require('mongoose');


mongoose.connect("mongodb+srv://prasadkkadam01:7LspsUmQVWVa0XBI@cluster0.hvvw2i6.mongodb.net/PayTm");

//mongoose.connect("mongodb+srv://kirags123:8qPEa8KTKBEh2bss@cluster0.f3qlbuo.mongodb.net/PayTm-PKK")

// Create a Schema for Users
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minLength: 3,
        maxLength: 30
    },
    password: {
        type: String,
        required: true,
        minLength: 6
    },
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    }
});

const accountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // Reference to User model
        ref: 'User',
        required: true
    },
    balance: {
        type: Number,
        required: true
    }
});

const Account = mongoose.model('Account', accountSchema);
const User = mongoose.model('User', userSchema);

module.exports = {
	User,
    Account
};

//mongoose.connect('mongodb://localhost:27017,localhost:27018,localhost:27019/test?' +'replicaSet=rs');
//mongoose.connect("mongodb://localhost:27017/PayTm");
//mongoose.connect("mongodb+srv://prasadkkadam01:7LspsUmQVWVa0XBI@cluster0.hvvw2i6.mongodb.net/PayTm");
