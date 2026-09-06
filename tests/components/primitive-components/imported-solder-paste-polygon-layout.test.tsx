import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { SmtPad } from "lib/components/primitive-components/SmtPad"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { asImportedFootprint } from "tests/fixtures/imported-solder-paste"

test("moving imported polygon copper translates its explicitly linked apertures", async () => {
  const footprint: CircuitJson = [
    { type: "pcb_smtpad", pcb_smtpad_id: "polygon", shape: "polygon", points: [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }], layer: "top", port_hints: [] },
    { type: "pcb_solder_paste", pcb_solder_paste_id: "left", pcb_smtpad_id: "polygon", shape: "circle", x: -0.5, y: 0.2, radius: 0.2, layer: "top" },
    { type: "pcb_solder_paste", pcb_solder_paste_id: "right", pcb_smtpad_id: "polygon", shape: "circle", x: 0.5, y: 0.2, radius: 0.2, layer: "top" },
  ]
  const { circuit } = getTestFixture()
  circuit.add(<board width={15} height={15} routingDisabled><chip name="U1" footprint={asImportedFootprint(footprint)} /></board>)
  await circuit.renderUntilSettled()
  const smtPad = circuit.selectOne("smtpad") as SmtPad
  const before = structuredClone(circuit.db.pcb_solder_paste.list())
  expect(before).toHaveLength(2)
  smtPad._moveCircuitJsonElements({ deltaX: 2, deltaY: -1 })
  for (const [index, aperture] of circuit.db.pcb_solder_paste.list().entries()) {
    expect(aperture.x).toBeCloseTo(before[index].x + 2, 9)
    expect(aperture.y).toBeCloseTo(before[index].y - 1, 9)
  }
})
