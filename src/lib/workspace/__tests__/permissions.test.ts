import { describe, expect, it } from "vitest";
import { workspacePermissions } from "../permissions";

describe("workspace UI permissions mirror server roles", () => {
  it.each(["owner", "admin"])("%s can edit and manage", (role) => {
    expect(workspacePermissions(role)).toEqual({ canEdit: true, canManage: true });
  });
  it("an editor can edit content/bio/brands, not manage channels or execute the queue", () => {
    expect(workspacePermissions("editor")).toEqual({ canEdit: true, canManage: false });
  });
  it.each(["viewer", "unknown", "OWNER", "", undefined, null])("fails closed for %s", (role) => {
    expect(workspacePermissions(role)).toEqual({ canEdit: false, canManage: false });
  });
});
