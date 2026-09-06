import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import type { SmtPad } from "lib/components/primitive-components/SmtPad"
import { getCenterOfPcbPrimitives } from "lib/components/primitive-components/Port/getCenterOfPcbPrimitives"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import {
  applyToPoint,
  compose,
  rotateDEG,
  translate,
} from "transformation-matrix"

const isPointOnRotatedRectPad = (
  point: { x: number; y: number },
  pad: PcbSmtPad,
): boolean => {
  if (pad.shape !== "rotated_rect") return false
  const localPoint = applyToPoint(
    compose(
      rotateDEG(-pad.ccw_rotation),
      translate(-pad.x, -pad.y),
    ),
    point,
  )
  return (
    Math.abs(localPoint.x) <= pad.width / 2 + 1e-9 &&
    Math.abs(localPoint.y) <= pad.height / 2 + 1e-9
  )
}

test("rotated bottom composite port is placed on emitted copper", async () => {
  const { circuit } = getTestFixture()
  const footprint: PcbSmtPad[] = [
    { x: -0.2, y: 2.95, width: 0.2, height: 0.85 },
    { x: -1.8, y: 2.95, width: 0.2, height: 0.85 },
    { x: 0, y: 0, width: 4.2, height: 4.2 },
    { x: -1.8, y: 2.7375, width: 0.2, height: 1.275 },
    { x: -0.2, y: 2.7375, width: 0.2, height: 1.275 },
  ].map(
    (pad, padIndex): PcbSmtPad => ({
      type: "pcb_smtpad",
      pcb_smtpad_id: `ground_pad_${padIndex}`,
      pcb_component_id: "pcb_component_0",
      pcb_port_id: `ground_port_${padIndex}`,
      port_hints: ["pin49", "43", "47"],
      layer: "top",
      shape: "rect",
      ...pad,
    }),
  )

  circuit.add(
    <board width="14mm" height="14mm" routingDisabled>
      <chip
        name="U2"
        layer="bottom"
        pcbX="3mm"
        pcbY="-1mm"
        pcbRotation="37deg"
        pinLabels={{ pin49: "GND2" }}
        footprint={footprint as unknown as FootprintProp}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const pcbPorts = circuit.db.pcb_port.list()
  const [pcbPort] = pcbPorts
  const pads = circuit.db.pcb_smtpad.list()
  const representative = getCenterOfPcbPrimitives(
    circuit.selectAll("smtpad") as SmtPad[],
  )

  expect(pcbPorts).toHaveLength(1)
  expect(pcbPort.layers).toEqual(["bottom"])
  expect(pads).toHaveLength(5)
  expect(pads.every((pad) => pad.layer === "bottom")).toBe(true)
  expect(pads.some((pad) => isPointOnRotatedRectPad(representative, pad))).toBe(
    true,
  )
  expect(pads.some((pad) => isPointOnRotatedRectPad(pcbPort, pad))).toBe(true)
  expect(pads.every((pad) => pad.pcb_port_id === pcbPort.pcb_port_id)).toBe(true)
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
