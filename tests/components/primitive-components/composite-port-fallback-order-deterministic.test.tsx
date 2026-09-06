import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

const groundPadGeometry = [
  { x: -0.2, y: 2.95, width: 0.2, height: 0.85 },
  { x: -1.8, y: 2.95, width: 0.2, height: 0.85 },
  { x: 0, y: 0, width: 4.2, height: 4.2 },
  { x: -1.8, y: 2.7375, width: 0.2, height: 1.275 },
  { x: -0.2, y: 2.7375, width: 0.2, height: 1.275 },
]

const renderGroundGroup = async (
  geometry: typeof groundPadGeometry,
): Promise<ReturnType<typeof getTestFixture>["circuit"]> => {
  const { circuit } = getTestFixture()
  const footprint = geometry.map(
    (pad, padIndex): PcbSmtPad => ({
      type: "pcb_smtpad",
      pcb_smtpad_id: `ground_pad_${padIndex}`,
      pcb_component_id: "pcb_component_0",
      pcb_port_id: `pcb_port_${padIndex}`,
      port_hints: ["pin49", "43", "47"],
      layer: "top",
      shape: "rect",
      ...pad,
    }),
  )
  circuit.add(
    <board width="8mm" height="8mm" routingDisabled>
      <chip
        name="U2"
        pinLabels={{ pin49: "GND2" }}
        footprint={footprint as unknown as FootprintProp}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit
}

test("unsupported mean fallback is independent of primitive order", async () => {
  const orderedCircuit = await renderGroundGroup(groundPadGeometry)
  const reversedCircuit = await renderGroundGroup(
    groundPadGeometry.toReversed(),
  )
  const [orderedPort] = orderedCircuit.db.pcb_port.list()
  const [reversedPort] = reversedCircuit.db.pcb_port.list()

  expect({ x: orderedPort.x, y: orderedPort.y }).toEqual({
    x: -0.2,
    y: 2.7375,
  })
  expect({ x: reversedPort.x, y: reversedPort.y }).toEqual({
    x: -0.2,
    y: 2.7375,
  })
  expect(
    reversedCircuit.db.pcb_smtpad
      .list()
      .every((pad) => pad.pcb_port_id === reversedPort.pcb_port_id),
  ).toBe(true)
  expect(
    convertCircuitJsonToPcbSvg(orderedCircuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
