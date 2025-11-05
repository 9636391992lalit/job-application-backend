import jwt from 'jsonwebtoken'
import Company from '../models/Company.js'
import User from '../models/User.js'

export const protectCompany=async(req,res,next)=>
{
    const token=req.headers.token
    if(!token)
    {
        return res.json({success:false,message:'Not authorized. Login again'})
    }
    try
    {
        const decoded=jwt.verify(token, process.env.JWT_SECRET)
        req.company=await Company.findById(decoded.id).select('-password')
        next()
    }
    catch(error)
    {
        res.json({success:false, message:error.message})  
    }

}

export const protectUser = async (req, res, next) => {
    try {
        // Get token from Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Not authorized. Login again' });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from token and attach to request
        req.user = await User.findById(decoded.id).select('-password');
        
        if (!req.user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Create auth object for compatibility with existing code
        req.auth = { userId: decoded.id };
        
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}