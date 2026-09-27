import { getUser, getProfile, isAdmin, ADMIN_EMAILS, json, fail } from "./_lib/common.mjs";

export default async (req) => {
  const user = await getUser(req);
  if (!user) return fail("Please log in.", 401);
  const profile = await getProfile(user.uid);
  return json({
    email: user.email,
    profile: profile && {
      status: profile.status, fullName: profile.fullName, clinic: profile.clinic, phone: profile.phone,
      qualification: profile.qualification, memberNo: profile.memberNo, address: profile.address,
      note: profile.status === "rejected" ? profile.note : undefined,
    },
    isAdmin: isAdmin(user),
    adminNeedsVerification: ADMIN_EMAILS.includes(user.email) && !user.emailVerified,
  });
};

export const config = { path: "/api/me" };
