// Switches for features Artfinity can't offer yet. The code stays in place; flip a switch to true to bring one back.

/**
 * Painting scans: we scan an artist's originals so they can sell bigger prints (app/studio/scanning, /scanning,
 * admin/scanning). Off: hidden from every menu, page and prompt, its pages show "not found" and its APIs refuse.
 */
export const PAINTING_SCANS = false;

/**
 * QR code end dates: the "Code stops working" setting in QR codes and My codes. Off: the setting is hidden,
 * new codes never get an end date, and an end date already stored on a code is ignored, so every code that
 * isn't paused keeps working. On: all of it comes back as it was (help articles would need the end-date lines again).
 */
export const QR_END_DATES = false;
