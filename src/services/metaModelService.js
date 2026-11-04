const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('../config/db');
const { parseSamResponseOutput } = require('../utils/samMaskParser');
const path = require('path');

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const API_URL = process.env.META_API_BASE_URL || 'https://api.meta.ai/v1';
const HEADERS = {
    'Authorization': `Bearer ${process.env.META_API_KEY}`
};

class MetaModelService {
    
    // Utility function to generate a SHA-256 hash of the source text
    generateTextHash(text) {
        return crypto.createHash('sha256').update(text.trim()).digest('hex');
    }

    // 1. Content Adaptation with Intelligent MySQL Cache
    async adaptContent(content, targetLanguage, targetLevel) {
        try {
            const textHash = this.generateTextHash(content);

            // Step A: Check if translation already exists in MySQL cache
            const [cachedRows] = await pool.query(
                'SELECT translated_text FROM translations WHERE source_text_hash = ? AND target_language = ?',
                [textHash, targetLanguage]
            );

            if (cachedRows.length > 0) {
                console.log('⚡ [Cache Hit] Translation retrieved from MySQL database.');
                return cachedRows[0].translated_text;
            }

            console.log('🌐 [Cache Miss] Calling Baseten API...');
            const prompt = `You are an instructional design expert for DannaEdu AI. Rewrite, translate, and adapt the content below.
- Target language mandatory: 
${targetLanguage}
- Target level: 
${targetLevel}
Original content: """${content}"""`;

            const basetenUrl = process.env.BASETEN_API_URL || 'https://inference.baseten.co/v1';
            const basetenApiKey = process.env.BASETEN_API_KEY;

            const response = await axios.post(`${basetenUrl}/chat/completions`, {
                model: "meta-models/muse-spark-open-1026",
                messages: [
                    { 
                        role: "system", 
                        content: "You are an elite multilingual virtual professor specialized in educational inclusion.\n\nABSOLUTE RULE: Do NOT use ANY asterisks (*), double asterisks (**), or Markdown markup for bold or italic formatting in your final text. Write exclusively in structured plain text with line breaks." 
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${basetenApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const translatedText = response.data.choices[0].message.content;

            // Step B: Save new translation in MySQL cache
            await pool.query(
                'INSERT INTO translations (source_text_hash, target_language, translated_text) VALUES (?, ?, ?)',
                [textHash, targetLanguage, translatedText]
            );

            return translatedText;
        } catch (error) {
            console.error("Baseten Translation & Cache Error:", error.response?.data || error.message);
            throw new Error("Failed to adapt content via Baseten.");
        }
    }

    // 2. Course Illustration Generation
    async generateCourseImage(promptDescription) {
        try {
            const response = await axios.post(`${API_URL}/images/generations`, {
                model: "muse-image-1.0",
                prompt: `Educational clean minimalist illustration, vector flat style: ${promptDescription}`,
                n: 1,
                size: "1024x1024"
            }, { headers: { ...HEADERS, 'Content-Type': 'application/json' } });

            const imgData = response.data.data[0];
            if (imgData.url) return imgData.url;
            if (imgData.b64_json) return `data:image/png;base64,${imgData.b64_json}`;
            
            throw new Error("Unrecognized image format.");
        } catch (error) {
            console.error("Illustration Generation Error:", error.response?.data || error.message);
            throw new Error("Unable to generate educational illustration.");
        }
    }

    // 2.bis Illustration Editing / Modification (/v1/images/edits)
    async editCourseImage(imageFilePath, promptDescription) {
        try {
            const form = new FormData();
            form.append('model', 'muse-image-1.0');
            form.append('image', fs.createReadStream(imageFilePath));
            form.append('prompt', promptDescription);
            form.append('n', '1');
            form.append('size', '1024x1024');

            const response = await axios.post(`${API_URL}/images/edits`, form, {
                headers: {
                    ...form.getHeaders(),
                    ...HEADERS
                }
            });

            if (fs.existsSync(imageFilePath)) fs.unlinkSync(imageFilePath);

            const imgData = response.data.data[0];
            if (imgData.url) return imgData.url;
            if (imgData.b64_json) return `data:image/png;base64,${imgData.b64_json}`;
            
            throw new Error("Unrecognized edited image format.");
        } catch (error) {
            if (fs.existsSync(imageFilePath)) fs.unlinkSync(imageFilePath);
            console.error("Illustration Edit Error:", error.response?.data || error.message);
            throw new Error("Unable to modify educational illustration.");
        }
    }

    // 3. Audio Transcription & Multimodal Analysis
    async transcribeAudio(audioFilePath, targetLanguage = 'English') {
        try {
            if (!fs.existsSync(audioFilePath)) {
                throw new Error("Audio file not found on disk.");
            }

            // 1. Dynamic MIME type detection
            const fileExtension = audioFilePath.split('.').pop().toLowerCase();
            const mimeType = fileExtension === 'mp3' ? 'audio/mpeg' : 'audio/wav';

            // 2. Read local audio file and convert to Base64 data-URL
            const audioBuffer = fs.readFileSync(audioFilePath);
            const audioBase64 = `data:${mimeType};base64,${audioBuffer.toString('base64')}`;

            // 3. Construct anti-asterisks prompt
            const promptText = `Transcribe this entire audio recording into ${targetLanguage}. If multiple speakers are present, indicate speaker turns (diarization). Provide clean, structured text ready for educational use.`;

            console.log(`📡 [Baseten Audio] Sending audio (${fileExtension.toUpperCase()}) for transcription...`);

            const basetenUrl = process.env.BASETEN_API_URL || 'https://inference.baseten.co/v1';
            const basetenApiKey = process.env.BASETEN_API_KEY;

            const response = await axios.post(`${basetenUrl}/chat/completions`, {
                model: "meta-models/muse-spark-open-1026",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert educational audio transcription and analysis assistant.\n\nABSOLUTE RULE: Do NOT use ANY asterisks (*), double asterisks (**), or Markdown markup for bold or italic formatting in your final text. Write exclusively in structured plain text with line breaks."
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: promptText },
                            {
                                type: "audio_url",
                                audio_url: { url: audioBase64 }
                            }
                        ]
                    }
                ],
                temperature: 0.2,
                max_tokens: 2048
            }, {
                headers: {
                    'Authorization': `Bearer ${basetenApiKey}`,
                    'Content-Type': 'application/json'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            // Clean up local temporary file
            if (fs.existsSync(audioFilePath)) {
                fs.unlinkSync(audioFilePath);
            }

            const transcriptionResult = response.data.choices?.[0]?.message?.content;
            if (!transcriptionResult) {
                throw new Error("Empty response received from Baseten inference.");
            }

            console.log(`✅ [Baseten Audio] Transcription successful.`);
            return transcriptionResult;

        } catch (error) {
            if (fs.existsSync(audioFilePath)) {
                fs.unlinkSync(audioFilePath);
            }
            console.error("❌ Baseten Audio Transcription Error:", error.response?.data || error.message);
            throw new Error(
                error.response?.data?.error?.message || 
                "Audio transcription failed via Baseten. Check file size and API key."
            );
        }
    }

    // 4. Image & Video Visual Segmentation
    async segmentImageElements(mediaFilePath, targetPrompt, isVideo = false) {
        try {
            const baseUrl = API_URL.replace(/\/+$/, '');
            const endpointRoot = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;

            // Quick concept mapping for common terms
            const conceptMapping = {
                'heart': 'heart', 'cell': 'cell', 'nucleus': 'nucleus', 'mitochondria': 'mitochondria',
                'brain': 'brain', 'lung': 'lung', 'lungs': 'lungs',
                'bone': 'bone', 'skeleton': 'skeleton', 'skull': 'skull',
                'person': 'person', 'face': 'face', 'hand': 'hand', 'eye': 'eye',
                'car': 'car', 'bus': 'bus', 'bicycle': 'bicycle',
                'dog': 'dog', 'cat': 'cat', 'bird': 'bird', 'plant': 'plant', 'leaf': 'leaf', 'flower': 'flower',
                'book': 'book', 'table': 'table', 'chair': 'chair', 'laptop': 'laptop', 'text': 'text', 'arrow': 'arrow',
                'ball': 'ball'
            };

            let cleanPrompt = (targetPrompt || '').trim().toLowerCase()
                .replace(/^(the |a |an |segment |find |target )/i, '')
                .replace(/[.!?]+$/, '')
                .trim();

            const finalConcept = conceptMapping[cleanPrompt] || cleanPrompt;
            const mediaContentType = isVideo ? "input_video" : "input_image";

            console.log(`🎯 [Segmentation] Media: ${mediaContentType} | Concept sent: "${finalConcept}"`);

            // Step 1: Upload file to POST /v1/files
            const fileForm = new FormData();
            fileForm.append('file', fs.createReadStream(mediaFilePath));
            fileForm.append('purpose', 'user_data');

            const uploadResponse = await axios.post(`${endpointRoot}/files`, fileForm, {
                headers: {
                    ...fileForm.getHeaders(),
                    ...HEADERS
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            const fileId = uploadResponse.data.id || uploadResponse.data.file_id;
            if (!fileId) {
                throw new Error(`File ID not found: ${JSON.stringify(uploadResponse.data)}`);
            }

            // Step 2: Call segmentation on POST /v1/responses
            const response = await axios.post(`${endpointRoot}/responses`, {
                model: "sam-3.1",
                input: [
                    {
                        type: "message",
                        role: "user",
                        content: [
                            { type: "input_text", text: finalConcept },
                            { type: mediaContentType, file_id: fileId }
                        ]
                    }
                ],
                metadata: {
                    mask_encoding: "one_bit"
                }
            }, {
                headers: {
                    ...HEADERS,
                    "Content-Type": "application/json"
                }
            });

            if (!isVideo && fs.existsSync(mediaFilePath)) {
                fs.unlinkSync(mediaFilePath);
            }

            const resultData = response.data.output || response.data.data || response.data;
            const parsedFrames = parseSamResponseOutput(resultData);

            return JSON.stringify({
                raw: resultData,
                parsedFrames
            }, null, 2);

        } catch (error) {
            if (fs.existsSync(mediaFilePath)) fs.unlinkSync(mediaFilePath);
            console.error("❌ Segmentation Error:", error.response?.data || error.message);
            throw new Error(
                error.response?.data?.error?.message || 
                `Segmentation failed (HTTP ${error.response?.status || 'Network error'})`
            );
        }
    }

    // 5. Educational Chat Assistant (Danna AI)
    async chatWithSpark(userMessage, conversationHistory = [], imageFilePath = null) {
        try {
            let userContent = userMessage;

            if (imageFilePath && fs.existsSync(imageFilePath)) {
                const imageBuffer = fs.readFileSync(imageFilePath);
                const mimeType = 'image/jpeg';
                const imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

                userContent = [
                    { type: "text", text: userMessage },
                    { 
                        type: "image_url", 
                        image_url: { 
                            url: imageBase64,
                            detail: "auto"
                        } 
                    }
                ];

                fs.unlinkSync(imageFilePath);
            }

            const messages = [
                { role: "system", content: "You are Danna AI, the friendly virtual educational assistant of DannaEdu AI. You help students understand their courses clearly and concisely, tailored to their level, while analyzing provided images when necessary." },
                ...conversationHistory,
                { role: "user", content: userContent }
            ];

            const basetenUrl = process.env.BASETEN_API_URL || 'https://inference.baseten.co/v1';
            const basetenApiKey = process.env.BASETEN_API_KEY;

            const response = await axios.post(`${basetenUrl}/chat/completions`, {
                model: "meta-models/muse-spark-open-1026",
                messages: messages,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${basetenApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            if (imageFilePath && fs.existsSync(imageFilePath)) fs.unlinkSync(imageFilePath);
            console.error("Danna AI Multimodal Error:", error.response?.data || error.message);
            throw new Error("Failed to receive response from Danna AI assistant.");
        }
    }

    // 6. Adaptive Quiz Evaluation
    async evaluateQuizAnswer(question, userAnswer, correctAnswer, userLevel) {
        try {
            const prompt = `As an educational expert, evaluate the student's answer.
- Student level: 
${userLevel}
- Question: "
${question}"
- Student answer: "
${userAnswer}"
- Expected answer: "
${correctAnswer}"
            Indicate if it is correct, provide a short and supportive explanation adapted to the level.`;
    
            const basetenUrl = process.env.BASETEN_API_URL || 'https://inference.baseten.co/v1';
            const basetenApiKey = process.env.BASETEN_API_KEY;

            const response = await axios.post(`${basetenUrl}/chat/completions`, {
                model: "meta-models/muse-spark-open-1026",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3
            }, {
                headers: {
                    'Authorization': `Bearer ${basetenApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
    
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error("Quiz Evaluation Error:", error.response?.data || error.message);
            throw new Error("Failed to evaluate quiz via Baseten.");
        }
    }
}

module.exports = new MetaModelService();