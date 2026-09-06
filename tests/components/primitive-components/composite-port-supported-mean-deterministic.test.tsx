import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

const renderComposite = async (
  padCenters: Array<{ x: number; y: number }>,
): Promise<ReturnType<typeof getTestFixture>["circuit"]> => {
  const { circuit } = getTestFixture()
  const footprint = padCenters.map(
    (center, padIndex): PcbSmtPad => ({
      type: "pcb_smtpad",
      pcb_smtpad_id: `pad_${padIndex}`,
      pcb_component_id: "pcb_component_0",
      pcb_port_id: `pcb_port_${padIndex}`,
      port_hints: ["pin1"],
      layer: "top",
      shape: "rect",
      x: center.x,
      y: center.y,
      width: 2,
      height: 1,
    }),
  )
  circuit.add(
    <board width="10mm" height="6mm" routingDisabled>
      <chip
        name="U1"
        pinLabels={{ pin1: "SUPPORTED" }}
        footprint={footprint as unknown as FootprintProp}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit
}

test("supported composite mean is unchanged across primitive order", async () => {
  const orderedCircuit = await renderComposite([
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  const shuffledCircuit = await renderComposite([
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 0 },
  ])

  const [orderedPort] = orderedCircuit.db.pcb_port.list()
  const [shuffledPort] = shuffledCircuit.db.pcb_port.list()

  expect({ x: orderedPort.x, y: orderedPort.y }).toEqual({ x: 0, y: 0 })
  expect({ x: shuffledPort.x, y: shuffledPort.y }).toEqual({ x: 0, y: 0 })
  expect(shuffledCircuit.db.pcb_smtpad.list()).toHaveLength(3)
  expect(
    convertCircuitJsonToPcbSvg(orderedCircuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
