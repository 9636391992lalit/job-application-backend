// utils/generateAdminToken.js
import jwt from 'jsonwebtoken';
import 'dotenv/config'; // Make sure dotenv is configured

const generateAdminToken = (id) => {
    // Ensure you have ADMIN_JWT_SECRET in your .env file
    if (!process.env.ADMIN_JWT_SECRET) {
        console.error('FATAL ERROR: ADMIN_JWT_SECRET is not defined in .env file');
        process.exit(1); // Exit the process if the secret is missing
    }

    return jwt.sign(
        { id: id, type: 'admin' }, // Payload: include admin ID and maybe a type/role
        process.env.ADMIN_JWT_SECRET, // Use the specific ADMIN secret key
        {
            expiresIn: '1d' // Token expiry time (e.g., 1 day) - adjust as needed
        }
    );
};

export default generateAdminToken;