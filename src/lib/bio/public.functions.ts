import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const loadBio = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { loadBioPage, registerPageView } = await import("./public.server");
    const result = await loadBioPage(data.slug);
    if (result.status === "ok") await registerPageView(result.page.slug);
    return result;
  });
