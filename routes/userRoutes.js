import express from 'express'
import {getUserData,
    applyForJob,
    getUserJobApplication,
    updateUserResume,
    getSavedJobs,
    toggleSaveJob,
    updateUserProfile,
    getPublicUserProfile,
    registerUser,
    loginUser
} from '../controllers/userControllers.js'
import  upload from '../config/multer.js'
import { protectUser } from '../middleware/authMiddleware.js'

const router=express.Router()

// Public routes (no authentication required)
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/public-profile/:id', getPublicUserProfile);

// Protected routes (authentication required)
router.get('/user', protectUser, getUserData)
router.post('/apply', protectUser, applyForJob)
router.get('/applications', protectUser, getUserJobApplication)
router.post('/update-resume', protectUser, upload.single('resume'), updateUserResume)
router.get('/saved-jobs', protectUser, getSavedJobs);
router.post('/save-job', protectUser, toggleSaveJob);
router.put('/update-profile', protectUser, updateUserProfile);

export default router;