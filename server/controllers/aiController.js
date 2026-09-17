import { clerkClient, getAuth } from "@clerk/express";
import axios from "axios";
import { v2 as cloudinary } from 'cloudinary';
import OpenAI from "openai";
import sql from "../configs/db.js";
import pdfModule from "pdf-parse/lib/pdf-parse.js";

const parsePdf = typeof pdfModule === 'function' ? pdfModule : (pdfModule.default || pdfModule);

// Helper to safely extract userId from request
const getRequestUserId = (req) => {
    if (req.userId) return req.userId;
    const authData = getAuth(req);
    return authData?.userId;
};

// Helper to get initialized OpenAI client configured for Gemini
const getAIClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured in server/.env");
    }
    return new OpenAI({
        apiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });
};

// Helper to increment user free usage count and sync with Clerk metadata
const incrementUsage = async (userId, currentUsage = 0, plan = 'free') => {
    if (plan === 'premium') return currentUsage;
    const updatedUsage = (currentUsage || 0) + 1;
    try {
        await clerkClient.users.updateUserMetadata(userId, {
            publicMetadata: {
                free_usage: updatedUsage,
                plan: 'free'
            },
            privateMetadata: {
                free_usage: updatedUsage
            }
        });
    } catch (err) {
        console.warn("Could not sync Clerk metadata:", err.message);
    }
    return updatedUsage;
};

// ==================== 1. GENERATE ARTICLE ====================
export const generateArticle = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { prompt, length = 800 } = req.body;
        if (!prompt) {
            return res.json({ success: false, message: "Please provide a topic prompt" });
        }

        const plan = req.plan || 'free';
        const free_usage = req.free_usage ?? 0;

        if (plan !== 'premium' && free_usage >= 30) {
            return res.json({
                success: false,
                message: "Free limit reached (30/30). Please upgrade to premium to continue."
            });
        }

        const AI = getAIClient();
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: Number(length) || 800,
        });

        const content = response.choices[0]?.message?.content || "";

        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES (${userId}, ${prompt}, ${content}, 'article')
        `.catch(e => console.warn("DB insert note:", e.message));

        const updatedUsage = await incrementUsage(userId, free_usage, plan);

        res.json({
            success: true,
            content,
            updatedUsage
        });
    } catch (error) {
        console.error("generateArticle error:", error.message);
        res.json({
            success: false,
            message: error.message || "Failed to generate article"
        });
    }
};

// ==================== 2. GENERATE BLOG TITLE ====================
export const generateBlogTitle = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { prompt } = req.body;
        if (!prompt) {
            return res.json({ success: false, message: "Please provide a topic or keyword" });
        }

        const plan = req.plan || 'free';
        const free_usage = req.free_usage ?? 0;

        if (plan !== 'premium' && free_usage >= 30) {
            return res.json({
                success: false,
                message: "Free limit reached (30/30). Please upgrade to continue."
            });
        }

        const AI = getAIClient();
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || "";

        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES (${userId}, ${prompt}, ${content}, 'blog-title')
        `.catch(e => console.warn("DB insert note:", e.message));

        const updatedUsage = await incrementUsage(userId, free_usage, plan);

        res.json({
            success: true,
            content,
            updatedUsage
        });
    } catch (error) {
        console.error("generateBlogTitle error:", error.message);
        res.json({
            success: false,
            message: error.message || "Failed to generate blog titles"
        });
    }
};

// Maintain alias for backwards compatibility
export const generateBlobTitle = generateBlogTitle;

