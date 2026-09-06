import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("contained rounded rotated rectangle remains connected", async () => {
  const { circuit } = getTestFixture()
  const footprint: PcbSmtPad[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "outer_pad",
      pcb_component_id: "pcb_component_0",
      pcb_port_id: "pcb_port_0",
      port_hints: ["pin1"],
      layer: "top",
      shape: "rect",
      x: 0,
      y: 0,
      width: 4,
      height: 4,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "inner_pad",
      pcb_component_id: "pcb_component_0",
      pcb_port_id: "pcb_port_1",
      port_hints: ["pin1"],
      layer: "top",
      shape: "rotated_rect",
      x: 0,
      y: 0,
      width: 2,
      height: 1,
      ccw_rotation: 5,
      corner_radius: 0.1,
    },
  ]

  circuit.add(
    <board width="7mm" height="7mm" routingDisabled>
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
  expect({ x: pcbPort.x, y: pcbPort.y }).toEqual({ x: 0, y: 0 })
  expect(circuit.db.source_ambiguous_port_reference.list()).toHaveLength(0)
  expect(pads.every((pad) => pad.pcb_port_id === pcbPort.pcb_port_id)).toBe(true)
  expect(pads).toEqual([
    expect.objectContaining({ shape: "rect", width: 4, height: 4 }),
    expect.objectContaining({
      shape: "rotated_rect",
      width: 2,
      height: 1,
      ccw_rotation: 5,
      corner_radius: 0.1,
    }),
  ])
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
