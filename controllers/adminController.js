// controllers/adminController.js
import PendingCompany from '../models/PendingCompany.js';
import Company from '../models/Company.js'; // Import the main Company model
import Admin from '../models/Admin.js'; // <-- Import Admin model
import bcrypt from 'bcrypt';         // <-- Import bcrypt
import generateAdminToken from '../utils/generateAdminToken.js';
import sendEmail from '../utils/sendEmail.js';
import 'dotenv/config';

/**
 * @desc    Authenticate admin & get token
 * @route   POST /api/admin/login
 * @access  Public
 */
export const loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    try {
        // Find admin user by email
        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(401).json({ success: false, message: "Invalid admin credentials." }); // Use 401 Unauthorized
        }

        // Compare provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid admin credentials." }); // Use 401 Unauthorized
        }

        // Passwords match - Generate JWT token for admin session
        const token = generateAdminToken(admin._id); // Generate a token

        res.json({
            success: true,
            message: "Admin login successful!",
            token: token // Send the token back to the frontend
        });

    } catch (error) {
        console.error("Error during admin login:", error);
        res.status(500).json({ success: false, message: "Admin login failed. Please try again." });
    }
};

/**
 * @desc    Get all companies pending approval
 * @route   GET /api/admin/pending-companies
 * @access  Private/Admin
 */
export const getPendingCompanies = async (req, res) => {
    try {
        // Fetch pending companies, sort by submission date
        const pendingList = await PendingCompany.find().sort({ submittedAt: 1 }); // Oldest first
        res.json({ success: true, pendingCompanies: pendingList });
    } catch (error) {
        console.error("Error fetching pending companies:", error);
        res.json({ success: false, message: "Failed to fetch pending companies." });
    }
};

/**
 * @desc    Approve a pending company registration
 * @route   POST /api/admin/approve-company/:pendingId
 * @access  Private/Admin
 */
export const approveCompany = async (req, res) => {
  const { pendingId } = req.params;

  try {
    const pendingData = await PendingCompany.findById(pendingId);

    if (!pendingData) {
      return res.json({ success: false, message: "Pending company not found." });
    }

    // Check if a company with the same unique identifiers already exists in the main collection
    const existingCompany = await Company.findOne({ $or: [{ email: pendingData.email }, { cin: pendingData.cin }, { domain: pendingData.domain }] });
    if (existingCompany) {
      // If duplicate found, remove the pending entry to prevent clutter
      await PendingCompany.findByIdAndDelete(pendingId);
      return res.json({ success: false, message: "Company with this email/CIN/domain already exists. Pending entry removed." });
    }

    // Create a new entry in the main Company collection
    const newCompany = await Company.create({
      name: pendingData.name,
      email: pendingData.email,
      password: pendingData.password, // Ensure password in pending collection is hashed correctly during registration
      image: pendingData.image,
      website: pendingData.website,
      domain: pendingData.domain,
      cin: pendingData.cin,
      isVerified: true, // Mark as verified upon approval
      status: 'Approved' // Set status to Approved
    });

    // Delete the entry from PendingCompany collection now that it's approved
    await PendingCompany.findByIdAndDelete(pendingId);

    // --- Send Approval Email ---
    const subject = `🎉 Your Company Registration Approved on Insider Job!`;
    const textBody = `Hello ${newCompany.name},\n\nGreat news! Your company registration for "${newCompany.name}" has been approved by our admin team.\n\nYou can now log in to your recruiter dashboard and start posting jobs.\n\nLogin here: ${process.env.FRONTEND_URL || 'YOUR_FRONTEND_LOGIN_URL'}\n\nWelcome aboard!\n\nBest regards,\nThe Insider Job Team`; // Added Login URL placeholder

    // Send the email (don't block the response if email sending fails)
    // FIX: Removed the undefined htmlBody argument
    sendEmail(newCompany.email, subject, textBody)
      .then(emailResult => {
        if (!emailResult.success) {
          console.error(`Failed to send approval email to ${newCompany.email}: ${emailResult.error}`);
          // Optional: Log this error more formally (e.g., using a logging service)
        } else {
            console.log(`Approval email sent successfully to ${newCompany.email}`);
        }
      });
    // ---------------------------

    // Send success response to the frontend
    res.json({ success: true, message: `Company '${newCompany.name}' approved and moved to main collection.` });

  } catch (error) {
    console.error("Error approving company:", error);
    // Send a generic failure response to the frontend
    res.json({ success: false, message: "Failed to approve company." });
  }
};

/**
 * @desc    Reject a pending company registration
 * @route   POST /api/admin/reject-company/:pendingId
 * @access  Private/Admin
 */
export const rejectCompany = async (req, res) => {
  const { pendingId } = req.params;

  try {
    // Find and delete the pending entry first to get its details for the email
    const deletedPending = await PendingCompany.findByIdAndDelete(pendingId);

    if (!deletedPending) {
      return res.json({ success: false, message: "Pending company not found." });
    }

    // --- Send Rejection Email ---
    const subject = `❌ Regarding Your Company Registration on Insider Job`; // Use your app name
    const textBody = `Hello ${deletedPending.name},\n\nWe are writing to inform you that after careful review, your company registration for "${deletedPending.name}" on Insider Job has not been approved at this time.\n\nThere could be various reasons for this decision, such as incomplete information or not meeting our platform's criteria. If you believe this was in error or have questions, please contact our support team at ${process.env.EMAIL_USER}.\n\nThank you for your interest.\n\nSincerely,\nThe Insider Job Team`; // Use your app name

    // Send the email asynchronously
    // FIX: Removed the undefined htmlBody argument
    sendEmail(deletedPending.email, subject, textBody)
      .then(emailResult => {
        if (!emailResult.success) {
          console.error(`Failed to send rejection email to ${deletedPending.email}: ${emailResult.error}`);
          // Optional: Log this error more formally
        } else {
            console.log(`Rejection email sent successfully to ${deletedPending.email}`);
        }
      });
    // ---------------------------

    // Send success response to the frontend
    res.json({ success: true, message: `Company registration for '${deletedPending.name}' rejected and removed.` });

  } catch (error) {
    console.error("Error rejecting company:", error);
    // Send a generic failure response to the frontend
    res.json({ success: false, message: "Failed to reject company." });
  }
};