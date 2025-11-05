// models/Admin.js
import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Store HASHED password
    // You might add name, role, etc. later
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);
export default Admin;