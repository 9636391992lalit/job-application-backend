// createAdmin.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import 'dotenv/config'; // To load environment variables like DB URI
import Admin from './models/Admin.js'; // Import your Admin model
import connectDB from './config/db.js'; // Import your DB connection function

// --- Configure Admin Details ---
// IMPORTANT: Change these values or use environment variables!
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || 'lalitsharmajp@gmail.com';
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'Lalit@2004';
// -----------------------------

const createAdminUser = async () => {
    try {
        // 1. Connect to the database
        await connectDB();
        console.log('Database connected for admin creation.');

        // 2. Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: ADMIN_EMAIL });
        if (existingAdmin) {
            console.log(`Admin user with email ${ADMIN_EMAIL} already exists.`);
            return; // Exit if admin exists
        }

        // 3. Hash the password
        console.log('Hashing password...');
        const salt = await bcrypt.genSalt(10); // Generate salt (cost factor 10)
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt); // Hash the plain password
        console.log('Password hashed successfully.');

        // 4. Create the new admin document
        const newAdmin = new Admin({
            email: ADMIN_EMAIL,
            password: hashedPassword // Store the HASHED password
        });

        // 5. Save the admin to the database
        await newAdmin.save();
        console.log(`Admin user ${ADMIN_EMAIL} created successfully!`);

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        // 6. Disconnect from the database
        await mongoose.disconnect();
        console.log('Database disconnected.');
    }
};

// Run the function
createAdminUser();