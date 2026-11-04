🌍 DannaEdu AI – Multilingual & Inclusive Educational Platform

DannaEdu AI is a next-generation multilingual educational platform designed to break language barriers, adapt content to any learning level, and provide advanced AI-powered tools for students and educators.

🚀 Key Features

- 🌐 24/7 Multilingual Support: Fully localized in **25 major languages**, enabling accessible learning worldwide.
- 📖 Intelligent Content Adaptation (Baseten - Muse Spark Open): Automatically rewrites, translates, and tailors text or imported documents (PDF, Word, TXT) to the exact proficiency level of the learner (Beginner, Intermediate, Professional).
- 🤖 Personal AI Tutor (Danna AI): A supportive 24/7 virtual tutor that answers questions, analyzes attached images, and provides guidance entirely in plain text (strict anti-Markdown formatting for smooth interaction).
- 🎨 Image Generation and Editing (Muse Image): Instantly creates clean, minimalist vector educational illustrations from text descriptions or modifies existing source images via specialized endpoints (`/v1/images/edits`) with real-time zoom, preview, and download capabilities.
- 🔍 Advanced Visual & Video Segmentation (SAM 3.1): Target and isolate elements down to the pixel on images or videos (e.g., biological cells, anatomical organs, mechanical parts) and extract transparent RLE silhouettes instantly.
- 🎙️ Voice Transcription & Speaker Diarization (Baseten - Muse Spark Open) : Converts course audio recordings (.wav, .mp3) into structured notes with speaker distinction and text-to-speech audio playback.
- 📂 Dynamic Course Importers: Import and manage custom educational materials with instant JSON storage and secure MySQL persistence.

🛠️ Tech Stack

- Backend: Node.js, Express.js, EJS (Embedded JavaScript templates)
- Database: MySQL (with intelligent translation caching and secure user progress tracking)
- AI & Multimodal Services: Baseten Inference API, Meta Models (Muse Spark Open, Muse Image & SAM 3.1)
- Styling: Tailwind CSS (Modern, responsive, and clean UI)
- File Processing: PDFParser, Mammoth (.docx), Multer (uploads management)

📦 Project Structure

text
dannaedu-ai/
├── content/
│   └── dynamic-courses/     # Dynamically imported course JSON files
├── public/
│   ├── uploads/             # Temporary folder for media, documents & audio
│   └── ...                  # Public static assets
├── src/
│   ├── config/              # Database connection pool
│   ├── controllers/         # Core business logic (auth, courses, quiz, tools)
│   ├── routes/              # Express routing definitions
│   ├── utils/               # Audio helpers & RLE mask decoders
│   └── views/               # EJS templates (dashboard, tools, lessons, chat)
├── .env                     # Environment variables (private)
├── server.js                # Main application entry point
└── package.json             # Project dependencies and scripts

⚙️ Getting Started

Prerequisites
Node.js (v18+ recommended)
MySQL Database server

Installation & Setup
1. Clone the repository:
   git clone [https://github.com/norvantchuente/DannaEdu-AI.git](https://github.com/norvantchuente/DannaEdu-AI.git)
   cd dannaedu-ai

2. Install dependencies:
   npm install

3. Configure environment variables:
   Create a .env file at the root of the project and set your configuration:
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=dannaedu_db
   BASETEN_API_KEY=your_baseten_api_key
   BASETEN_API_URL=[https://inference.baseten.co/v1](https://inference.baseten.co/v1)
   META_API_KEY=your_meta_api_key

4. Run the application:
   # Development mode with nodemon
   npm run dev

   # Production mode
   node server.js

5. Open in browser:
   Navigate to http://localhost:5000


🔒 Security & Privacy

- Automated cleanup routines purge temporary upload files older than 24 hours to protect user privacy.

- Secure session management and password hashing using bcryptjs.

📄 License
Distributed under the MIT License. See LICENSE for more information.
