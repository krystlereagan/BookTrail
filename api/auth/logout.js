const { clearSessionCookie, deleteSession, getCookie, sendError, sendJson } = require("../_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    await deleteSession(getCookie(req, "bt_session"));
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendError(res, error);
  }
};
