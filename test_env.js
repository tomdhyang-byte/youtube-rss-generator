require('dotenv').config();

console.log("Checking environment variables...");
if (process.env.AUTH_PASSWORD) {
    console.log("✅ AUTH_PASSWORD is set to:", process.env.AUTH_PASSWORD);
} else {
    console.log("❌ AUTH_PASSWORD is NOT set.");
}
