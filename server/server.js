import express from "express";
import cors from "cors";
import "dotenv/config";
import { clerkMiddleware } from '@clerk/express';
import aiRouter from "./routes/aiRoutes.js";
import connectCloudinary from "./configs/cloudinary.js";
import userRouter from "./routes/userRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Cloudinary
connectCloudinary().catch(err => console.warn("Cloudinary initialization note:", err.message));

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(clerkMiddleware());

app.get('/', (req, res) => {
    res.json({
        name: "CreationSuite.ai API",
        status: "active",
        timestamp: new Date().toISOString()
    });
});

app.use('/api/ai', aiRouter);
app.use('/api/user', userRouter);

// Global 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: "API endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error"
    });
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

export default app;