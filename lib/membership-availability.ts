// Mobile release builds replace this value at compile time. The saved preview
// is available only through the explicit membership-preview build mode.
export const MEMBERSHIP_PREVIEW_ENABLED = process.env.NEXT_PUBLIC_OOS_MEMBERSHIP_PREVIEW !== "false";