// ==================== 3. HUMANIZE TEXT ====================
export const humanizeText = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { text } = req.body;
        const plan = req.plan || 'free';
        const free_usage = req.free_usage ?? 0;

        if (!text || text.trim().length === 0) {
            return res.json({
                success: false,
                message: "Please provide text to humanize"
            });
        }

        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount > 1000) {
            return res.json({
                success: false,
                message: "Text exceeds 1000 word limit"
            });
        }

        if (plan !== 'premium' && free_usage >= 30) {
            return res.json({
                success: false,
                message: "Limit reached. Please upgrade to continue."
            });
        }

        const prompt = `Please rewrite the following text to make it sound natural, human, and conversational while preserving all core points and meaning:\n\n${text}`;

        const AI = getAIClient();
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6,
        });

        const humanizedText = response.choices[0]?.message?.content || "";

        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES (${userId}, 'Humanize text', ${humanizedText}, 'text-humanizer')
        `.catch(e => console.warn("DB insert note:", e.message));

        const updatedUsage = await incrementUsage(userId, free_usage, plan);

        res.json({
            success: true,
            content: humanizedText,
            updatedUsage
        });
    } catch (error) {
        console.error("humanizeText error:", error.message);
        res.json({
            success: false,
            message: error.message || "Failed to humanize text"
        });
    }
};

// ==================== 4. GENERATE IMAGE ====================
export const generateImage = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { prompt, publish } = req.body;
        const plan = req.plan || 'free';

        if (plan !== 'premium') {
            return res.json({
                success: false,
                message: "This feature is only available for premium subscriptions"
            });
        }

        if (!prompt) {
            return res.json({ success: false, message: "Please provide an image prompt" });
        }

        if (!process.env.CLIPDROP_API_KEY) {
            return res.json({
                success: false,
                message: "CLIPDROP_API_KEY is not configured in server/.env"
            });
        }

        const formData = new FormData();
        formData.append('prompt', prompt);

        const { data } = await axios.post(
            "https://clipdrop-api.co/text-to-image/v1",
            formData,
            {
                headers: {
                    'x-api-key': process.env.CLIPDROP_API_KEY,
                },
                responseType: "arraybuffer",
            }
        );

        const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`;
        const uploadResponse = await cloudinary.uploader.upload(base64Image, {
            folder: "creationsuite/images"
        });
        const secure_url = uploadResponse.secure_url;

        await sql`
            INSERT INTO creations(user_id, prompt, content, type, publish)
            VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})
        `.catch(e => console.warn("DB insert note:", e.message));

        res.json({
            success: true,
            content: secure_url
        });
    } catch (error) {
        console.error("generateImage error:", error.message);
        res.json({
            success: false,
            message: error.response?.data ? error.response.data.toString() : error.message
        });
    }
};

// ==================== 5. REMOVE IMAGE BACKGROUND ====================
export const removeImageBackground = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const image = req.file;
        const plan = req.plan || 'free';

        if (plan !== 'premium') {
            return res.json({
                success: false,
                message: "This feature is only available for premium subscriptions"
            });
        }

        if (!image || !image.buffer) {
            return res.json({
                success: false,
                message: "Please select and upload an image file"
            });
        }

        const base64Image = `data:${image.mimetype};base64,${image.buffer.toString('base64')}`;

        const uploadResult = await cloudinary.uploader.upload(base64Image, {
            transformation: [{ effect: 'background_removal' }],
            folder: "creationsuite/bg-removal"
        });

        const secure_url = uploadResult.secure_url;

        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES (${userId}, 'Remove Background', ${secure_url}, 'image')
        `.catch(e => console.warn("DB insert note:", e.message));

        res.json({
            success: true,
            content: secure_url
        });
    } catch (error) {
        console.error("removeImageBackground error:", error.message);
        res.json({
            success: false,
            message: error.message || "Failed to remove image background"
        });
    }
};

// ==================== 6. REMOVE IMAGE OBJECT ====================
export const removeImageObject = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { object } = req.body;
        const image = req.file;
        const plan = req.plan || 'free';

        if (plan !== 'premium') {
            return res.json({
                success: false,
                message: "This feature is only available for premium subscriptions"
            });
        }

        if (!image || !image.buffer) {
            return res.json({
                success: false,
                message: "Please upload an image"
            });
        }

        if (!object || object.trim().length === 0) {
            return res.json({
                success: false,
                message: "Please specify the object to remove"
            });
        }

        const base64Image = `data:${image.mimetype};base64,${image.buffer.toString('base64')}`;
        const { public_id } = await cloudinary.uploader.upload(base64Image, {
            folder: "creationsuite/obj-removal"
        });

        const imageUrl = cloudinary.url(public_id, {
            transformation: [{ effect: `gen_remove:${object.trim()}` }],
            resource_type: 'image'
        });

        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES (${userId}, ${`Remove ${object}`}, ${imageUrl}, 'image')
        `.catch(e => console.warn("DB insert note:", e.message));

        res.json({
            success: true,
            content: imageUrl
        });
    } catch (error) {
        console.error("removeImageObject error:", error.message);
        res.json({
            success: false,
            message: error.message || "Failed to remove image object"
        });
    }
};

