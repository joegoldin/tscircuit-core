import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import type { SmtPad } from "lib/components/primitive-components/SmtPad"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

const normalizeBounds = (bounds: {
  left: number
  right: number
  top: number
  bottom: number
}): { left: number; right: number; top: number; bottom: number } => ({
  left: Math.min(bounds.left, bounds.right),
  right: Math.max(bounds.left, bounds.right),
  top: Math.max(bounds.top, bounds.bottom),
  bottom: Math.min(bounds.top, bounds.bottom),
})

test("rounded rotated rectangles with corner-only bounds overlap remain disconnected", async () => {
  const { circuit } = getTestFixture()
  const footprint: PcbSmtPad[] = [
    { x: 0, y: 0, ccw_rotation: 5 },
    { x: 1.8, y: 1.8, ccw_rotation: -5 },
  ].map(
    (pad, padIndex): PcbSmtPad => ({
      type: "pcb_smtpad",
      pcb_smtpad_id: `rounded_pad_${padIndex}`,
      pcb_component_id: "pcb_component_0",
      pcb_port_id: `pcb_port_${padIndex}`,
      port_hints: ["pin1"],
      layer: "top",
      shape: "rotated_rect",
      width: 2,
      height: 2,
      corner_radius: 1,
      ...pad,
    }),
  )

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

  const pads = circuit.db.pcb_smtpad.list()
  const [firstBounds, secondBounds] = (circuit.selectAll("smtpad") as SmtPad[])
    .map((pad) => pad._getPcbCircuitJsonBounds().bounds)
    .map(normalizeBounds)
  expect(
    !(
      firstBounds.right < secondBounds.left ||
      firstBounds.left > secondBounds.right ||
      firstBounds.bottom > secondBounds.top ||
      firstBounds.top < secondBounds.bottom
    ),
  ).toBe(true)
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
        cornerRadius: pad.corner_radius,
      }
    }),
  ).toEqual([
    { x: 0, y: 0, width: 2, height: 2, cornerRadius: 1 },
    { x: 1.8, y: 1.8, width: 2, height: 2, cornerRadius: 1 },
  ])
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
