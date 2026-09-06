import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { asImportedFootprint, createNineWindowFootprint } from "tests/fixtures/imported-solder-paste"

test("repeated imports remap paste identity without suppressing unlinked copper", async () => {
  const footprint = createNineWindowFootprint()
  footprint.push({ type: "pcb_solder_paste", pcb_solder_paste_id: "independent", shape: "circle", x: 4, y: 2, radius: 0.1, layer: "bottom" })
  const original = structuredClone(footprint)
  const { circuit } = getTestFixture()
  circuit.add(<board width={30} height={20} routingDisabled><chip name="U1" pcbX={-6} footprint={asImportedFootprint(footprint)} /><chip name="U2" pcbX={6} footprint={asImportedFootprint([...footprint].reverse())} /></board>)
  await circuit.renderUntilSettled()
  const paste = circuit.db.pcb_solder_paste.list()
  expect(paste).toHaveLength(22)
  expect(new Set(paste.map((aperture) => aperture.pcb_solder_paste_id)).size).toBe(22)
  for (const aperture of paste) {
    if (!aperture.pcb_smtpad_id) {
      expect(aperture).toMatchObject({ shape: "circle", layer: "bottom", radius: 0.1 })
      expect(aperture.pcb_component_id).toBeDefined()
      continue
    }
    expect(circuit.db.pcb_smtpad.get(aperture.pcb_smtpad_id)?.pcb_component_id).toBe(aperture.pcb_component_id)
    expect(aperture.pcb_smtpad_id).not.toBe("ep")
  }
  expect(paste.filter((aperture) => !aperture.pcb_smtpad_id)).toHaveLength(2)
  expect(footprint).toEqual(original)
})
