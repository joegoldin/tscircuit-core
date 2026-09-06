import { expect, test } from "bun:test"
import { createComponentsFromCircuitJson } from "lib/utils/createComponentsFromCircuitJson"
import { createNineWindowFootprint } from "tests/fixtures/imported-solder-paste"

test("explicit imported paste links reject missing or ambiguous pad IDs", () => {
  const footprint = createNineWindowFootprint()
  const options = { componentName: "U1", componentRotation: "0deg" }
  expect(() => createComponentsFromCircuitJson(options, footprint.filter((elm) => elm.type !== "pcb_smtpad"))).toThrow("ep")
  expect(() => createComponentsFromCircuitJson(options, [...footprint, footprint.find((elm) => elm.type === "pcb_smtpad")!])).toThrow("ep")
})
