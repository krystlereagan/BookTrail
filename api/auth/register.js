const {
  clean,
  createAuthToken,
  createSession,
  getBaseUrl,
  getUserByEmail,
  hashPassword,
  saveUser,
  sendEmail,
  sendError,
  sendJson,
  setSessionCookie,
  userCount,
  validateRequired,
} = require("../_store");
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const input = req.body || {};
    validateRequired(input.name, "Name");
    validateRequired(input.email, "Email");
    validateRequired(input.password, "Password");
    if (String(input.password).length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });

    const email = clean(input.email, 180).toLowerCase();
    if (await getUserByEmail(email)) return sendJson(res, 409, { error: "An account already exists for that email." });

    const count = await userCount();
    const requestedRole = clean(input.role, 20);
    let role = count === 0 ? "admin" : "user";
    if (requestedRole === "steward" && input.inviteCode === process.env.STEWARD_INVITE_CODE) role = "steward";
    if (requestedRole === "admin" && input.inviteCode === process.env.ADMIN_INVITE_CODE) role = "admin";

    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email,
      name: clean(input.name, 120),
      role,
      libraryName: clean(input.libraryName, 160),
      emailVerified: false,
      passwordHash: hashPassword(input.password),
      createdAt: now,
    };

    const publicUser = await saveUser(user);
    const token = await createAuthToken(user, "verify-email");
    const verificationUrl = `${getBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`;
    const emailSent = await sendEmail({
      to: user.email,
      subject: "Verify your BookTrail email",
      html: `<p>Welcome to BookTrail. Verify your email here:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
    });
    setSessionCookie(res, await createSession(user));
    return sendJson(res, 201, { user: publicUser, emailSent, verificationUrl: emailSent ? undefined : verificationUrl });
  } catch (error) {
    return sendError(res, error);
  }
};
