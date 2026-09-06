import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { asImportedFootprint, createNineWindowFootprint } from "tests/fixtures/imported-solder-paste"

test("imported nine-window stencil replaces only its linked pad's automatic paste", async () => {
  const { circuit } = getTestFixture()
  const footprint = createNineWindowFootprint()
  const original = structuredClone(footprint)
  circuit.add(
    <board width={20} height={12} routingDisabled>
      <chip name="U1" pcbX={4} pcbY={2} footprint={asImportedFootprint(footprint)} pinLabels={{ pin1: "EP", pin2: "OUT" }} />
    </board>,
  )
  await circuit.renderUntilSettled()
  const pads = circuit.db.pcb_smtpad.list()
  const ep = pads.find((pad) => pad.port_hints?.includes("1"))!
  const neighbor = pads.find((pad) => pad.port_hints?.includes("2"))!
  if (ep.shape !== "rect") throw new Error("Expected EP rectangle")
  const windows = circuit.db.pcb_solder_paste.list().filter((paste) => paste.pcb_smtpad_id === ep.pcb_smtpad_id)
  expect(windows).toHaveLength(9)
  expect(pads).toHaveLength(2)
  expect(ep).toMatchObject({ shape: "rect", width: 4.2, height: 4.2, x: 4, y: 2, is_covered_with_solder_mask: false })
  expect(ep.pcb_port_id).toBeDefined()
  expect(neighbor.pcb_port_id).toBeDefined()
  for (const window of windows) {
    expect(window).toMatchObject({ shape: "pill", width: 1.13, height: 1.13, radius: 0.25, layer: "top", pcb_component_id: ep.pcb_component_id })
    expect([-1.4, 0, 1.4].some((x) => Math.abs(window.x - ep.x - x) < 1e-9)).toBe(true)
    expect([-1.4, 0, 1.4].some((y) => Math.abs(window.y - ep.y - y) < 1e-9)).toBe(true)
  }
  expect(new Set(windows.map((paste) => `${paste.x},${paste.y}`)).size).toBe(9)
  expect(circuit.db.pcb_solder_paste.list().filter((paste) => paste.pcb_smtpad_id === neighbor.pcb_smtpad_id)).toEqual([
    expect.objectContaining({ width: 0.8 * 0.7, height: 0.4 * 0.7 }),
  ])
  expect(footprint).toEqual(original)
})
