import { pgEnum } from "drizzle-orm/pg-core";

export const accountType = pgEnum("account_type", ["member", "escort", "club"]);
export const userRole = pgEnum("user_role", ["user", "moderator", "admin"]);
export const userStatus = pgEnum("user_status", ["pending", "active", "suspended", "deleted"]);
export const kycStatus = pgEnum("kyc_status", ["none", "pending", "verified", "rejected"]);
export const clubType = pgEnum("club_type", ["club", "studio", "laufhaus", "kontaktbar", "saunaclub", "nachtclub"]);
export const gender = pgEnum("gender", ["frau", "trans", "mann", "divers"]);
export const breastType = pgEnum("breast_type", ["natuerlich", "operiert"]);
export const intimateStyle = pgEnum("intimate_style", ["rasiert", "teilrasiert", "natuerlich"]);
export const tattooLevel = pgEnum("tattoo_level", ["keine", "wenige", "viele"]);
export const workplace = pgEnum("workplace", ["incall", "outcall", "both"]);
export const connectRule = pgEnum("connect_rule", ["all", "verified", "with_review", "followers"]);
export const mediaKind = pgEnum("media_kind", ["image", "video", "audio", "file"]);
export const mediaPurpose = pgEnum("media_purpose", ["gallery", "avatar", "cover", "logo", "post", "message", "story", "comment", "group"]);
export const mediaStatus = pgEnum("media_status", ["processing", "ready", "rejected"]);
export const messageType = pgEnum("message_type", ["text", "media", "booking_card", "system"]);
export const contentContext = pgEnum("content_context", ["feed", "group", "forum"]);
export const postVisibility = pgEnum("post_visibility", ["public", "followers", "members"]);
export const reactionKind = pgEnum("reaction_kind", ["like", "love", "fire", "laugh", "wow", "sad"]);
export const reactionTarget = pgEnum("reaction_target", ["post", "comment", "story", "message"]);
export const groupPrivacy = pgEnum("group_privacy", ["public", "private", "secret"]);
export const groupRole = pgEnum("group_role", ["owner", "admin", "moderator", "member"]);
export const groupMemberStatus = pgEnum("group_member_status", ["active", "pending", "invited", "banned"]);
export const scheduledType = pgEnum("scheduled_type", ["story", "location", "broadcast"]);
export const scheduledStatus = pgEnum("scheduled_status", ["scheduled", "running", "done", "failed", "cancelled"]);
export const bookingStatus = pgEnum("booking_status", [
  "requested",
  "countered",
  "confirmed",
  "declined",
  "cancelled",
  "completed",
  "no_show",
  "expired",
]);
export const meetingType = pgEnum("meeting_type", ["incall", "outcall"]);
export const linkStatus = pgEnum("link_status", ["pending", "accepted", "rejected"]);
export const flagTarget = pgEnum("flag_target", [
  "profile",
  "post",
  "comment",
  "review",
  "message",
  "story",
  "group",
  "thread",
  "media",
]);
export const flagReason = pgEnum("flag_reason", [
  "minor",
  "coercion",
  "trafficking",
  "spam",
  "abuse",
  "fake",
  "privacy",
  "illegal",
  "other",
]);
export const flagStatus = pgEnum("flag_status", ["open", "in_review", "resolved", "dismissed"]);
export const moderationActionType = pgEnum("moderation_action_type", [
  "warn",
  "remove_content",
  "suspend_temp",
  "suspend_perm",
  "unsuspend",
  "kyc_approve",
  "kyc_reject",
  "hide_profile",
  "restore_profile",
]);
export const appealStatus = pgEnum("appeal_status", ["open", "accepted", "rejected"]);
export const analyticsType = pgEnum("analytics_type", [
  "profile_view",
  "search_impression",
  "search_click",
  "story_view",
  "story_like",
  "story_comment",
  "favorite_add",
  "follow",
  "chat_start",
  "booking_request",
  "booking_confirmed",
]);
export const analyticsSource = pgEnum("analytics_source", ["search", "feed", "story", "matches", "favorites", "profile", "external", "direct"]);
