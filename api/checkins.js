const crypto = require("crypto");
const { clean, getBook, saveBook, sendError, sendJson, validateRequired } = require("./_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const input = req.body || {};
    const code = clean(input.code, 32).toUpperCase();
    validateRequired(code, "Tracking code");
    validateRequired(input.place, "Location");

    const book = await getBook(code);
    if (!book) return sendJson(res, 404, { error: "No book was found for that code." });

    book.stops.unshift({
      id: crypto.randomBytes(6).toString("hex"),
      place: clean(input.place, 160),
      library: clean(input.place, 160),
      reader: clean(input.reader, 80) || "A reader",
      note: clean(input.note, 1000),
      hidden: false,
      date: new Date().toISOString(),
    });

    await saveBook(book);
    return sendJson(res, 200, book);
  } catch (error) {
    return sendError(res, error);
  }
};
