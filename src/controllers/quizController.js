// src/controllers/quizController.js
const pool = require('../config/db');
const metaService = require('../services/metaModelService');

// Render a quiz for a lesson
exports.renderQuiz = async (req, res) => {
    try {
        const lessonId = req.params.lessonId;
        const user = req.session.user;

        const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE lesson_id = ?', [lessonId]);
        if (quizzes.length === 0) {
            return res.redirect('/dashboard');
        }

        res.render('quiz', {
            title: 'DannaEdu AI - Adaptive Quiz',
            user,
            quiz: quizzes[0],
            evaluation: null,
            error: null
        });
    } catch (err) {
        console.error("Quiz Error:", err.message);
        res.redirect('/dashboard');
    }
};

// Process and evaluate the student's answer
exports.handleQuizSubmission = async (req, res) => {
    try {
        const quizId = req.params.quizId;
        const { userAnswer } = req.body;
        const user = req.session.user;

        const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE id = ?', [quizId]);
        const quiz = quizzes[0];

        // Intelligent AI evaluation of the answer based on the user's level
        const evaluation = await metaService.evaluateQuizAnswer(
            quiz.question, 
            userAnswer, 
            quiz.correct_answer, 
            user.level
        );

        res.render('quiz', {
            title: 'DannaEdu AI - Quiz Result',
            user,
            quiz,
            userAnswer,
            evaluation,
            error: null
        });
    } catch (err) {
        res.render('quiz', {
            title: 'DannaEdu AI - Error',
            user: req.session.user,
            quiz: { id: req.params.quizId, question: "", options: [] },
            userAnswer: "",
            evaluation: null,
            error: err.message
        });
    }
};