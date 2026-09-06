import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("overlapping pads on separate layers remain disconnected", async () => {
  const { circuit } = getTestFixture()
  const footprint: PcbSmtPad[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "top_pad",
      pcb_component_id: "pcb_component_0",
      pcb_port_id: "top_port",
      port_hints: ["pin1"],
      layer: "top",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "bottom_pad",
      pcb_component_id: "pcb_component_0",
      pcb_port_id: "bottom_port",
      port_hints: ["pin1"],
      layer: "bottom",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
  ]

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

  expect(circuit.db.pcb_port.list()).toHaveLength(0)
  expect(circuit.db.source_ambiguous_port_reference.list()).not.toHaveLength(0)
  expect(circuit.db.pcb_smtpad.list()).toHaveLength(2)
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
