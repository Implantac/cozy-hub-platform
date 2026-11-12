import { describe, expect, it } from "vitest";
import { manualContentStatusSchema } from "../status";

describe("manual editorial statuses", () => {
  it.each(["draft", "archived"])("allows %s without claiming a delivery", (status) => {
    expect(manualContentStatusSchema.parse(status)).toBe(status);
  });
  it.each(["scheduled", "publishing", "published", "failed"])(
    "does not let the editor forge %s",
    (status) => {
      expect(manualContentStatusSchema.safeParse(status).success).toBe(false);
    },
  );
});
