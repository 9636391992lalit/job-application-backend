import express from 'express'
const router = express.Router()
import {protectCompany} from '../middleware/authMiddleware.js'
import upload from '../config/multer.js'
import {changeVisiblity,
    ChangeJobApplicationsStatus,
    getCompanyPostedJobs,
    getCompanyJobApplicants,
    postJob,getCompanyData,
    loginCompany,
    registerCompany,
    getPublicCompanyProfile,
    updateCompanyProfile,scheduleInterview,generateJobDescription} from '../controllers/compnayControllers.js'
// Register a comany
router.post('/register',upload.single('image'),registerCompany)
//comany login
router.post('/login',loginCompany)
// --- NEW: Public route to get company profile and its jobs ---

//getCompany data
router.get('/company',protectCompany,getCompanyData)
router.put('/update-profile',protectCompany ,updateCompanyProfile)
router.get('/public/:id', getPublicCompanyProfile)
//Post a job
router.post('/schedule-interview/:applicationId', protectCompany, scheduleInterview);
router.post('/post-job',protectCompany,postJob)
router.post('/generate-description',protectCompany, generateJobDescription);
//Get Application Data of Comany 
router.get('/applicants',protectCompany,getCompanyJobApplicants)
//Get Company Job List
router.get('/list-jobs',protectCompany,getCompanyPostedJobs)
//Change Applications Status
router.post('/change-status',protectCompany,ChangeJobApplicationsStatus)
//Change Application visiblity 
router.post('/change-visiblity',protectCompany,changeVisiblity)
export default router