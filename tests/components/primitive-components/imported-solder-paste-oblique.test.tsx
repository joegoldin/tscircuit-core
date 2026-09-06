import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { asImportedFootprint } from "tests/fixtures/imported-solder-paste"

test("oblique imported rectangles and pills retain exact orientation and circular ovals remain representable", async () => {
  const footprint: CircuitJson = [
    { type: "pcb_solder_paste", pcb_solder_paste_id: "rect", shape: "rect", x: -2, y: 1, width: 1.2, height: 0.6, layer: "top" },
    { type: "pcb_solder_paste", pcb_solder_paste_id: "pill", shape: "pill", x: 0, y: 1, width: 1.2, height: 0.6, radius: 0.15, layer: "top" },
    { type: "pcb_solder_paste", pcb_solder_paste_id: "oval", shape: "oval", x: 2, y: 1, width: 0.6, height: 0.6, layer: "top" },
  ]
  const { circuit } = getTestFixture()
  circuit.add(<board width={20} height={20} routingDisabled><chip name="U1" layer="bottom" pcbRotation={35} footprint={asImportedFootprint(footprint)} /></board>)
  await circuit.renderUntilSettled()
  const paste = circuit.db.pcb_solder_paste.list()
  expect(paste).toHaveLength(3)
  expect(paste[0]).toMatchObject({ shape: "rotated_rect", width: 1.2, height: 0.6, layer: "bottom" })
  expect(paste[1]).toMatchObject({ shape: "rotated_pill", width: 1.2, height: 0.6, radius: 0.15, layer: "bottom" })
  for (const aperture of paste.slice(0, 2)) {
    if (!("ccw_rotation" in aperture)) throw new Error("Expected rotated paste")
    expect(aperture.ccw_rotation).toBeCloseTo(35, 9)
  }
  expect(paste[2]).toMatchObject({ shape: "oval", width: 0.6, height: 0.6, layer: "bottom" })
})
