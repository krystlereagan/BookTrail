const { clean, getBook, requireRole, saveBook, sendError, sendJson, validateRequired } = require("../_store");

module.exports = async function handler(req, res) {
  try {
    await requireRole(req, ["steward", "admin"]);

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "PATCH");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const input = req.body || {};
    const code = clean(input.code, 32).toUpperCase();
    validateRequired(code, "Tracking code");
    validateRequired(input.stopId, "Stop id");
    const book = await getBook(code);
    if (!book) return sendJson(res, 404, { error: "No book was found for that code." });

    const stop = book.stops.find((item) => item.id === input.stopId);
    if (!stop) return sendJson(res, 404, { error: "Stop not found." });
    stop.hidden = Boolean(input.hidden);

    await saveBook(book);
    return sendJson(res, 200, book);
  } catch (error) {
    return sendError(res, error);
  }
};