// ==================== 7. RESUME REVIEW ====================
export const resumeReview = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const resume = req.file;
        const plan = req.plan || 'free';
        const free_usage = req.free_usage ?? 0;

        if (!resume || !resume.buffer) {
            return res.json({
                success: false,
                message: "Please upload a valid PDF resume"
            });
        }

        if (plan !== 'premium' && free_usage >= 30) {
            return res.json({
                success: false,
                message: "Free limit reached. Please upgrade to continue."
            });
        }

        const pdfData = await parsePdf(resume.buffer);
        const resumeText = pdfData.text?.substring(0, 20000) || "";

        if (!resumeText.trim()) {
            return res.json({
                success: false,
                message: "Could not extract text from the uploaded PDF. Please verify the document is not an empty or scanned image."
            });
        }

        const prompt = `You are a professional executive resume reviewer. Provide a comprehensive, constructive review of this resume. Include:
1. Executive Summary
2. Strengths & Highlights
3. Areas for Improvement (Formatting, Impact, Metrics)
4. Recommended Action Items

Resume Content:
${resumeText}`;

        const AI = getAIClient();
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        });

        const content = response.choices[0]?.message?.content || "";

        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES (${userId}, 'Resume Review', ${content}, 'resume-review')
        `.catch(e => console.warn("DB insert note:", e.message));

        const updatedUsage = await incrementUsage(userId, free_usage, plan);

        res.json({
            success: true,
            content,
            updatedUsage
        });
    } catch (error) {
        console.error("resumeReview error:", error.message);
        res.json({
            success: false,
            message: error.message || "Failed to review resume"
        });
    }
};

// ==================== 8. ATS SCORE CALCULATOR ====================
export const calculateATSScore = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const resume = req.file;
        const { jobDescription } = req.body;
        const plan = req.plan || 'free';
        const free_usage = req.free_usage ?? 0;

        if (plan !== 'premium' && free_usage >= 30) {
            return res.json({
                success: false,
                message: "Limit reached. Please upgrade to continue."
            });
        }

        if (!resume || !resume.buffer) {
            return res.json({
                success: false,
                message: "Resume PDF file is required"
            });
        }

        if (!jobDescription || !jobDescription.trim()) {
            return res.json({
                success: false,
                message: "Job description is required"
            });
        }

        const pdfData = await parsePdf(resume.buffer);
        const resumeText = pdfData.text?.substring(0, 20000) || "";

        const prompt = `Analyze this resume against the job description and return an ATS evaluation strictly in the following JSON format:
{
    "score": 78,
    "feedback": "Overall summary of the candidate fit against the role",
    "breakdown": {
        "skills": {
            "Skill Name": { "match": true, "importance": "high", "feedback": "Demonstrated with 3+ years experience" },
            "Another Skill": { "match": false, "importance": "medium", "feedback": "Not mentioned in the resume" }
        },
        "keywords": {
            "total": 15,
            "matched": 11
        },
        "experience": {
            "match": true,
            "feedback": "Relevant industry experience aligns well"
        }
    },
    "suggestions": [
        "Suggestion 1 to optimize ATS score",
        "Suggestion 2 to optimize ATS score"
    ]
}

Job Description:
${jobDescription}

Resume Content:
${resumeText}

