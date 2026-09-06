import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("linked composite supply port is placed on unchanged copper", async () => {
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
    ...supplyPadYPositions.map(
      (y, linkIndex): PcbSmtPad => ({
        type: "pcb_smtpad",
        pcb_smtpad_id: `supply_link_${linkIndex}`,
        pcb_component_id: "pcb_component_0",
        pcb_port_id: `pcb_port_${linkIndex}`,
        port_hints: ["pin1", "3", "6", "8"],
        layer: "top",
        shape: "rect",
        x: -2.46,
        y,
        width: 0.17,
        height: 0.15,
      }),
    ),
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

  const pcbPorts = circuit.db.pcb_port.list()
  const pads = circuit.db.pcb_smtpad.list()
  const [pcbPort] = pcbPorts

  expect(pcbPorts).toHaveLength(1)
  expect(pads).toHaveLength(9)
  expect(
    pads.some(
      (pad) =>
        pad.shape === "rect" &&
        Math.abs(pcbPort.x - pad.x) <= pad.width / 2 + 1e-9 &&
        Math.abs(pcbPort.y - pad.y) <= pad.height / 2 + 1e-9,
    ),
  ).toBe(true)
  expect(
    pads
      .map((pad) => {
        if (pad.shape !== "rect") throw new Error("Expected rectangular pad")
        return `${pad.x.toFixed(2)},${pad.y.toFixed(2)},${pad.width.toFixed(2)},${pad.height.toFixed(2)}`
      })
      .toSorted(),
  ).toEqual([
    "-2.32,0.80,0.15,3.00",
    "-2.46,-0.60,0.17,0.15",
    "-2.46,0.20,0.17,0.15",
    "-2.46,1.40,0.17,0.15",
    "-2.46,2.20,0.17,0.15",
    "-2.95,-0.60,0.85,0.20",
    "-2.95,0.20,0.85,0.20",
    "-2.95,1.40,0.85,0.20",
    "-2.95,2.20,0.85,0.20",
  ])
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
