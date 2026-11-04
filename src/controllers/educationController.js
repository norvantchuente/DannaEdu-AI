// src/controllers/educationController.js
const metaService = require('../services/metaModelService');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const PDFParser = require('pdf2json');

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Complete list of the 25 supported languages and their base UI dictionaries
const SUPPORTED_LANGUAGES = [
    'Français', 'Anglais', 'Espagnol', 'Allemand', 'Arabe', 'Chinois mandarin', 
    'Japonais', 'Coréen', 'Italien', 'Portugais', 'Néerlandais', 'Russe', 
    'Turc', 'Polonais', 'Vietnamien', 'Hindi', 'Hébreu', 'Suédois', 
    'Danois', 'Finnois', 'Grec', 'Tchèque', 'Hongrois', 'Roumain', 'Indonésien'
];

// Utility function to log user activity
async function logUserActivity(userId, action, metadata) {
    try {
        await pool.query(
            'INSERT INTO activity_logs (user_id, action, metadata) VALUES (?, ?, ?)',
            [userId, action, JSON.stringify(metadata)]
        );
    } catch (err) {
        console.error("Error while recording activity log:", err.message);
    }
}

// Instant UI translation dictionary based on user language
function getLocalizedUiLabels(lang) {
    const dictionaries = {
        'Anglais': {
            welcome: 'Active Profile',
            globalProgress: 'Global Progress',
            learningStreak: 'Learning Streak',
            aiInteractions: 'AI Interactions',
            recommendedCourses: 'Recommended Courses for You',
            advancedTools: 'Advanced Educational Tools',
            recentActivity: 'Recent Activity',
            changeLanguage: 'Change Language:'
        },
        'Espagnol': {
            welcome: 'Perfil Activo',
            globalProgress: 'Progreso Global',
            learningStreak: 'Racha de Aprendizaje',
            aiInteractions: 'Interacciones de IA',
            recommendedCourses: 'Cursos recomendados para ti',
            advancedTools: 'Herramientas Educativas Avanzadas',
            recentActivity: 'Actividad Reciente',
            changeLanguage: 'Cambiar idioma:'
        },
        'Allemand': {
            welcome: 'Aktives Profil',
            globalProgress: 'Gesamtfortschritt',
            learningStreak: 'Llernserie',
            aiInteractions: 'KI-Interaktionen',
            recommendedCourses: 'Empfohlene Kurse für Sie',
            advancedTools: 'Erweiterte Bildungswerkzeuge',
            recentActivity: 'Letzte Aktivität',
            changeLanguage: 'Sprache ändern:'
        },
        'Arabe': {
            welcome: 'الملف الشخصي النشط',
            globalProgress: 'التقدم الإجمالي',
            learningStreak: 'سلسلة التعلم',
            aiInteractions: 'تفاعلات الذكاء الاصطناعي',
            recommendedCourses: 'الدورات الموصى بها لك',
            advancedTools: 'أدوات تعليمية متقدمة',
            recentActivity: 'النشاط الأخير',
            changeLanguage: 'تغيير اللغة:'
        },
        'Chinois mandarin': {
            welcome: '活动个人资料',
            globalProgress: '全局进度',
            learningStreak: '学习连续天数',
            aiInteractions: 'AI 交互',
            recommendedCourses: '为您推荐的课程',
            advancedTools: '高级教育工具',
            recentActivity: '近期活动',
            changeLanguage: '更改语言：'
        },
        'Japonais': {
            welcome: 'アクティブプロフィール',
            globalProgress: '全体的な進捗',
            learningStreak: '学習ストリーク',
            aiInteractions: 'AI インタラクション',
            recommendedCourses: 'あなたにおすすめのコース',
            advancedTools: '高度な教育ツール',
            recentActivity: '最近のアクティビティ',
            changeLanguage: '言語を変更：'
        },
        'Français': {
            welcome: 'Profil Actif',
            globalProgress: 'Progression Globale',
            learningStreak: "Série d'Apprentissage",
            aiInteractions: 'Interactions IA',
            recommendedCourses: 'Cours Recommandés pour vous',
            advancedTools: 'Outils Pédagogiques Avancés',
            recentActivity: 'Activités Récentes',
            changeLanguage: 'Changer de langue :'
        }
    };
    
    return dictionaries[lang] || dictionaries['Anglais'];
}

