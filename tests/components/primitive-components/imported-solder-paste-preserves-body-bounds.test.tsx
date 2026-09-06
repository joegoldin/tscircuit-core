import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { asImportedFootprint } from "tests/fixtures/imported-solder-paste"

test("imported paste cannot change copper-derived component bounds", async () => {
  const copper = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad",
    shape: "rect",
    x: 0,
    y: 0,
    width: 2,
    height: 1,
    layer: "top",
    port_hints: [],
  } as const
  const footprints: CircuitJson[] = [
    [{ ...copper, port_hints: [] }],
    [{ ...copper, port_hints: [] }, {
      type: "pcb_solder_paste",
      pcb_solder_paste_id: "outside",
      shape: "circle",
      x: 5,
      y: 3,
      radius: 0.2,
      layer: "top",
    }],
  ]
  const bounds = []
  for (const footprint of footprints) {
    const { circuit } = getTestFixture()
    circuit.add(<board width={20} height={20} routingDisabled><chip name="U1" pcbX={2} pcbY={1} footprint={asImportedFootprint(footprint)} /></board>)
    await circuit.renderUntilSettled()
    const { center, width, height } = circuit.db.pcb_component.list()[0]
    bounds.push({ center, width, height })
  }
  expect(bounds[1]).toEqual(bounds[0])
})
