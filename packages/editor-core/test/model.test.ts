import { describe, expect, it } from "vitest";

import { addStep, createWorkflowDoc, deleteStep, getDescription, getStepsOrdered, getStepText, moveStep, setField } from "../src";

const ids = (d: ReturnType<typeof createWorkflowDoc>) => getStepsOrdered(d).map((s) => s.id);

describe("model", () => {
  it("adds, orders and moves steps", () => {
    const d = createWorkflowDoc({ name: "x" });
    const a = addStep(d);
    const b = addStep(d);
    const c = addStep(d, { afterId: a });
    expect(ids(d)).toEqual([a, c, b]);
    const z = addStep(d, { afterId: null });
    expect(ids(d)).toEqual([z, a, c, b]);
    moveStep(d, b, { beforeId: z });
    expect(ids(d)).toEqual([b, z, a, c]);
    moveStep(d, b, { afterId: c });
    expect(ids(d)).toEqual([z, a, c, b]);
    moveStep(d, z, { afterId: a });
    expect(ids(d)).toEqual([a, z, c, b]);
  });

  it("never reuses step ids", () => {
    const d = createWorkflowDoc();
    expect(addStep(d)).toBe("s-1");
    expect(addStep(d)).toBe("s-2");
    deleteStep(d, "s-2");
    expect(addStep(d)).toBe("s-3");
  });

  it("moving changes only the index", () => {
    const d = createWorkflowDoc();
    const a = addStep(d, { action: "hello" });
    const b = addStep(d);
    getStepText(d, a).insert(5, "!");
    moveStep(d, a, { afterId: b });
    expect(getStepText(d, a).toString()).toBe("hello!");
  });

  it("sets fields and text", () => {
    const d = createWorkflowDoc();
    const a = addStep(d);
    setField(d, a, "role", "operator");
    getDescription(d).insert(0, "desc");
    expect(getStepsOrdered(d)[0]!.map.get("role")).toBe("operator");
    expect(getDescription(d).toString()).toBe("desc");
    expect(() => setField(d, "nope", "role", "x")).toThrow();
  });
});
