const express = require("express");
const jwt = require("jsonwebtoken");
const z = require("zod");
const router = express.Router();
const {User} = require("../db");
const JWT_SECRET = require("../config");


const signupSchema = z.object({
    username : z.string().email(),
    firstName : z.string(),
    lastName : z.string(),
    password : z.string(),
})

router.post("/signup", async (req , res ) => {
    
    const body = req.body;
    const {success} = signupSchema.safeParse(req.body)
    if (!success) {

        res.status(411).json({
            message : "Incorrect inputs "
        })
    
    }

    const existingUser = await User.findOne({
        username : req.body.username,
    })
    
    if(existingUser) {
        
        return res.status(411).json({
            message : "Email already taken"
        })
    }

    const user = await User.create({
        username : req.body.username,
        firstName : req.body.firstName,
        lastName : req.body.lastName,
        password : req.body.password,
    }) 
    const userID = User._id;
    const token = jwt.sign({userID} , JWT_SECRET);
    if (user) {
        res.status(201).json({
            message: "User created successfully",
            token,
        })
    }
})

const signinSchema = z.object({
    username : z.string().email(),
    password : z.string(),
})

router.post("/signin", async (req , res ) => {
    
    const body = req.body;
    const {success} = signinSchema.safeParse(req.body)
    if (!success) {

        return res.status(411).json({
            message : "Incorrect inputs "
        })
    
    }

    const user = await User.findOne({
        username : req.body.username,
        password : req.body.password
    })
    
    if(user) {
        const userID = User._id;
        const token = jwt.sign({userID} , JWT_SECRET);

        res.status(201).json({
            message: "User Login succesfully",
            token,
        });
        return;
    }

    return res.status(411).json({
        message : "Error while login"
    })
})

module.exports = router;