// Change user language on the fly
exports.updateUserLanguage = async (req, res) => {
    try {
        const { language } = req.body;
        const userId = req.session.user.id;

        if (SUPPORTED_LANGUAGES.includes(language)) {
            await pool.query('UPDATE users SET language = ? WHERE id = ?', [language, userId]);
            req.session.user.language = language;
            await logUserActivity(userId, 'UPDATE_LANGUAGE', { newLanguage: language });
        }

        res.redirect('/dashboard');
    } catch (err) {
        console.error("Error while changing language:", err.message);
        res.redirect('/dashboard');
    }
};

// Render main dashboard (Dynamic & Multilingual)
exports.renderDashboard = async (req, res) => {
    try {
        const user = req.session.user;
        const userLanguage = user.language || 'Anglais';
        const selectedSubjectId = req.query.subject_id || null;

        // 1. Retrieve all available subjects/specialties
        const [subjects] = await pool.query('SELECT * FROM subjects').catch(() => [[]]);

        // 2. Retrieve recent user activity logs
        const [recentLogs] = await pool.query(
            'SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5',
            [user.id]
        ).catch(() => [[]]);

        // 3. Retrieve recommended courses from MySQL (filtered by language and optionally subject)
        let courseQuery = 'SELECT * FROM courses WHERE target_language = ?';
        let queryParams = [userLanguage];

        if (selectedSubjectId) {
            courseQuery += ' AND subject_id = ?';
            queryParams.push(selectedSubjectId);
        }
        courseQuery += ' LIMIT 6';

        const [recommendedCourses] = await pool.query(courseQuery, queryParams).catch(() => [[]]);

        // 4. Load imported dynamic courses (independent of DB)
        const dynamicCoursesDir = path.join(__dirname, '../content/dynamic-courses');
        let dynamicCourses = [];
        
        if (fs.existsSync(dynamicCoursesDir)) {
            const files = fs.readdirSync(dynamicCoursesDir);
            dynamicCourses = files
                .filter(file => file.endsWith('.json'))
                .map(file => {
                    try {
                        const filePath = path.join(dynamicCoursesDir, file);
                        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    } catch (e) {
                        return null;
                    }
                })
                .filter(course => course !== null);

            // Optionally filter dynamic courses by user language
            dynamicCourses = dynamicCourses.filter(course => !course.target_language || course.target_language === userLanguage);
        }

        // 5. Statistics calculations (Activities, Streak, Progress)
        const [statsResult] = await pool.query(
            'SELECT COUNT(*) as totalActivity FROM activity_logs WHERE user_id = ?',
            [user.id]
        ).catch(() => [[{ totalActivity: 0 }]]);
        const totalActivities = statsResult[0].totalActivity || 0;

        const [streakRows] = await pool.query(
            'SELECT COUNT(DISTINCT DATE(timestamp)) as streakDays FROM activity_logs WHERE user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
            [user.id]
        ).catch(() => [[{ streakDays: 1 }]]);
        const streakDays = Math.max(1, streakRows[0].streakDays || 1);

        let completionRate = 0;
        try {
            const [progressRows] = await pool.query(
                'SELECT COUNT(DISTINCT lesson_id) as completedCount FROM user_progress WHERE user_id = ? AND completed = 1',
                [user.id]
            );
            const [totalLessonsRows] = await pool.query('SELECT COUNT(*) as totalCount FROM lessons');
            const totalLessons = totalLessonsRows[0].totalCount || 1;
            const completedLessons = progressRows[0].completedCount || 0;
            completionRate = Math.round((completedLessons / totalLessons) * 100);
        } catch (e) {
            completionRate = 0;
        }

        const stats = { totalActivities, streakDays, completionRate };
        const uiLabels = getLocalizedUiLabels(userLanguage);

        res.render('dashboard', {
            title: `DannaEdu AI - Dashboard`,
            user,
            recentLogs,
            subjects,
            selectedSubjectId,
            recommendedCourses,
            dynamicCourses,
            stats,
            uiLabels,
            error: null
        });
    } catch (err) {
        console.error("Dashboard Error:", err.message);
        res.status(500).render('dashboard', {
            title: 'DannaEdu AI - Error',
            user: req.session.user,
            recentLogs: [],
            subjects: [],
            selectedSubjectId: null,
            recommendedCourses: [],
            dynamicCourses: [],
            stats: { totalActivities: 0, streakDays: 1, completionRate: 0 },
            uiLabels: getLocalizedUiLabels('Anglais'),
            error: "Unable to load dashboard."
        });
    }
};

