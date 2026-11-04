const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'public/uploads/' });
const eduController = require('../controllers/educationController');
const authMiddleware = require('../middlewares/authMiddleware');
const courseController = require('../controllers/courseController');
const quizController = require('../controllers/quizController');

const uploadAudio = multer({
    dest: 'public/uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('audio') || file.originalname.match(/\.(wav|mp3)$/i)) {
            cb(null, true);
        } else {
            cb(new Error("Only .wav and .mp3 audio files are permitted."), false);
        }
    }
});

// Display the import page
router.get('/courses/import', authMiddleware, eduController.renderImportCourse);

// Process the import of the course file
router.post('/courses/import', authMiddleware, upload.single('courseFile'), eduController.handleCourseImport);

router.get('/courses/:id', authMiddleware, courseController.renderCourseDetail);

// Route for viewing an imported dynamic course
router.get('/courses/view/:id', authMiddleware, eduController.renderDynamicCourseDetail);

router.post('/courses/view/:id/chat', authMiddleware, eduController.handleDynamicCourseChat);

router.post('/courses/view/:id/delete', authMiddleware, eduController.deleteDynamicCourse);

// Landing Page (Public-facing landing page)
router.get('/', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('landing', { title: 'DannaEdu AI - Learn in Your Language' });
});

// User Dashboard (Protected)
router.get('/dashboard', authMiddleware, eduController.renderDashboard);

// Multimodal chat route configured with Multer to intercept 'chatImage'
router.post('/courses/:id/chat', authMiddleware, upload.single('chatImage'), courseController.handleCourseChat);

router.get('/quiz/:lessonId', authMiddleware, quizController.renderQuiz);
router.post('/quiz/:quizId/submit', authMiddleware, quizController.handleQuizSubmission);

// Advanced Pedagogical Tools (Dedicated Views)
router.get('/tools/wonder', authMiddleware, eduController.renderWonderTool);
router.post('/tools/wonder', authMiddleware, upload.single('documentFile'), eduController.handleWonderTool);

router.get('/tools/image', authMiddleware, eduController.renderImageTool);
router.post('/tools/image/generate', authMiddleware, eduController.handleImageGeneration);
router.post('/tools/image/edit', authMiddleware, upload.single('sourceImage'), eduController.handleImageEdit);

router.get('/tools/voice', authMiddleware, eduController.renderVoiceTool);
router.post('/tools/voice', authMiddleware, upload.single('audioFile'), eduController.handleVoiceTool);

router.get('/tools/sam', authMiddleware, eduController.renderSamTool);
router.post('/tools/sam', authMiddleware, upload.single('imageFile'), eduController.handleSamTool);

router.post('/user/language', authMiddleware, eduController.updateUserLanguage);

// Path to completing a lesson
router.post('/lessons/:lessonId/complete', authMiddleware, courseController.completeLesson);


module.exports = router;