import { expect, test } from "bun:test"
import { isPointInsidePolygon } from "@tscircuit/math-utils"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("port on a concave polygon pad is placed on emitted copper", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <board width="10mm" height="10mm" routingDisabled>
      <chip
        name="U1"
        pcbX="1mm"
        pcbY="0.5mm"
        pinLabels={{ pin1: "CONCAVE" }}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              shape="polygon"
              points={[
                { x: -2, y: -2 },
                { x: 2, y: -2 },
                { x: 2, y: -1 },
                { x: -1, y: -1 },
                { x: -1, y: 2 },
                { x: -2, y: 2 },
              ]}
            />
          </footprint>
        }
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const [pcbPort] = circuit.db.pcb_port.list()
  const [pad] = circuit.db.pcb_smtpad.list()

  expect(pcbPort).toBeDefined()
  expect(pad.shape).toBe("polygon")
  if (pad.shape !== "polygon") throw new Error("Expected polygon pad")
  expect(isPointInsidePolygon(pcbPort, pad.points)).toBe(true)
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
