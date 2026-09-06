import { expect, test } from "bun:test"
import { SmtPad } from "lib/components/primitive-components/SmtPad"
import type { Chip } from "lib/components/normal-components/Chip"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { asImportedFootprint, createNineWindowFootprint } from "tests/fixtures/imported-solder-paste"

test("pad layout and component reposition retain every imported stencil offset", async () => {
  const { circuit } = getTestFixture()
  circuit.add(<board width={20} height={20} routingDisabled><chip name="U1" footprint={asImportedFootprint(createNineWindowFootprint())} pinLabels={{ pin1: "EP", pin2: "OUT" }} /></board>)
  await circuit.renderUntilSettled()
  const ep = circuit.selectAll("smtpad").find((pad) => pad instanceof SmtPad && pad.props.portHints?.includes("1")) as SmtPad
  const windows = () => circuit.db.pcb_solder_paste.list().filter((paste) => paste.pcb_smtpad_id === ep.pcb_smtpad_id)
  expect(windows()).toHaveLength(9)
  const before = structuredClone(windows())
  const pad = circuit.db.pcb_smtpad.get(ep.pcb_smtpad_id!)!
  if (pad.shape === "polygon") throw new Error("Expected rectangle")
  ep._setPositionFromLayout({ x: pad.x + 2, y: pad.y - 3 })
  for (const [index, paste] of windows().entries()) {
    expect(paste.x).toBeCloseTo(before[index].x + 2, 9)
    expect(paste.y).toBeCloseTo(before[index].y - 3, 9)
  }
  const chip = circuit.selectOne(".U1") as Chip
  const component = circuit.db.pcb_component.get(chip.pcb_component_id!)!
  chip._repositionOnPcb({ x: component.center.x + 4, y: component.center.y + 5 })
  for (const [index, paste] of windows().entries()) {
    expect(paste.x).toBeCloseTo(before[index].x + 6, 9)
    expect(paste.y).toBeCloseTo(before[index].y + 2, 9)
  }
})
