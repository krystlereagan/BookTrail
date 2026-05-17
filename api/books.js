const {
  clean,
  createCode,
  getBook,
  getSessionUser,
  listBooks,
  requireUser,
  saveBook,
  sendError,
  sendJson,
  validateRequired,
} = require("./_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const viewer = await getSessionUser(req);
      const canModerate = ["steward", "admin"].includes(viewer?.role);
      const code = clean(req.query.code, 32).toUpperCase();
      if (code) {
        const book = await getBook(code);
        if (!book) return sendJson(res, 404, { error: "No book was found for that code." });
        return sendJson(res, 200, visibleBook(book, canModerate));
      }

      return sendJson(res, 200, (await listBooks()).map((book) => visibleBook(book, canModerate)));
    }

    if (req.method === "POST") {
      const user = await requireUser(req);
      if (!user.emailVerified) return sendJson(res, 403, { error: "Please verify your email before registering books." });
      const input = req.body || {};
      validateRequired(input.title, "Title");
      validateRequired(input.author, "Author");
      validateRequired(input.library, "Starting library");
      validateRequired(input.place, "City or neighborhood");

      let code = createCode();
      for (let attempt = 0; attempt < 8 && (await getBook(code)); attempt += 1) {
        code = createCode();
      }

      if (await getBook(code)) {
        return sendJson(res, 500, { error: "Could not create a unique tracking code. Please try again." });
      }

      const now = new Date().toISOString();
      const book = {
        code,
        title: clean(input.title, 160),
        author: clean(input.author, 160),
        note: clean(input.note, 1000),
        ownerId: user.id,
        ownerName: user.name,
        ownerRole: user.role,
        createdAt: now,
        stops: [
          {
            place: clean(input.place, 160),
            library: clean(input.library, 160),
            reader: "Registered",
            note: "The journey starts here.",
            date: now,
          },
        ],
      };

      await saveBook(book);
      return sendJson(res, 201, book);
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendError(res, error);
  }
};

function visibleBook(book, canModerate) {
  if (canModerate) return book;
  return {
    ...book,
    stops: book.stops.filter((stop) => !stop.hidden),
  };
}
