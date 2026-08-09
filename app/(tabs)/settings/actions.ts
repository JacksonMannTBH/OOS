"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  CONTRAST_COOKIE,
  TIME_FORMAT_COOKIE,
  type ContrastMode,
  type TimeFormat,
} from "@/lib/user-prefs";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export async function setTimeFormatAction(formData: FormData): Promise<void> {
  const raw = formData.get("format");
  const next: TimeFormat = raw === "12" ? "12" : "24";
  cookies().set({
    name: TIME_FORMAT_COOKIE,
    value: next,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
}

export async function setContrastAction(formData: FormData): Promise<void> {
  const raw = formData.get("contrast");
  const next: ContrastMode = raw === "high" ? "high" : "normal";
  cookies().set({
    name: CONTRAST_COOKIE,
    value: next,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
}

export async function resetPreferenceCookiesAction(): Promise<void> {
  const jar = cookies();
  jar.delete(TIME_FORMAT_COOKIE);
  jar.delete(CONTRAST_COOKIE);
  revalidatePath("/", "layout");
}
