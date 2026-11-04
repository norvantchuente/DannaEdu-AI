const pool = require('../config/db');
const metaService = require('../services/metaModelService');
const fs = require('fs');

// Render a course, its associated lesson, and the quiz if it exists in the database
exports.renderCourseDetail = async (req, res) => {
    try {
        const courseId = req.params.id;
        const user = req.session.user;

        const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (courses.length === 0) return res.redirect('/dashboard');
        const course = courses[0];

        const [lessons] = await pool.query('SELECT * FROM lessons WHERE course_id = ?', [courseId]);
        const lesson = lessons[0] || { id: 1, title: course.title, content_text: course.description, content_image_url: null };

        // Retrieve the quiz associated with this lesson (if any)
        const [quizzes] = await pool.query('SELECT id FROM quizzes WHERE lesson_id = ?', [lesson.id]);
        const quizId = quizzes.length > 0 ? quizzes[0].id : null;

        res.render('course-detail', {
            title: `DannaEdu AI - ${course.title}`,
            user,
            course,
            lesson,
            quizId, // Passed to the view
            chatResponse: null,
            error: null
        });
    } catch (err) {
        console.error("Course Detail Error:", err.message);
        res.redirect('/dashboard');
    }
};

// Handle the message and optional image sent to the Danna AI assistant in the course
exports.handleCourseChat = async (req, res) => {
    try {
        const courseId = req.params.id;
        const { message } = req.body;
        let history = [];
        
        // Secure parsing of history if sent as a string (via FormData)
        if (req.body.history) {
            try {
                history = typeof req.body.history === 'string' ? JSON.parse(req.body.history) : req.body.history;
            } catch (e) {
                history = [];
            }
        }

        const imageFile = req.file ? req.file.path : null;

        const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (courses.length === 0) return res.status(404).json({ error: "Course not found." });
        const course = courses[0];

        const [lessons] = await pool.query('SELECT * FROM lessons WHERE course_id = ?', [courseId]);
        const lessonContent = lessons.map(l => `Lesson: ${l.title}\nContent: ${l.content_text || l.content}`).join('\n\n');

        // Build contextual history with course content and anti-Markdown instruction
        const conversationHistory = [
            { 
                role: "system", 
                content: `You are Danna AI, a supportive educational tutor. Help the student understand the course "${course.title}" based on this curriculum:\n\n${lessonContent}\n\nABSOLUTE RULE: Do NOT use ANY asterisks (*), double asterisks (**), or Markdown markup for bold or italic formatting in your responses.` 
            },
            ...(Array.isArray(history) ? history : [])
        ];

        // Call the AI service
        const chatResponse = await metaService.chatWithSpark(message, conversationHistory, imageFile);

        res.json({ reply: chatResponse });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error("Classic course chat error:", err.message);
        res.status(500).json({ error: "Unable to generate a response." });
    }
};

// Mark a lesson as completed
exports.completeLesson = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const lessonId = req.params.lessonId;

        // Using an UPSERT (INSERT ... ON DUPLICATE KEY UPDATE) to mark as completed
        await pool.query(
            `INSERT INTO user_progress (user_id, lesson_id, completed) 
             VALUES (?, ?, 1) 
             ON DUPLICATE KEY UPDATE completed = 1, updated_at = CURRENT_TIMESTAMP`,
            [userId, lessonId]
        );

        // Record action in activity logs
        await pool.query(
            'INSERT INTO activity_logs (user_id, action, metadata) VALUES (?, ?, ?)',
            [userId, 'COMPLETE_LESSON', JSON.stringify({ lessonId })]
        );

        res.redirect('/dashboard');
    } catch (err) {
        console.error("Error while validating lesson:", err.message);
        res.redirect('/dashboard');
    }
};