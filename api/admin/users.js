const { clean, getUserById, listUsers, requireRole, saveUser, sendError, sendJson } = require("../_store");

module.exports = async function handler(req, res) {
  try {
    await requireRole(req, ["admin"]);

    if (req.method === "GET") {
      return sendJson(res, 200, { users: await listUsers() });
    }

    if (req.method === "PATCH") {
      const input = req.body || {};
      const user = await getUserById(clean(input.id, 80));
      if (!user) return sendJson(res, 404, { error: "User not found." });
      if (!["user", "steward", "admin"].includes(input.role)) return sendJson(res, 400, { error: "Role is invalid." });
      user.role = input.role;
      return sendJson(res, 200, { user: await saveUser(user) });
    }

    res.setHeader("Allow", "GET, PATCH");
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendError(res, error);
  }
};