// 1. Content Adaptation
exports.handleTextAdaptation = async (req, res) => {
    try {
        const { content } = req.body;
        const user = req.session.user;

        const targetLanguage = user.language || 'Anglais';
        const targetLevel = user.level || 'Beginner';

        const resultText = await metaService.adaptContent(content, targetLanguage, targetLevel);

        await logUserActivity(user.id, 'ADAPT_TEXT', { language: targetLanguage, level: targetLevel });

        res.render('index', {
            title: 'DannaEdu AI - Dashboard',
            user,
            resultText,
            imageUrl: null,
            transcription: null,
            segmentResult: null,
            error: null
        });
    } catch (err) {
        res.render('index', {
            title: 'DannaEdu AI - Error',
            user: req.session.user,
            resultText: null,
            imageUrl: null,
            transcription: null,
            segmentResult: null,
            error: err.message
        });
    }
};

// 2. Image Generation
exports.handleImageGeneration = async (req, res) => {
    try {
        const { promptDesc } = req.body;
        const user = req.session.user;

        const imageUrl = await metaService.generateCourseImage(promptDesc);
        await logUserActivity(user.id, 'GENERATE_IMAGE', { prompt: promptDesc });

        res.render('index', {
            title: 'DannaEdu AI - Dashboard',
            user,
            resultText: null,
            imageUrl,
            transcription: null,
            segmentResult: null,
            error: null
        });
    } catch (err) {
        res.render('index', {
            title: 'DannaEdu AI - Error',
            user: req.session.user,
            resultText: null,
            imageUrl: null,
            transcription: null,
            segmentResult: null,
            error: err.message
        });
    }
};

// 3. Audio Transcription
exports.handleAudioTranscription = async (req, res) => {
    try {
        if (!req.file) throw new Error("Please provide a WAV audio file.");
        const user = req.session.user;

        const transcription = await metaService.transcribeAudio(req.file.path);
        await logUserActivity(user.id, 'TRANSCRIBE_AUDIO', { filename: req.file.originalname });

        res.render('index', {
            title: 'DannaEdu AI - Dashboard',
            user,
            resultText: null,
            imageUrl: null,
            transcription,
            segmentResult: null,
            error: null
        });
    } catch (err) {
        res.render('index', {
            title: 'DannaEdu AI - Error',
            user: req.session.user,
            resultText: null,
            imageUrl: null,
            transcription: null,
            segmentResult: null,
            error: err.message
        });
    }
};

// 4. Image Segmentation
exports.handleImageSegmentation = async (req, res) => {
    try {
        if (!req.file) throw new Error("Please provide an image to segment.");
        const { targetPrompt } = req.body;
        const user = req.session.user;

        const segmentResult = await metaService.segmentImageElements(req.file.path, targetPrompt);
        await logUserActivity(user.id, 'SEGMENT_IMAGE', { prompt: targetPrompt });

        res.render('index', {
            title: 'DannaEdu AI - Dashboard',
            user,
            resultText: null,
            imageUrl: null,
            transcription: null,
            segmentResult,
            error: null
        });
    } catch (err) {
        res.render('index', {
            title: 'DannaEdu AI - Error',
            user: req.session.user,
            resultText: null,
            imageUrl: null,
            transcription: null,
            segmentResult: null,
            error: err.message
        });
    }
};

