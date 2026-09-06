import { expect, test } from "bun:test"
import { getTestFixture } from "tests/fixtures/get-test-fixture"
import { asImportedFootprint } from "tests/fixtures/imported-solder-paste"

test("an imported unequal-axis oval rejects an unrepresentable non-quarter rotation", async () => {
  const { circuit } = getTestFixture()
  circuit.add(<board routingDisabled><chip name="U1" pcbRotation={30} footprint={asImportedFootprint([{ type: "pcb_solder_paste", pcb_solder_paste_id: "oval", shape: "oval", x: 0, y: 0, width: 2, height: 1, layer: "top" }])} /></board>)
  await expect(circuit.renderUntilSettled()).rejects.toThrow("oval oval cannot represent rotation")
})
