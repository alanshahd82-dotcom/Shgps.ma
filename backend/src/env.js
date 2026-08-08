// Must be the first import in index.js so dotenv populates process.env
// before any other module (e.g. config.js) reads it at import-time.
import dotenv from 'dotenv'
dotenv.config()