// --- MODULE 1: Translation & Adaptation ---
exports.renderWonderTool = (req, res) => {
    res.render('tools/wonder', { title: 'DannaEdu AI - Adaptation & Translation', user: req.session.user, resultText: null, error: null });
};

exports.handleWonderTool = async (req, res) => {
    try {
        let contentToAdapt = req.body.content || "";
        const { targetLanguage, targetLevel } = req.body;
        const user = req.session.user;

        if (req.file) {
            const filePath = req.file.path;
            const fileExtension = req.file.originalname.split('.').pop().toLowerCase();

            if (fileExtension === 'pdf') {
                contentToAdapt = await new Promise((resolve, reject) => {
                    const pdfParser = new PDFParser(this, 1);
                    pdfParser.on("pdfParser_dataError", errData => reject(new Error(errData.parserError)));
                    pdfParser.on("pdfParser_dataReady", pdfData => {
                        const rawText = pdfParser.getRawTextContent();
                        resolve(rawText);
                    });
                    pdfParser.loadPDF(filePath);
                });
            } else if (fileExtension === 'docx' || fileExtension === 'doc') {
                const result = await mammoth.extractRawText({ path: filePath });
                contentToAdapt = result.value;
            } else {
                contentToAdapt = fs.readFileSync(filePath, 'utf8');
            }

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        if (!contentToAdapt || contentToAdapt.trim() === "") {
            throw new Error("Please enter text or provide a valid document (.pdf, .docx, .txt).");
        }

        const antiMarkdownInstruction = "\n\n[IMPORTANT INSTRUCTION: Do NOT use ANY asterisks (*), double asterisks (**), or Markdown markup for bold or italic formatting. Write exclusively in well-structured plain text.]";
        const finalContent = contentToAdapt + antiMarkdownInstruction;

        const resultText = await metaService.adaptContent(finalContent, targetLanguage, targetLevel);
        await logUserActivity(user.id, 'WONDER_ADAPT', { targetLanguage, targetLevel });
        
        res.render('tools/wonder', { title: 'DannaEdu AI - Adaptation & Translation', user: req.session.user, resultText, error: null });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.render('tools/wonder', { title: 'DannaEdu AI - Error', user: req.session.user, resultText: null, error: err.message });
    }
};

// --- MODULE 2: Illustrations & Editing ---
exports.renderImageTool = (req, res) => {
    res.render('tools/image', { 
        title: 'DannaEdu AI - Illustration Generation & Editing', 
        user: req.session.user, 
        imageUrl: null, 
        error: null 
    });
};

exports.handleImageGeneration = async (req, res) => {
    try {
        const { promptDesc } = req.body;
        const user = req.session.user;
        const imageUrl = await metaService.generateCourseImage(promptDesc);
        await logUserActivity(user.id, 'GENERATE_IMAGE', { prompt: promptDesc });
        res.render('tools/image', { title: 'DannaEdu AI - Illustrations', user: req.session.user, imageUrl, error: null });
    } catch (err) {
        res.render('tools/image', { title: 'DannaEdu AI - Error', user: req.session.user, imageUrl: null, error: err.message });
    }
};

exports.handleImageEdit = async (req, res) => {
    try {
        if (!req.file) throw new Error("Please select a source image to edit.");
        const { editPrompt } = req.body;
        const user = req.session.user;
        const imageUrl = await metaService.editCourseImage(req.file.path, editPrompt);
        await logUserActivity(user.id, 'EDIT_IMAGE', { prompt: editPrompt });
        res.render('tools/image', { title: 'DannaEdu AI - Image Editing', user: req.session.user, imageUrl, error: null });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.render('tools/image', { title: 'DannaEdu AI - Error', user: req.session.user, imageUrl: null, error: err.message });
    }
};

// --- MODULE 3: Audio Transcription ---
exports.renderVoiceTool = (req, res) => {
    res.render('tools/voice', { title: 'DannaEdu AI - Voice Transcription', user: req.session.user, transcription: null, error: null });
};

exports.handleVoiceTool = async (req, res) => {
    try {
        if (!req.file) throw new Error("Please select a .wav audio file.");
        const { targetLanguage } = req.body;
        const user = req.session.user;
        const transcription = await metaService.transcribeAudio(req.file.path, targetLanguage);
        await logUserActivity(user.id, 'TRANSCRIBE_AUDIO', { language: targetLanguage });
        res.render('tools/voice', { title: 'DannaEdu AI - Transcription', user: req.session.user, transcription, error: null });
    } catch (err) {
        res.render('tools/voice', { title: 'DannaEdu AI - Error', user: req.session.user, transcription: null, error: err.message });
    }
};

// --- MODULE 4: Visual Segmentation ---
exports.renderSamTool = (req, res) => {
    res.render('tools/sam', { 
        title: 'DannaEdu AI - Image & Video Segmentation', 
        user: req.session.user, 
        segmentResult: null,
        sourceMediaBase64: null,
        mediaType: null,
        targetPrompt: null,
        error: null 
    });
};

exports.handleSamTool = async (req, res) => {
    try {
        if (!req.file) throw new Error("Please select an image or video to analyze.");
        const { targetPrompt } = req.body;
        const user = req.session.user;

        const mimeType = req.file.mimetype || 'image/png';
        const isVideo = mimeType.startsWith('video/');
        const mediaType = isVideo ? 'video' : 'image';

        const ext = path.extname(req.file.originalname).toLowerCase() || (isVideo ? '.mp4' : '.png');
        const newFilename = `${req.file.filename}${ext}`;
        const newFilePath = path.join(req.file.destination, newFilename);
        fs.renameSync(req.file.path, newFilePath);

        let sourceMediaUrl;
        if (isVideo) {
            sourceMediaUrl = `/uploads/${newFilename}`;
        } else {
            const mediaBuffer = fs.readFileSync(newFilePath);
            sourceMediaUrl = `data:${mimeType};base64,${mediaBuffer.toString('base64')}`;
        }

        const segmentResult = await metaService.segmentImageElements(newFilePath, targetPrompt, isVideo);
        await logUserActivity(user.id, 'SEGMENT_MEDIA', { prompt: targetPrompt, type: mediaType });

        if (!isVideo && fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath);
        }

        res.render('tools/sam', { 
            title: 'DannaEdu AI - Image & Video Segmentation', 
            user: req.session.user, 
            segmentResult, 
            sourceMediaBase64: sourceMediaUrl,
            mediaType,
            targetPrompt,
            error: null 
        });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.render('tools/sam', { 
            title: 'DannaEdu AI - Segmentation Error', 
            user: req.session.user, 
            segmentResult: null, 
            sourceMediaBase64: null,
            mediaType: null,
            targetPrompt: null,
            error: err.message 
        });
    }
};

