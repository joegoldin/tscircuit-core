import { expect, test } from "bun:test"
import type { PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { FootprintProp } from "@tscircuit/props"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("connected composite port is placed on its own copper", async () => {
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
    <board width="10mm" height="10mm" routingDisabled>
      <chip
        name="U2"
        pcbX="2mm"
        pcbY="-2mm"
        pinLabels={{ pin49: "GND2" }}
        footprint={footprint as unknown as FootprintProp}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const pcbPorts = circuit.db.pcb_port.list()
  const [pcbPort] = pcbPorts
  const pads = circuit.db.pcb_smtpad.list()

  expect(pcbPorts).toHaveLength(1)
  expect(pcbPort.layers).toEqual(["top"])
  expect({
    x: Number(pcbPort.x.toFixed(12)),
    y: Number(pcbPort.y.toFixed(12)),
  }).toEqual({ x: 1.8, y: 0.7375 })
  expect(
    pads.some(
      (pad) =>
        pad.shape === "rect" &&
        Math.abs(pcbPort.x - pad.x) <= pad.width / 2 &&
        Math.abs(pcbPort.y - pad.y) <= pad.height / 2,
    ),
  ).toBe(true)
  expect(
    pads.map((pad) => {
      if (pad.shape !== "rect") throw new Error("Expected rectangular pad")
      return {
        x: Number(pad.x.toFixed(6)),
        y: Number(pad.y.toFixed(6)),
        width: pad.width,
        height: pad.height,
        shape: pad.shape,
        layer: pad.layer,
      }
    }),
  ).toEqual([
    {
      x: 1.8,
      y: 0.95,
      width: 0.2,
      height: 0.85,
      shape: "rect",
      layer: "top",
    },
    {
      x: 0.2,
      y: 0.95,
      width: 0.2,
      height: 0.85,
      shape: "rect",
      layer: "top",
    },
    {
      x: 2,
      y: -2,
      width: 4.2,
      height: 4.2,
      shape: "rect",
      layer: "top",
    },
    {
      x: 0.2,
      y: 0.7375,
      width: 0.2,
      height: 1.275,
      shape: "rect",
      layer: "top",
    },
    {
      x: 1.8,
      y: 0.7375,
      width: 0.2,
      height: 1.275,
      shape: "rect",
      layer: "top",
    },
  ])
  expect(pads.every((pad) => pad.pcb_port_id === pcbPort.pcb_port_id)).toBe(true)
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
