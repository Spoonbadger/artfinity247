// Upload limits shared by the upload APIs, the Studio upload form and the help center. Client-safe.

/** Largest image POST /api/uploads accepts. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Most images one upload queue takes (several files or a whole folder on /studio/art/new). */
export const QUEUE_MAX = 50;

/** New artworks an artist can publish per day (POST /api/artworks/upload). */
export const DAILY_UPLOAD_LIMIT = 50;

/** Images uploading at once while a queue fills. */
export const QUEUE_CONCURRENCY = 3;