// Render import form
exports.renderImportCourse = (req, res) => {
    res.render('tools/import-course', { 
        title: 'DannaEdu AI - Import Course', 
        user: req.session.user, 
        importedCourse: null,
        error: null 
    });
};

// Process dynamically imported file
exports.handleCourseImport = async (req, res) => {
    try {
        if (!req.file) throw new Error("Please provide a valid course file (.pdf, .docx, .txt, .json).");
        
        const filePath = req.file.path;
        const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
        let courseData = {
            title: req.body.title || req.file.originalname,
            description: req.body.description || "Dynamically imported course",
            target_language: req.body.target_language || req.session.user.language || 'Anglais',
            level: req.body.level || 'All levels',
            content: ''
        };

        // 1. Extraction based on file format
        if (fileExtension === 'pdf') {
            courseData.content = await new Promise((resolve, reject) => {
                const pdfParser = new PDFParser(this, 1);
                pdfParser.on("pdfParser_dataError", errData => reject(new Error(errData.parserError)));
                pdfParser.on("pdfParser_dataReady", () => {
                    resolve(pdfParser.getRawTextContent());
                });
                pdfParser.loadPDF(filePath);
            });
        } else if (fileExtension === 'docx' || fileExtension === 'doc') {
            const result = await mammoth.extractRawText({ path: filePath });
            courseData.content = result.value;
        } else if (fileExtension === 'json') {
            const rawJson = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(rawJson);
            courseData = { ...courseData, ...parsed };
        } else {
            // Default text format (.txt)
            courseData.content = fs.readFileSync(filePath, 'utf8');
        }

        // 2. Clean up temporary disk file
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        // 3. Save course dynamically in local JSON storage folder
        const storageDir = path.join(__dirname, '../content/dynamic-courses');
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
        
        const courseId = Date.now().toString();
        const savePath = path.join(storageDir, `${courseId}.json`);
        fs.writeFileSync(savePath, JSON.stringify({ id: courseId, ...courseData }, null, 2), 'utf8');

        // Record action in logs
        await logUserActivity(req.session.user.id, 'IMPORT_COURSE', { title: courseData.title, format: fileExtension });

        res.render('tools/import-course', { 
            title: 'DannaEdu AI - Course Imported', 
            user: req.session.user, 
            importedCourse: courseData,
            error: null 
        });

    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.render('tools/import-course', { 
            title: 'DannaEdu AI - Import Error', 
            user: req.session.user, 
            importedCourse: null,
            error: err.message 
        });
    }
};

