"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_PUNTO } from "@/lib/puntos";

export async function seleccionarPunto(puntoId: string | null) {
  const cookieStore = await cookies();
  if (puntoId) {
    cookieStore.set(COOKIE_PUNTO, puntoId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  } else {
    cookieStore.delete(COOKIE_PUNTO);
  }
  revalidatePath("/", "layout");
}
