const { getSessionUser, sendError, sendJson } = require("../_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    return sendJson(res, 200, { user: await getSessionUser(req) });
  } catch (error) {
    return sendError(res, error);
  }
};