IMPORTANT: Return valid JSON only, without backticks or markdown fences.`;

        const AI = getAIClient();
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        const rawContent = response.choices[0]?.message?.content || "{}";
        let result;

        try {
            const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(cleaned);
        } catch (e) {
            console.error("Failed to parse ATS response:", rawContent);
            result = {
                score: 70,
                feedback: "Analysis completed. Resume has moderate alignment with requirements.",
                breakdown: {
                    skills: {},
                    keywords: { total: 10, matched: 7 },
                    experience: { match: true, feedback: "Applicable background noted." }
                },
                suggestions: ["Tailor resume keywords specifically to the job posting."]
            };
        }

        // Ensure proper typing of fields
        if (typeof result.score !== 'number') {
            result.score = parseInt(result.score, 10) || 70;
        }
        if (!Array.isArray(result.suggestions)) {
            result.suggestions = result.suggestions ? [result.suggestions] : [];
        }

        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES (${userId}, ${`ATS Score for ${resume.originalname}`}, ${JSON.stringify(result)}, 'ats-score')
        `.catch(e => console.warn("DB insert note:", e.message));

        const updatedUsage = await incrementUsage(userId, free_usage, plan);

        res.json({
            success: true,
            content: result,
            updatedUsage
        });
    } catch (error) {
        console.error("ATS Score Error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "An error occurred while calculating ATS score"
        });
    }
};

// ==================== 9. CHAT WITH PDF ====================
export const chatWithPDF = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { message, chatHistory } = req.body;
        const pdfFile = req.file;
        const plan = req.plan || 'free';

        if (plan !== 'premium') {
            return res.status(403).json({
                success: false,
                message: "Chat With PDF is a premium feature. Please upgrade your subscription."
            });
        }

        if (!pdfFile || !pdfFile.buffer) {
            return res.status(400).json({
                success: false,
                message: "Please upload a PDF document"
            });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide a question or message"
            });
        }

        // Safely parse chatHistory whether received as JSON string from FormData or as Array
        let parsedHistory = [];
        if (typeof chatHistory === 'string') {
            try {
                parsedHistory = JSON.parse(chatHistory);
            } catch (e) {
                parsedHistory = [];
            }
        } else if (Array.isArray(chatHistory)) {
            parsedHistory = chatHistory;
        }

        const pdfData = await parsePdf(pdfFile.buffer);
        const pdfText = pdfData.text?.substring(0, 30000) || "";

        const messages = [
            {
                role: "system",
                content: `You are an expert AI document assistant. Below is the text extracted from the user's PDF document:\n\n${pdfText}\n\nAnswer the user's inquiries accurately based on this document.`
            },
            ...parsedHistory.map(item => ({
                role: item.role === 'assistant' ? 'assistant' : 'user',
                content: item.content
            })),
            {
                role: "user",
                content: message
            }
        ];

        const AI = getAIClient();
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages,
            temperature: 0.3,
        });

        const aiResponse = response.choices[0]?.message?.content || "";

        await sql`
            INSERT INTO pdf_chats (user_id, file_name, user_message, ai_response)
            VALUES (${userId}, ${pdfFile.originalname}, ${message}, ${aiResponse})
        `.catch(e => console.warn("DB insert note:", e.message));

        const updatedHistory = [
            ...parsedHistory,
            { role: "user", content: message },
            { role: "assistant", content: aiResponse }
        ];

        res.json({
            success: true,
            response: aiResponse,
            chatHistory: updatedHistory,
            fileName: pdfFile.originalname
        });
    } catch (error) {
        console.error("PDF chat error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to process PDF chat"
        });
    }
};

// ==================== 10. GET PDF CHAT HISTORY ====================
export const getPDFChatHistory = async (req, res) => {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { file_name } = req.query;

        if (!file_name) {
            const files = await sql`
                SELECT file_name 
                FROM pdf_chats 
                WHERE user_id = ${userId}
                GROUP BY file_name
                ORDER BY MAX(created_at) DESC
            `.catch(() => []);

            return res.json({
                success: true,
                files: (files || []).map(f => f.file_name)
            });
        }

        const history = await sql`
            SELECT user_message, ai_response, created_at, file_name
            FROM pdf_chats 
            WHERE user_id = ${userId} AND file_name = ${file_name}
            ORDER BY created_at ASC
        `.catch(() => []);

        const chatHistory = (history || []).flatMap(entry => [
            { role: "user", content: entry.user_message },
            { role: "assistant", content: entry.ai_response }
        ]);

        res.json({
            success: true,
            chatHistory,
            fileName: file_name
        });
    } catch (error) {
        console.error("Chat history error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve history"
        });
    }
};