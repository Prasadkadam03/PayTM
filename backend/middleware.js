const JWT_SECRET = require("./config");
const jwt = require("jsonwebtoken");

const authMiddleware =  (req , res , next ) => {
    const headerToken = req.headers.authorization;
    if(!headerToken || !headerToken.startsWith("Bearer ")) {

        return res.status(403).json({
            message : "token invalid / Not received"
        })
    }

    const token = headerToken.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token , JWT_SECRET);
        req.userId = decoded.userId;
    
    } catch (err){
       
        return res.status(403).json({
            message : "Invalid Authorization token"
        })
    
    }
     next();

}

module.exports = {
    authMiddleware,
}