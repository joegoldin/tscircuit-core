import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("disconnected composite supply copper does not create a PCB port", async () => {
  const { circuit } = getTestFixture()
  const supplyPadYPositions = [2.2, 1.4, 0.2, -0.6]
  const supplyFootprint: PcbSmtPad[] = [
    ...supplyPadYPositions.map(
      (y, padIndex): PcbSmtPad => ({
        type: "pcb_smtpad",
        pcb_smtpad_id: `pcb_smtpad_${padIndex}`,
        pcb_component_id: "pcb_component_0",
        pcb_port_id: `pcb_port_${padIndex}`,
        port_hints: ["pin1", "3", "6", "8"],
        layer: "top",
        shape: "rect",
        x: -2.95,
        y,
        width: 0.85,
        height: 0.2,
      }),
    ),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "bridge_1_3_6_8_-2.32_0.8",
      port_hints: ["pin1", "3", "6", "8"],
      layer: "top",
      shape: "rect",
      x: -2.32,
      y: 0.8,
      width: 0.15,
      height: 3,
    },
  ]

  circuit.add(
    <board width="10mm" height="10mm" routingDisabled>
      <chip
        name="U2"
        pinLabels={{ pin1: "VDDA6" }}
        footprint={supplyFootprint as unknown as FootprintProp}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  expect(circuit.db.pcb_port.list()).toHaveLength(0)
  expect(circuit.db.source_ambiguous_port_reference.list()).not.toHaveLength(0)
  expect(circuit.db.pcb_smtpad.list()).toHaveLength(5)
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
