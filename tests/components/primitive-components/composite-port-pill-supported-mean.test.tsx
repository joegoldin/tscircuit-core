import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("non-maximal-radius pill preserves its supported port mean", async () => {
  const { circuit } = getTestFixture()
  const footprint: PcbSmtPad[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pill_pad",
      pcb_component_id: "pcb_component_0",
      pcb_port_id: "pcb_port_0",
      port_hints: ["pin1"],
      layer: "top",
      shape: "pill",
      x: 0,
      y: 0,
      width: 4,
      height: 2,
      radius: 0.25,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "circle_pad",
      pcb_component_id: "pcb_component_0",
      pcb_port_id: "pcb_port_1",
      port_hints: ["pin1"],
      layer: "top",
      shape: "circle",
      x: 0,
      y: 1.5,
      radius: 0.6,
    },
  ]

  circuit.add(
    <board width="7mm" height="6mm" routingDisabled>
      <chip
        name="U1"
        pinLabels={{ pin1: "SIG" }}
        footprint={footprint as unknown as FootprintProp}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const pcbPorts = circuit.db.pcb_port.list()
  const [pcbPort] = pcbPorts
  const pads = circuit.db.pcb_smtpad.list()
  expect(pcbPorts).toHaveLength(1)
  expect({ x: pcbPort.x, y: pcbPort.y }).toEqual({ x: 0, y: 0.75 })
  expect(pads.every((pad) => pad.pcb_port_id === pcbPort.pcb_port_id)).toBe(true)
  expect(pads).toEqual([
    expect.objectContaining({
      shape: "pill",
      x: 0,
      y: 0,
      width: 4,
      height: 2,
      radius: 0.25,
    }),
    expect.objectContaining({ shape: "circle", x: 0, y: 1.5, radius: 0.6 }),
  ])
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
