// middleware/adminAuthMiddleware.js
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js'; // Import the Admin model

export const protectAdmin = async (req, res, next) => {
    let token;

    // Read the JWT from a header (e.g., 'admin-token' or 'Authorization: Bearer ADMIN_TOKEN')
    // Adjust header based on what you send from the frontend (src/services/adminApi.js)
    if (req.headers['admin-token']) {
        token = req.headers['admin-token'];
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
         // Example if using standard Authorization header like 'Bearer YOUR_ADMIN_TOKEN'
         try {
             token = req.headers.authorization.split(' ')[1];
         } catch (error) {
             console.error("Error parsing Bearer token:", error);
             return res.status(401).json({ success: false, message: 'Not authorized, token format invalid' });
         }
    }


    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no admin token provided' });
    }

    try {
        // Verify the token using your ADMIN JWT SECRET
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET); // Use a specific admin secret!

        // Get admin user from the token payload (assuming token contains admin ID)
        // Select '-password' to exclude the hashed password from the req object
        req.admin = await Admin.findById(decoded.id).select('-password');

        if (!req.admin) {
             // If ID in token doesn't match any admin in DB
             return res.status(401).json({ success: false, message: 'Not authorized, admin not found' });
        }

        next(); // Proceed to the next middleware or route handler

    } catch (error) {
        console.error('Admin token verification failed:', error);
        // Handle specific JWT errors like expiration
        if (error.name === 'TokenExpiredError') {
             return res.status(401).json({ success: false, message: 'Not authorized, admin token expired' });
        }
        return res.status(401).json({ success: false, message: 'Not authorized, admin token failed' });
    }
};