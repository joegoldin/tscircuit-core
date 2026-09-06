import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { Fragment } from "react"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("imported copper retains covered solder mask and omits covered paste", async () => {
  const { circuit } = getTestFixture()
  const footprint = [true, false, undefined].flatMap(
    (covered, index) =>
      [
        {
          type: "pcb_smtpad",
          pcb_smtpad_id: `rect_${index}`,
          shape: "rect",
          x: index * 4 - 4,
          y: 2,
          width: 1,
          height: 1,
          layer: "top",
          port_hints: [],
          is_covered_with_solder_mask: covered,
        },
        {
          type: "pcb_smtpad",
          pcb_smtpad_id: `circle_${index}`,
          shape: "circle",
          x: index * 4 - 4,
          y: 0,
          radius: 0.5,
          layer: "bottom",
          port_hints: [],
          is_covered_with_solder_mask: covered,
        },
        {
          type: "pcb_plated_hole",
          pcb_plated_hole_id: `hole_${index}`,
          shape: "circle",
          x: index * 4 - 4,
          y: -2,
          outer_diameter: 0.5,
          hole_diameter: 0.2,
          layers: ["top", "bottom"],
          port_hints: [],
          is_covered_with_solder_mask: covered,
        },
      ] satisfies CircuitJson,
  )
  circuit.add(
    <board width={16} height={12} routingDisabled>
      <chip name="U1" footprint={footprint} />
      {[true, false, undefined].map((covered, index) => (
        <Fragment key={index}>
          <platedhole
            name={`pill_${index}`}
            shape="pill"
            outerWidth={1}
            outerHeight={0.5}
            holeWidth={0.7}
            holeHeight={0.2}
            pcbX={index * 4 - 4}
            pcbY={-4}
            coveredWithSolderMask={covered}
          />
        </Fragment>
      ))}
    </board>,
  )
  await circuit.renderUntilSettled()
  const pads = circuit.db.pcb_smtpad.list()
  const holes = circuit.db.pcb_plated_hole.list()
  expect(pads).toHaveLength(6)
  expect(holes).toHaveLength(6)
  for (const copper of [...pads, ...holes]) {
    if (copper.shape === "polygon") throw new Error("Unexpected polygon copper")
    expect(copper.is_covered_with_solder_mask).toBe(copper.x === -4)
  }
  const paste = circuit.db.pcb_solder_paste.list()
  expect(paste.some((aperture) => aperture.x === -4)).toBe(false)
  expect(paste.some((aperture) => aperture.x === 0)).toBe(true)
  expect(paste.some((aperture) => aperture.x === 4)).toBe(true)
})
