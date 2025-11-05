// routes/adminRoutes.js
import express from 'express';
import { getPendingCompanies, approveCompany, rejectCompany,loginAdmin } from '../controllers/adminController.js';
// IMPORTANT: You'll need an admin authentication middleware here!
// import { protectAdmin } from '../middleware/adminAuthMiddleware.js'; // Example
import { protectAdmin } from '../middleware/adminAuthMiddleware.js';
const router = express.Router();

// Apply admin protection to all routes in this file
// router.use(protectAdmin); // Uncomment when you have the middleware
router.post('/login', loginAdmin);
router.use(protectAdmin);
// Get all companies waiting for approval
router.get('/pending-companies', getPendingCompanies);

// Approve a company
router.post('/approve-company/:pendingId', approveCompany); // Use POST or PUT

// Reject a company
router.post('/reject-company/:pendingId', rejectCompany); // Use POST or DELETE

export default router;