// Render imported dynamic course detail
exports.renderDynamicCourseDetail = (req, res) => {
    try {
        const courseId = req.params.id;
        const filePath = path.join(__dirname, `../content/dynamic-courses/${courseId}.json`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).render('index', { 
                title: 'DannaEdu AI - Course Not Found', 
                error: "The requested course does not exist or has been deleted.",
                resultText: null, imageUrl: null, transcription: null, segmentResult: null
            });
        }

        const courseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        res.render('courses/detail-dynamic', {
            title: `DannaEdu AI - ${courseData.title}`,
            user: req.session.user,
            course: courseData,
            error: null
        });
    } catch (err) {
        console.error("Error reading dynamic course:", err.message);
        res.redirect('/dashboard');
    }
};

// Handle contextual chat for a dynamic course
exports.handleDynamicCourseChat = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userMessage = req.body.message;
        
        // 1. Retrieve client history if sent
        let clientHistory = [];
        try {
            if (req.body.history) {
                clientHistory = JSON.parse(req.body.history);
            }
        } catch (e) {
            clientHistory = [];
        }

        const filePath = path.join(__dirname, `../content/dynamic-courses/${courseId}.json`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Course not found." });
        }

        const courseData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // 2. Define conversationHistory with Danna AI persona and anti-Markdown constraint
        const conversationHistory = [
            { 
                role: 'system', 
                content: `You are Danna AI, a supportive educational tutor. Answer the student's questions relying EXCLUSIVELY on the following course content:\n\nTitle: ${courseData.title}\nContent: ${courseData.content}\n\nABSOLUTE RULE: Do NOT use ANY asterisks (*), double asterisks (**), or Markdown markup for bold or italic formatting.` 
            },
            ...(Array.isArray(clientHistory) ? clientHistory : [])
        ];

        // 3. Call AI service
        const aiResponse = await metaService.chatWithSpark(userMessage, conversationHistory);

        res.json({ reply: aiResponse });
    } catch (err) {
        console.error("Dynamic chat error:", err.message);
        res.status(500).json({ error: "Unable to generate a response." });
    }
};

// Delete an imported dynamic course
exports.deleteDynamicCourse = async (req, res) => {
    try {
        const courseId = req.params.id;
        const filePath = path.join(__dirname, `../content/dynamic-courses/${courseId}.json`);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);

            if (req.session.user) {
                await pool.query(
                    'INSERT INTO activity_logs (user_id, action, metadata) VALUES (?, ?, ?)',
                    [req.session.user.id, 'DELETE_DYNAMIC_COURSE', JSON.stringify({ courseId })]
                ).catch(() => {});
            }
        }

        res.redirect('/dashboard');
    } catch (err) {
        console.error("Error while deleting dynamic course:", err.message);
        res.redirect('/dashboard');
    }
};