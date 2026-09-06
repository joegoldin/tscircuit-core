import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("rotated pads with overlapping bounds remain disconnected", async () => {
  const { circuit } = getTestFixture()
  const footprint: PcbSmtPad[] = [0, 1].map(
    (x, padIndex): PcbSmtPad => ({
      type: "pcb_smtpad",
      pcb_smtpad_id: `rotated_pad_${padIndex}`,
      pcb_component_id: "pcb_component_0",
      pcb_port_id: `pcb_port_${padIndex}`,
      port_hints: ["pin1"],
      layer: "top",
      shape: "rotated_rect",
      x,
      y: 0,
      width: 0.2,
      height: 2,
      ccw_rotation: 37,
    }),
  )

  circuit.add(
    <board width="5mm" height="5mm" routingDisabled>
      <chip
        name="U1"
        pinLabels={{ pin1: "SIG" }}
        footprint={footprint as unknown as FootprintProp}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const pads = circuit.db.pcb_smtpad.list()
  expect(circuit.db.pcb_port.list()).toHaveLength(0)
  expect(circuit.db.source_ambiguous_port_reference.list()).not.toHaveLength(0)
  expect(
    pads.map((pad) => {
      if (pad.shape !== "rotated_rect") {
        throw new Error("Expected rotated rectangle")
      }
      return {
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
        rotation: pad.ccw_rotation,
      }
    }),
  ).toEqual([
    { x: 0, y: 0, width: 0.2, height: 2, rotation: 37 },
    { x: 1, y: 0, width: 0.2, height: 2, rotation: 37 },
  ])
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
