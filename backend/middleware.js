const JWT_SECRET = require("./config");

const jwt = require("jsonwebtoken");

const authMiddleware =  (req , res , next ) => {
    const headerToken = req.headers.authorization;
    if(!headerToken || !headerToken.startsWith("Bearer ")) {

        return res.status(403).json({
            message : "token invalid / Not received"
        })
    }

    
    try {
        const token = headerToken.split(' ')[1];    
        const decodedUserid = jwt.verify(token , JWT_SECRET);
        req.userId = decodedUserid;
    
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